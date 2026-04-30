import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/utils/supabase/server';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface TxRow {
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

const SYSTEM_PROMPT = `You are a friendly, sharp personal finance coach embedded in Novira. The user just finished a calendar month of spending; you'll receive aggregated stats — totals, category breakdowns, payment-method splits, top merchants, and a comparison to the previous month.

Write a short recap (3 short paragraphs, max ~120 words total) that:
1. Opens with the headline number (total spent, currency-formatted) and how it compares to the previous month — call out the % change directionally and concretely.
2. Highlights one or two notable category shifts (biggest mover up or down) with a specific number, not vague language.
3. Ends with one practical, actionable suggestion based on the patterns you see — not generic advice.

Style rules:
- Conversational, second-person ("you spent...", "you cut...").
- Use the actual currency symbol provided. Do not invent merchants or values not in the data.
- No emojis. No bullet lists. No markdown headers. Plain prose.
- Don't moralize. Don't use phrases like "you should consider" or "it might be wise to".
- If a category is brand-new vs the prior month, mention it. If the user spent zero, say so cheerfully.`;

function aggregate(txs: TxRow[], userId: string, baseCurrency: string) {
    const byCategory = new Map<string, CategoryAgg>();
    const byPayment = new Map<string, number>();
    const byMerchant = new Map<string, MerchantAgg>();
    let total = 0;

    for (const tx of txs) {
        // User's share (matches dashboard logic)
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

        // Convert to base currency using stored exchange_rate when available
        const txCurr = (tx.currency || baseCurrency).toUpperCase();
        const baseCurr = (tx.base_currency || '').toUpperCase();
        let converted = myShare;
        if (txCurr !== baseCurrency.toUpperCase()) {
            if (tx.exchange_rate && baseCurr === baseCurrency.toUpperCase()) {
                converted = myShare * Number(tx.exchange_rate);
            } else if (tx.converted_amount && tx.amount) {
                converted = myShare * (Number(tx.converted_amount) / Number(tx.amount));
            }
            // If no rate available, fall through — already in base
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

function monthRange(month: string) {
    // month = "YYYY-MM"
    const [y, m] = month.split('-').map(Number);
    if (!y || !m || m < 1 || m > 12) return null;
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 0)); // last day of the month
    return {
        start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10)
    };
}

function previousMonth(month: string) {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 2, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export async function POST(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { month, currency } = (await req.json()) as { month?: string; currency?: string };
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return NextResponse.json({ error: 'month must be YYYY-MM' }, { status: 400 });
    }
    const baseCurrency = (currency || 'USD').toUpperCase();

    const range = monthRange(month);
    if (!range) return NextResponse.json({ error: 'Invalid month' }, { status: 400 });
    const prev = previousMonth(month);
    const prevRange = monthRange(prev);
    if (!prevRange) return NextResponse.json({ error: 'Invalid month' }, { status: 400 });

    const fetchMonth = async (start: string, end: string) => {
        const { data, error } = await supabase
            .from('transactions')
            .select('amount, category, payment_method, date, place_name, description, user_id, currency, exchange_rate, base_currency, converted_amount, splits(user_id, amount)')
            .gte('date', start)
            .lte('date', end)
            .returns<TxRow[]>();
        if (error) throw error;
        return data || [];
    };

    let current: TxRow[] = [];
    let previous: TxRow[] = [];
    try {
        [current, previous] = await Promise.all([
            fetchMonth(range.start, range.end),
            fetchMonth(prevRange.start, prevRange.end)
        ]);
    } catch (err: unknown) {
        console.error('[recap] fetch failed', err);
        const msg = err instanceof Error ? err.message : 'Fetch failed';
        return NextResponse.json({ error: msg }, { status: 500 });
    }

    const currentAgg = aggregate(current, user.id, baseCurrency);
    const prevAgg = aggregate(previous, user.id, baseCurrency);

    if (currentAgg.count === 0) {
        return NextResponse.json({
            recap: `No transactions recorded for ${month}. Add some expenses and check back at the end of the month for your recap.`,
            stats: { current: currentAgg, previous: prevAgg }
        });
    }

    const userBlock = JSON.stringify({
        month,
        previousMonth: prev,
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
            }))
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

    try {
        const message = await client.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 400,
            system: [
                {
                    type: 'text',
                    text: SYSTEM_PROMPT,
                    cache_control: { type: 'ephemeral' }
                }
            ],
            messages: [
                {
                    role: 'user',
                    content: `Here are this month's aggregates as JSON:\n${userBlock}\n\nWrite the recap.`
                }
            ]
        });

        const text = message.content[0].type === 'text' ? message.content[0].text.trim() : '';
        return NextResponse.json({
            recap: text,
            stats: { current: currentAgg, previous: prevAgg }
        });
    } catch (err: unknown) {
        console.error('[recap] Claude call failed', err);
        const msg = err instanceof Error ? err.message : 'Recap generation failed';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
