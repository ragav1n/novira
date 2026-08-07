import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerRatesMap } from '@/lib/server-exchange-rates';
import { currencySymbol, fmtMoney } from '@/lib/server/currency';

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

// Shared by both prompts. The yearly prompt used to say "same rules as the
// monthly recap" — but the model only ever sees one of the two, so those rules
// were never actually delivered on a yearly run.
const SHARED_RULES = `Output rules:
- Respond with a single JSON object. No markdown fences, no prose before or after it.
- Every figure you cite must come from the payload. Never invent a merchant, category, or amount, and never round a number to a tidier one.
- Wrap every number in "detail" and "takeaway" — amounts, percentages, counts — in **double asterisks**. The client renders those bold and nothing else. Example: "Food hit **₹13,202** across **31** orders — **36%** of everything you spent."
- Write amounts using the "currencySymbol" given in the payload.
- "kind" must be exactly one of: category, merchant, payment, frequency, new.
- "subject" must appear verbatim in the payload — a category name, merchant name, or payment-method name, lowercased. It becomes a search filter, so it has to match. Use an empty string when "kind" is "frequency".
- Second person, direct. No emojis, no markdown beyond the bold numbers, no moralising, no praise.
- Every insight should tell the user something the total alone doesn't. Skip anything they can already see on the card.`;

const SYSTEM_PROMPT_MONTH = `You are the analyst behind Novira's monthly recap. The user just closed out a calendar month. You get a JSON payload: this month's total and transaction count, every category total and count, top merchants with totals and visit counts, payment-method splits, and the same set for the previous month.

Respond with a single JSON object in exactly this shape:

{
  "headline": "<one sentence, ≤14 words: what the month looked like and which way it moved>",
  "insights": [
    {
      "label": "<2–3 word title>",
      "kind": "<category|merchant|payment|frequency|new>",
      "subject": "<lowercase value from the payload; empty string when kind is frequency>",
      "detail": "<one sentence, ≤18 words, carrying the specific numbers>"
    }
  ],
  "takeaway": "<one specific, doable suggestion tied to one of the insights, ≤24 words>"
}

Pick the 3–4 most useful insights. Variety beats repetition — don't spend two of them on the same category. Candidates:
1. The category that rose most — name it, the amount, and the % change vs last month.
2. The category that fell most.
3. A category that shows up this month and not last month.
4. Merchant concentration — "N visits to X for Y total", or "the top 3 places were Z% of spend".
5. A payment-method shift — "card went from X% to Y% of spend".
6. Frequency and average ticket — "N transactions vs M last month, averaging X each".

Rules:
- Exactly 3 or 4 insight objects.
- The takeaway names a number and an action. Good: "Cap delivery orders at **15** next month — that's about **₹2,500** back." Bad: "Consider watching your food spending."
- If this month's total is 0, return a single insight with kind "frequency" saying so, plus an encouraging takeaway.

${SHARED_RULES}`;

const SYSTEM_PROMPT_YEAR = `You are the analyst behind Novira's yearly recap. The user just closed out a calendar year. You get a JSON payload covering the whole year against the previous one — totals, category breakdowns, top merchants, payment-method splits, plus per-month totals in "byMonth" so you can see peaks and seasonality.

Respond with a single JSON object in exactly this shape:

{
  "headline": "<one sentence, ≤14 words: what the year looked like and which way it moved>",
  "insights": [
    {
      "label": "<2–3 word title>",
      "kind": "<category|merchant|payment|frequency|new>",
      "subject": "<lowercase value from the payload; empty string when kind is frequency>",
      "detail": "<one sentence, ≤20 words, carrying the specific numbers>"
    }
  ],
  "takeaway": "<one specific, doable suggestion tied to one of the insights, ≤24 words>"
}

Pick the 4 most striking insights. Candidates:
1. The largest category — total and share of the year's spend.
2. The heaviest month in "byMonth" — name it, the amount, and what drove it.
3. A trend across the year — a category that climbed month over month, or one that stopped.
4. The merchant of the year — visits and total.
5. A payment-method shift across the year, if it's meaningful.

Rules:
- Exactly 4 insight objects.
- The takeaway names a number and an action, not a platitude.
- Prefer a month name ("March") over a month key ("2025-03") in "detail".

${SHARED_RULES}`;

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

/** The prose half of the recap — the only part the model is asked to produce. */
interface RecapNarrative {
    headline: string;
    insights: RecapInsight[];
    takeaway: string;
}

const VALID_KINDS = new Set(['category', 'merchant', 'payment', 'frequency', 'new']);
const MAX_INSIGHTS = 4;

/**
 * Accept the model's prose only if every field the card renders is present and
 * non-empty, then clamp it to what the card is laid out for. A model that
 * returns eight insights or a blank detail line would otherwise render as a
 * wall of half-filled rows.
 */
function readNarrative(v: unknown): RecapNarrative | null {
    if (!v || typeof v !== 'object') return null;
    const o = v as Record<string, unknown>;
    const headline = typeof o.headline === 'string' ? o.headline.trim() : '';
    const takeaway = typeof o.takeaway === 'string' ? o.takeaway.trim() : '';
    if (!headline || !takeaway || !Array.isArray(o.insights)) return null;

    const insights: RecapInsight[] = [];
    for (const raw of o.insights as unknown[]) {
        if (!raw || typeof raw !== 'object') continue;
        const i = raw as Record<string, unknown>;
        const label = typeof i.label === 'string' ? i.label.trim() : '';
        const detail = typeof i.detail === 'string' ? i.detail.trim() : '';
        if (!label || !detail) continue;
        const kind = typeof i.kind === 'string' && VALID_KINDS.has(i.kind) ? i.kind : 'category';
        insights.push({
            label,
            kind,
            // Drives the search drill-down, so it has to be a clean match.
            subject: typeof i.subject === 'string' ? i.subject.trim().toLowerCase() : '',
            detail,
        });
        if (insights.length === MAX_INSIGHTS) break;
    }
    if (insights.length === 0) return null;

    return { headline, insights, takeaway };
}

/**
 * Shown when the model's output is unusable. Built from the aggregates so the
 * card still says something true and specific instead of surfacing an error.
 */
function fallbackNarrative(
    agg: ReturnType<typeof aggregate>,
    baseCurrency: string,
    periodWord: string,
): RecapNarrative {
    const top = agg.categories[0];
    const money = (n: number) => fmtMoney(n, baseCurrency);
    return {
        headline: `You spent ${money(agg.total)} over the ${periodWord}.`,
        insights: top
            ? [{
                label: 'Top category',
                kind: 'category',
                subject: top.category,
                detail: `${top.category.charAt(0).toUpperCase()}${top.category.slice(1)} led at **${money(top.total)}** across **${top.count}** transactions.`,
            }]
            : [{
                label: 'Activity',
                kind: 'frequency',
                subject: '',
                detail: `You logged **${agg.count}** transactions this ${periodWord}.`,
            }],
        takeaway: 'Open the breakdown below for the full category detail.',
    };
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
            // Income posts a positive amount and a transfer's outflow leg is
            // positive too — without these the recap counts both as spending.
            .eq('is_income', false)
            .eq('is_transfer', false)
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
            headline: `Nothing logged this ${periodWord}.`,
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
        // The prompt used to name symbols for four currencies and let the model
        // guess the rest. Novira supports 26.
        currencySymbol: currencySymbol(baseCurrency),
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
    const narrative = readNarrative(extractJson(text))
        ?? fallbackNarrative(currentAgg, baseCurrency, isYear ? 'year' : 'month');

    // The headline figures are what the card renders largest, so they come
    // straight from the aggregates. Asking the model to echo them back only
    // created a path for the most prominent number on screen to be wrong.
    const recap: RecapShape = {
        ...narrative,
        totalSpent: Math.round(currentAgg.total * 100) / 100,
        previousTotal: Math.round(prevAgg.total * 100) / 100,
        changePercent: prevAgg.total > 0
            ? ((currentAgg.total - prevAgg.total) / prevAgg.total) * 100
            : 0,
        transactionCount: currentAgg.count,
    };

    await supabase.from('monthly_recaps').upsert({
        user_id: userId, month: period, recap, analyzed
    }, { onConflict: 'user_id,month' });

    return { recap, analyzed };
}
