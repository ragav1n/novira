import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
// JSON Schema rather than zod: the SDK's `zodOutputFormat` converts through
// zod/v4, and this project is still on zod 3's v3 surface.
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';
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

// The response shape is enforced by the API against this schema, so both
// prompts below carry only the writing rules — no shape block, no "reply with
// JSON only" instruction. Shared by the monthly and yearly runs; the per-period
// length limits stay in the prompts, since a schema can't express them.
const RECAP_SCHEMA = {
    type: 'object',
    properties: {
        headline: {
            type: 'string',
            description: 'One sentence on what the period looked like and which way it moved.',
        },
        insights: {
            type: 'array',
            description: 'The 3–4 most useful insights, each covering a different angle.',
            items: {
                type: 'object',
                properties: {
                    label: { type: 'string', description: 'A 2–3 word title for the insight.' },
                    kind: {
                        type: 'string',
                        enum: ['category', 'merchant', 'payment', 'frequency', 'new'],
                        description: 'Which kind of insight this is.',
                    },
                    subject: {
                        type: 'string',
                        description: 'The category, merchant, or payment-method name this insight is about, lowercased and copied verbatim from the payload. Empty string when kind is frequency.',
                    },
                    detail: {
                        type: 'string',
                        description: 'One sentence carrying the specific numbers behind the insight.',
                    },
                },
                required: ['label', 'kind', 'subject', 'detail'],
                additionalProperties: false,
            },
        },
        takeaway: {
            type: 'string',
            description: 'One specific, doable suggestion tied to one of the insights.',
        },
    },
    required: ['headline', 'insights', 'takeaway'],
    additionalProperties: false,
} as const;

// `transform: false` sends the schema verbatim. The SDK's default transform
// keeps only an allowlist of keywords and folds the rest into the description —
// `enum` is not on that list, so the "kind" values would reach the model as a
// prose hint instead of a constraint the API enforces.
const RECAP_FORMAT = jsonSchemaOutputFormat(RECAP_SCHEMA, { transform: false });
type RecapNarrativeRaw = ReturnType<typeof RECAP_FORMAT.parse>;

// Shared by both prompts. The yearly prompt used to say "same rules as the
// monthly recap" — but the model only ever sees one of the two, so those rules
// were never actually delivered on a yearly run.
//
// Every worked example is written in the user's own symbol. They were hardcoded
// with ₹, which is a symbol a small model will copy straight out of an example
// in preference to the "currencySymbol" field further down its payload — and
// the card has no way to tell prose in the wrong currency from prose in the
// right one.
const sharedRules = (sym: string) => `Output rules:
- Every figure you cite must come from the payload. Never invent a merchant, category, or amount, and never round a number to a tidier one.
- Wrap every number in "detail" and "takeaway" — amounts, percentages, counts — in **double asterisks**. The client renders those bold and nothing else. Example: "Food hit **${sym}13,202** across **31** orders — **36%** of everything you spent."
- Every amount is already in the user's currency. Write each one with "${sym}" in front of it and no other currency symbol or code anywhere.
- "subject" must appear verbatim in the payload — a category name, merchant name, or payment-method name, lowercased. It becomes a search filter, so it has to match. Use an empty string when "kind" is "frequency".
- Second person, direct. No emojis, no markdown beyond the bold numbers, no moralising, no praise.
- Every insight should tell the user something the total alone doesn't. Skip anything they can already see on the card.`;

const monthPrompt = (sym: string) => `You are the analyst behind Novira's monthly recap. The user just closed out a calendar month. You get a JSON payload: this month's total and transaction count, every category total and count, top merchants with totals and visit counts, and payment-method splits. The "previous" block covers last month — its total, transaction count, category totals, and payment-method splits, but no merchant detail, so never compare merchants across months.

Length limits: "headline" ≤14 words, each "detail" ≤18 words, "takeaway" ≤24 words.

Pick the 3–4 most useful insights. Variety beats repetition — don't spend two of them on the same category. Candidates:
1. The category that rose most — name it, the amount, and the % change vs last month.
2. The category that fell most.
3. A category that shows up this month and not last month.
4. Merchant concentration — "N visits to X for Y total", or "the top 3 places were Z% of spend".
5. A payment-method shift — "card went from X% to Y% of spend".
6. Frequency and average ticket — "N transactions vs M last month, averaging X each".

Rules:
- Exactly 3 or 4 insight objects.
- The takeaway names a number and an action. Good: "Cap delivery orders at **15** next month — that's about **${sym}2,500** back." Bad: "Consider watching your food spending."
- If this month's total is 0, return a single insight with kind "frequency" saying so, plus an encouraging takeaway.

${sharedRules(sym)}`;

const yearPrompt = (sym: string) => `You are the analyst behind Novira's yearly recap. The user just closed out a calendar year. You get a JSON payload covering the whole year — totals, category breakdowns, top merchants, payment-method splits, plus per-month totals in "byMonth" so you can see peaks and seasonality. The "previous" block covers last year — its total, transaction count, category totals, and payment-method splits, but no merchant detail, so never compare merchants across years.

Length limits: "headline" ≤14 words, each "detail" ≤20 words, "takeaway" ≤24 words.

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

${sharedRules(sym)}`;

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
    let unconverted = 0;

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
                    // A stored ratio only converts into the base that was current
                    // when the row was written. Against any other base it is the
                    // wrong number, and where the two currencies matched it is a
                    // 1:1 no-op — which is how a rupee total reaches the card
                    // looking like a plausible dollar one.
                    if (baseCurr !== targetBase) unconverted += 1;
                } else {
                    unconverted += 1;
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
        unconverted,
        categories: Array.from(byCategory.values()).sort((a, b) => b.total - a.total),
        payments: Array.from(byPayment.entries()).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total),
        merchants: Array.from(byMerchant.values()).sort((a, b) => b.total - a.total).slice(0, 10),
        count: txs.filter(tx => {
            if (tx.user_id !== userId && !(tx.splits || []).some(s => s.user_id === userId)) return false;
            return true;
        }).length
    };
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
    /**
     * The base currency every figure here was converted into. The model also
     * writes this currency's symbol into the prose, so a stored recap can only
     * be rendered in this currency — reformatting the total against whatever
     * the user prefers today puts a "$" in front of a rupee figure.
     */
    currency: string;
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

const MAX_INSIGHTS = 4;

/**
 * The schema guarantees the keys, their types, and that "kind" is one of the
 * five the card knows how to render. What it can't say is "non-empty" or "at
 * most four" — a blank detail line or eight insights would still render as a
 * wall of half-filled rows, so those are enforced here.
 */
function readNarrative(v: RecapNarrativeRaw): RecapNarrative | null {
    const headline = v.headline.trim();
    const takeaway = v.takeaway.trim();
    if (!headline || !takeaway) return null;

    const insights: RecapInsight[] = [];
    for (const i of v.insights) {
        const label = i.label.trim();
        const detail = i.detail.trim();
        if (!label || !detail) continue;
        insights.push({
            label,
            kind: i.kind,
            // Drives the search drill-down, so it has to be a clean match.
            subject: i.subject.trim().toLowerCase(),
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
    const symbol = currencySymbol(baseCurrency);
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

    // Silent until now: with no rate reachable, a foreign row goes into the total
    // at face value and the result is a wrong-by-an-order-of-magnitude figure that
    // looks entirely reasonable on the card. Usually a missing EXCHANGERATE_API_KEY.
    if (currentAgg.unconverted > 0 || prevAgg.unconverted > 0) {
        console.error('[recap] rows counted without a usable exchange rate', {
            period,
            baseCurrency,
            currentRows: currentAgg.unconverted,
            previousRows: prevAgg.unconverted,
            currencies: [...mismatchedCurrencies],
        });
    }

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
            currency: baseCurrency,
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
        currencySymbol: symbol,
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
            })),
            // Both prompts offer a payment-method shift as an insight; without
            // this the model had no prior-period share to compare against and
            // invented one.
            byPaymentMethod: prevAgg.payments.map(p => ({
                name: p.name,
                total: Math.round(p.total * 100) / 100
            }))
        }
    });

    let parsed: RecapNarrative | null = null;
    try {
        const message = await client.messages.parse({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: isYear ? 1400 : 1000,
            system: [
                {
                    type: 'text',
                    text: isYear ? yearPrompt(symbol) : monthPrompt(symbol),
                    cache_control: { type: 'ephemeral' }
                }
            ],
            output_config: { format: RECAP_FORMAT },
            messages: [
                {
                    role: 'user',
                    content: `Here are the aggregates as JSON:\n${userBlock}\n\nWrite the recap.`
                }
            ]
        });
        if (message.parsed_output) parsed = readNarrative(message.parsed_output);
    } catch (err) {
        // A schema-shaped response can still fail to parse — hitting max_tokens
        // truncates the JSON mid-object. That degrades to the aggregate-built
        // narrative below rather than failing the request. A transport or
        // rate-limit failure is a real outage and keeps propagating.
        if (err instanceof Anthropic.APIError) throw err;
        console.error('[recap] structured output parse failed', err);
    }

    const narrative = parsed ?? fallbackNarrative(currentAgg, baseCurrency, isYear ? 'year' : 'month');

    // The headline figures are what the card renders largest, so they come
    // straight from the aggregates. Asking the model to echo them back only
    // created a path for the most prominent number on screen to be wrong.
    const recap: RecapShape = {
        ...narrative,
        currency: baseCurrency,
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
