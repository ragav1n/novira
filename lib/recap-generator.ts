import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerRatesMap } from '@/lib/server-exchange-rates';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface TxRow {
    amount: number;
    category: string;
    payment_method: string | null;
    date: string;
    place_name: string | null;
    description: string;
    user_id: string;
    currency: string | null;
    exchange_rate: number | null;
    base_currency: string | null;
    converted_amount: number | null;
    splits?: { user_id: string; amount: number }[];
}

interface CategoryAgg {
    category: string;
    total: number;
    count: number;
}

interface MerchantAgg {
    name: string;
    total: number;
    count: number;
}

const SYSTEM_PROMPT_MONTH = `You are a sharp personal finance coach embedded in Novira. The user just finished a calendar month of spending. You'll receive a JSON payload with: this month's total + transaction count, every category total + count, top merchants with totals + visit counts, payment-method splits, and the same set for the previous month for comparison.

You MUST respond with a single JSON object — no markdown fences, no prose outside the JSON — matching this shape exactly:

{
  "headline": "<one short sentence with total spent and direction vs last month, ≤14 words>",
  "totalSpent": <number, this month's total in base currency>,
  "previousTotal": <number, prior month's total in base currency>,
  "changePercent": <number, signed % change vs prior month; 0 if prior was 0>,
  "transactionCount": <number, this month's transaction count from the input>,
  "insights": [
    {
      "label": "<2–3 word title>",
      "kind": "<category|merchant|payment|frequency|new>",
      "subject": "<lowercase exact value from the data — category name for kind=category|new, merchant name for kind=merchant, payment-method name for kind=payment, empty string for kind=frequency>",
      "detail": "<one concrete sentence with specific numbers, ≤18 words>"
    }
  ],
  "takeaway": "<one practical, specific suggestion grounded in the data, ≤24 words>"
}

What to analyze (pick the 3–4 most useful insights — variety beats redundancy):
1. Biggest category mover up — name it, give absolute amount and % change vs prior month.
2. Biggest category mover down or that you cut — same format.
3. A brand-new category that didn't exist last month, if any.
4. Top merchant or merchant concentration — e.g. "X visits to Y for Z total" or "top 3 merchants account for N% of spend".
5. Payment-method shift — e.g. "credit card share rose from X% to Y%".
6. Transaction frequency — e.g. "N transactions vs M last month, average ticket ₹X".

Rules:
- Always 3 to 4 insight objects. Each must use real numbers from the input — no rounding to round numbers, no invented merchants.
- "kind" must be one of: category, merchant, payment, frequency, new.
- "subject" must be a real value present in the input (a category name, merchant name, or payment-method name) so it can be used as a search filter. Empty string for frequency-kind insights.
- In "detail" and "takeaway", wrap every numeric figure (amounts, percentages, counts) in **double asterisks** so the client can render them bold. Example: "Food jumped to **₹13,202** across **31** transactions — **36%** of total spend."
- Use the currency symbol of baseCurrency (₹ for INR, $ for USD, € for EUR, £ for GBP). Plain numbers in numeric fields.
- No emojis. No markdown other than the bold-number convention. No moralizing. Direct, second-person.
- Takeaway must be specific and tied to one of the insights (e.g. "Cap food merchant visits at **20** next month — that alone would save ~**₹2,500**").
- If the user spent zero this month, return one insight (kind "frequency") noting that and an upbeat takeaway.
- Output JSON ONLY. No leading/trailing text.`;

const SYSTEM_PROMPT_YEAR = `You are a sharp personal finance coach embedded in Novira. The user just finished a full calendar year of spending. You'll receive a JSON payload covering the entire year vs the previous year — totals, category breakdowns, top merchants, payment-method splits, plus per-month totals so you can spot peaks and seasonal patterns.

You MUST respond with a single JSON object — no markdown fences, no prose outside the JSON — matching this shape exactly:

{
  "headline": "<one short sentence with total spent and direction vs last year, ≤14 words>",
  "totalSpent": <number, this year's total in base currency>,
  "previousTotal": <number, prior year's total in base currency>,
  "changePercent": <number, signed % change vs prior year; 0 if prior was 0>,
  "transactionCount": <number, this year's transaction count from the input>,
  "insights": [
    {
      "label": "<2–3 word title>",
      "kind": "<category|merchant|payment|frequency|new>",
      "subject": "<lowercase exact value from the data — category name, merchant name, payment-method name, or empty string>",
      "detail": "<one concrete sentence with specific numbers, ≤20 words>"
    }
  ],
  "takeaway": "<one practical, specific suggestion grounded in the data, ≤24 words>"
}

What to analyze (pick the 4 most striking insights):
1. Biggest category by total — share of yearly spend.
2. Highest-spending month — name the month, the amount, and what drove it.
3. Notable yearly trend — e.g. category that grew most month-over-month, or one that disappeared.
4. Top merchant of the year — visits + total.
5. Payment-method mix shift across the year, if meaningful.

Same formatting rules as the monthly recap: 4 insight objects, real numbers from input, **bold** every figure, currency symbol of baseCurrency, no emojis/markdown/moralizing. JSON only.`;

const YEAR_RE = /^\d{4}-FY$/;
export const VALID_PERIOD_RE = /^\d{4}(-\d{2}|-FY)$/;

export function isYearKey(s: string) { return YEAR_RE.test(s); }
export function yearOf(s: string) { return Number(s.slice(0, 4)); }

export function monthRange(month: string) {
    const [y, m] = month.split('-').map(Number);
    if (!y || !m || m < 1 || m > 12) return null;
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 0));
    return {
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10)
    };
}

export function yearRange(year: number) {
    if (!year || year < 1900 || year > 9999) return null;
    return {
        start: `${year}-01-01`,
        end: `${year}-12-31`
    };
}

export function previousMonth(month: string) {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 2, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function previousPeriod(period: string) {
    return isYearKey(period) ? `${yearOf(period) - 1}-FY` : previousMonth(period);
}

function aggregate(txs: TxRow[], userId: string, baseCurrency: string, liveRates: Map<string, number>) {
    const byCategory = new Map<string, CategoryAgg>();
    const byPayment = new Map<string, number>();
    const byMerchant = new Map<string, MerchantAgg>();
    let total = 0;

    for (const tx of txs) {
        let myShare = Number(tx.amount);
        if (tx.splits && tx.splits.length > 0) {
            if (tx.user_id === userId) {
                const othersOwe = tx.splits.reduce((s, x) => s + Number(x.amount), 0);
                myShare = Number(tx.amount) - othersOwe;
            } else {
                const mySplit = tx.splits.find(s => s.user_id === userId);
                myShare = mySplit ? Number(mySplit.amount) : 0;
            }
        } else if (tx.user_id !== userId) {
            myShare = 0;
        }
        if (myShare <= 0) continue;

        const txCurr = (tx.currency || baseCurrency).toUpperCase();
        const baseCurr = (tx.base_currency || '').toUpperCase();
        const targetBase = baseCurrency.toUpperCase();
        let converted = myShare;
        if (txCurr !== targetBase) {
            if (tx.exchange_rate && baseCurr === targetBase) {
                // Stored rate is already to the user's CURRENT base. Trust it.
                converted = myShare * Number(tx.exchange_rate);
            } else {
                // Either no stored rate, or rate is to an older base currency
                // the user has since changed away from. Prefer a fresh rate;
                // only fall back to stored converted_amount if we couldn't
                // fetch anything (the rate map is empty without an API key).
                const liveRate = liveRates.get(`${txCurr}->${targetBase}`);
                if (liveRate !== undefined) {
                    converted = myShare * liveRate;
                } else if (tx.converted_amount && tx.amount) {
                    converted = myShare * (Number(tx.converted_amount) / Number(tx.amount));
                }
            }
        }

        total += converted;

        const cat = tx.category.toLowerCase();
        const ca = byCategory.get(cat) || { category: cat, total: 0, count: 0 };
        ca.total += converted;
        ca.count += 1;
        byCategory.set(cat, ca);

        const pm = (tx.payment_method || 'other').toLowerCase();
        byPayment.set(pm, (byPayment.get(pm) || 0) + converted);

        if (tx.place_name) {
            const m = byMerchant.get(tx.place_name) || { name: tx.place_name, total: 0, count: 0 };
            m.total += converted;
            m.count += 1;
            byMerchant.set(tx.place_name, m);
        }
    }

    return {
        total,
        categories: Array.from(byCategory.values()).sort((a, b) => b.total - a.total),
        payments: Array.from(byPayment.entries()).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total),
        merchants: Array.from(byMerchant.values()).sort((a, b) => b.total - a.total).slice(0, 10),
        count: txs.filter(tx => {
            if (tx.user_id !== userId && !(tx.splits || []).some(s => s.user_id === userId)) return false;
            return true;
        }).length
    };
}

function extractJson(raw: string): unknown {
    if (!raw) return null;
    let s = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    const first = s.indexOf('{');
    const last = s.lastIndexOf('}');
    if (first !== -1 && last !== -1 && last > first) {
        s = s.slice(first, last + 1);
    }
    try {
        return JSON.parse(s);
    } catch {
        return null;
    }
}

export interface RecapInsight {
    label: string;
    kind?: string;
    subject?: string;
    detail: string;
}

export interface RecapShape {
    headline: string;
    totalSpent: number;
    previousTotal: number;
    changePercent: number;
    transactionCount?: number;
    insights: RecapInsight[];
    takeaway: string;
}

export interface RecapAnalyzed {
    transactions: number;
    categories: number;
    merchants: number;
    paymentMethods: number;
    comparedToMonth: string;
}

function isValidRecap(v: unknown): v is RecapShape {
    if (!v || typeof v !== 'object') return false;
    const o = v as Record<string, unknown>;
    return typeof o.headline === 'string'
        && typeof o.takeaway === 'string'
        && Array.isArray(o.insights)
        && (o.insights as unknown[]).every(
            (i) => i && typeof i === 'object'
                && typeof (i as Record<string, unknown>).label === 'string'
                && typeof (i as Record<string, unknown>).detail === 'string'
        );
}

export async function generateRecap(
    supabase: SupabaseClient,
    userId: string,
    period: string,
    baseCurrencyInput: string
): Promise<{ recap: RecapShape; analyzed: RecapAnalyzed }> {
    const baseCurrency = baseCurrencyInput.toUpperCase();
    const isYear = isYearKey(period);
    const range = isYear ? yearRange(yearOf(period)) : monthRange(period);
    if (!range) throw new Error('Invalid period');
    const prev = previousPeriod(period);
    const prevRange = isYear ? yearRange(yearOf(period) - 1) : monthRange(prev);
    if (!prevRange) throw new Error('Invalid previous period');

    const fetchRange = async (start: string, end: string) => {
        const { data, error } = await supabase
            .from('transactions')
            .select('amount, category, payment_method, date, place_name, description, user_id, currency, exchange_rate, base_currency, converted_amount, splits(user_id, amount)')
            .gte('date', start)
            .lte('date', end)
            .eq('is_settlement', false)
            .returns<TxRow[]>();
        if (error) throw error;
        return data || [];
    };

    const [current, previous] = await Promise.all([
        fetchRange(range.start, range.end),
        fetchRange(prevRange.start, prevRange.end)
    ]);

    // Collect every distinct tx currency where the stored base_currency
    // differs from the user's CURRENT base. Those rows' stored exchange_rate
    // points to an old base; fetch fresh rates so the recap doesn't drift.
    const targetBase = baseCurrency.toUpperCase();
    const mismatchedCurrencies = new Set<string>();
    for (const tx of [...current, ...previous]) {
        const txCurr = (tx.currency || baseCurrency).toUpperCase();
        const txBase = (tx.base_currency || '').toUpperCase();
        if (txCurr !== targetBase && txBase !== targetBase) {
            mismatchedCurrencies.add(txCurr);
        }
    }
    const liveRates = mismatchedCurrencies.size > 0
        ? await getServerRatesMap(
            [...mismatchedCurrencies].map(from => ({ from, to: targetBase })),
          )
        : new Map<string, number>();

    const currentAgg = aggregate(current, userId, baseCurrency, liveRates);
    const prevAgg = aggregate(previous, userId, baseCurrency, liveRates);

    const analyzed: RecapAnalyzed = {
        transactions: currentAgg.count,
        categories: currentAgg.categories.length,
        merchants: currentAgg.merchants.length,
        paymentMethods: currentAgg.payments.length,
        comparedToMonth: prev
    };

    if (currentAgg.count === 0) {
        const periodWord = isYear ? 'year' : 'month';
        const recap: RecapShape = {
            headline: `No spending logged for ${period}.`,
            totalSpent: 0,
            previousTotal: prevAgg.total,
            changePercent: 0,
            transactionCount: 0,
            insights: [
                { label: 'No activity', kind: 'frequency', subject: '', detail: `No transactions were recorded this ${periodWord}.` }
            ],
            takeaway: 'Log a few expenses and your next recap will spot the patterns.'
        };
        await supabase.from('monthly_recaps').upsert({
            user_id: userId, month: period, recap, analyzed
        }, { onConflict: 'user_id,month' });
        return { recap, analyzed };
    }

    let byMonth: { month: string; total: number; count: number }[] | undefined;
    if (isYear) {
        const buckets = new Map<string, TxRow[]>();
        for (const tx of current) {
            const monthKey = tx.date.slice(0, 7);
            const arr = buckets.get(monthKey) || [];
            arr.push(tx);
            buckets.set(monthKey, arr);
        }
        byMonth = Array.from(buckets.entries())
            .map(([m, slice]) => {
                const agg = aggregate(slice, userId, baseCurrency, liveRates);
                return { month: m, total: Math.round(agg.total * 100) / 100, count: agg.count };
            })
            .sort((a, b) => a.month.localeCompare(b.month));
    }

    const userBlock = JSON.stringify({
        period,
        previousPeriod: prev,
        kind: isYear ? 'year' : 'month',
        baseCurrency,
        current: {
            totalSpent: Math.round(currentAgg.total * 100) / 100,
            transactionCount: currentAgg.count,
            byCategory: currentAgg.categories.map(c => ({
                name: c.category,
                total: Math.round(c.total * 100) / 100,
                count: c.count
            })),
            topMerchants: currentAgg.merchants.map(m => ({
                name: m.name,
                total: Math.round(m.total * 100) / 100,
                count: m.count
            })),
            byPaymentMethod: currentAgg.payments.map(p => ({
                name: p.name,
                total: Math.round(p.total * 100) / 100
            })),
            ...(byMonth ? { byMonth } : {})
        },
        previous: {
            totalSpent: Math.round(prevAgg.total * 100) / 100,
            transactionCount: prevAgg.count,
            byCategory: prevAgg.categories.map(c => ({
                name: c.category,
                total: Math.round(c.total * 100) / 100
            }))
        }
    });

    const message = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: isYear ? 1400 : 1000,
        system: [
            {
                type: 'text',
                text: isYear ? SYSTEM_PROMPT_YEAR : SYSTEM_PROMPT_MONTH,
                cache_control: { type: 'ephemeral' }
            }
        ],
        messages: [
            {
                role: 'user',
                content: `Here are the aggregates as JSON:\n${userBlock}\n\nWrite the recap.`
            }
        ]
    });

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '';
    const parsed = extractJson(text);

    const recap: RecapShape = isValidRecap(parsed) ? parsed : {
        headline: `You spent ${baseCurrency} ${Math.round(currentAgg.total).toLocaleString()} in ${period}.`,
        totalSpent: currentAgg.total,
        previousTotal: prevAgg.total,
        changePercent: prevAgg.total > 0 ? ((currentAgg.total - prevAgg.total) / prevAgg.total) * 100 : 0,
        transactionCount: currentAgg.count,
        insights: [{ label: 'Summary', kind: 'category', subject: '', detail: 'Recap could not be generated from the model output.' }],
        takeaway: 'Try regenerating, or check the breakdown below for category-level detail.'
    };

    await supabase.from('monthly_recaps').upsert({
        user_id: userId, month: period, recap, analyzed
    }, { onConflict: 'user_id,month' });

    return { recap, analyzed };
}
