import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export type SnapshotRange =
    | { kind: 'preset'; value: '1M' | 'LM' | '3M' | '6M' | '1Y' | 'ALL' }
    | { kind: 'custom'; from: string; to: string };

interface TxRow {
    id: string;
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
    is_recurring: boolean | null;
    tags: string[] | null;
    bucket_id: string | null;
    splits?: { user_id: string; amount: number }[];
}

function shareOf(tx: TxRow, userId: string): number {
    if (tx.splits && tx.splits.length > 0) {
        if (tx.user_id === userId) {
            const othersOwe = tx.splits.reduce((s, x) => s + Number(x.amount), 0);
            return Number(tx.amount) - othersOwe;
        }
        const mine = tx.splits.find(s => s.user_id === userId);
        return mine ? Number(mine.amount) : 0;
    }
    if (tx.user_id !== userId) return 0;
    return Number(tx.amount);
}

function convert(tx: TxRow, share: number, baseCurrency: string): number {
    const txCurr = (tx.currency || baseCurrency).toUpperCase();
    if (txCurr === baseCurrency.toUpperCase()) return share;
    const baseCurr = (tx.base_currency || '').toUpperCase();
    if (tx.exchange_rate && baseCurr === baseCurrency.toUpperCase()) {
        return share * Number(tx.exchange_rate);
    }
    if (tx.converted_amount && tx.amount) {
        return share * (Number(tx.converted_amount) / Number(tx.amount));
    }
    return share;
}

function resolveRange(range: SnapshotRange): { start: string | null; end: string | null; label: string } {
    const today = new Date();
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
    const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const subMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() - n, 1);
    const subYears = (d: Date, n: number) => new Date(d.getFullYear() - n, d.getMonth(), 1);

    if (range.kind === 'custom') {
        return { start: range.from, end: range.to, label: `${range.from} to ${range.to}` };
    }
    switch (range.value) {
        case '1M':
            return { start: fmt(startOfMonth(today)), end: fmt(today), label: 'this month' };
        case 'LM': {
            const lm = subMonths(today, 1);
            return { start: fmt(lm), end: fmt(endOfMonth(lm)), label: 'last month' };
        }
        case '3M':
            return { start: fmt(subMonths(today, 2)), end: fmt(today), label: 'last 3 months' };
        case '6M':
            return { start: fmt(subMonths(today, 5)), end: fmt(today), label: 'last 6 months' };
        case '1Y':
            return { start: fmt(subYears(today, 1)), end: fmt(today), label: 'last 12 months' };
        case 'ALL':
            return { start: null, end: null, label: 'all time' };
    }
}

export interface InsightsSnapshot {
    period: string;
    baseCurrency: string;
    totalSpent: number;
    txCount: number;
    byCategory: { category: string; total: number; count: number }[];
    byMerchant: { name: string; total: number; count: number }[];
    byPaymentMethod: { method: string; total: number; count: number }[];
    byTag: { tag: string; total: number; count: number }[];
    byDay: { date: string; total: number }[];
    recurringTotal: number;
    discretionaryTotal: number;
    sample: Array<{
        date: string;
        amount: number;
        category: string;
        description: string;
        place_name: string | null;
        is_recurring: boolean;
    }>;
}

export async function buildInsightsSnapshot(
    supabase: SupabaseClient,
    userId: string,
    opts: { range: SnapshotRange; baseCurrency: string; bucketId?: string | null }
): Promise<InsightsSnapshot> {
    const baseCurrency = (opts.baseCurrency || 'USD').toUpperCase();
    const { start, end, label } = resolveRange(opts.range);

    // RLS filters down to transactions the user is allowed to see (own + group + split-of).
    // shareOf() computes the user's per-tx amount below.
    let q = supabase
        .from('transactions')
        .select('id, amount, category, payment_method, date, place_name, description, user_id, currency, exchange_rate, base_currency, converted_amount, is_recurring, tags, bucket_id, splits(user_id, amount)')
        .eq('is_settlement', false)
        .order('date', { ascending: false })
        .limit(2000);

    if (start) q = q.gte('date', start);
    if (end) q = q.lte('date', end);
    if (opts.bucketId) q = q.eq('bucket_id', opts.bucketId);

    const { data, error } = await q.returns<TxRow[]>();
    if (error) throw error;
    const txs = data || [];

    const byCategory = new Map<string, { total: number; count: number }>();
    const byMerchant = new Map<string, { total: number; count: number }>();
    const byPayment = new Map<string, { total: number; count: number }>();
    const byTag = new Map<string, { total: number; count: number }>();
    const byDay = new Map<string, number>();
    let totalSpent = 0;
    let txCount = 0;
    let recurringTotal = 0;
    let discretionaryTotal = 0;
    const sample: InsightsSnapshot['sample'] = [];

    for (const tx of txs) {
        const share = shareOf(tx, userId);
        if (share <= 0) continue;
        const amt = convert(tx, share, baseCurrency);

        totalSpent += amt;
        txCount += 1;

        const cat = (tx.category || 'other').toLowerCase();
        const c = byCategory.get(cat) || { total: 0, count: 0 };
        c.total += amt; c.count += 1; byCategory.set(cat, c);

        if (tx.place_name) {
            const m = byMerchant.get(tx.place_name) || { total: 0, count: 0 };
            m.total += amt; m.count += 1; byMerchant.set(tx.place_name, m);
        }

        const pm = (tx.payment_method || 'other').toLowerCase();
        const p = byPayment.get(pm) || { total: 0, count: 0 };
        p.total += amt; p.count += 1; byPayment.set(pm, p);

        for (const t of tx.tags || []) {
            if (!t) continue;
            const tg = byTag.get(t) || { total: 0, count: 0 };
            tg.total += amt; tg.count += 1; byTag.set(t, tg);
        }

        const dayKey = tx.date.slice(0, 10);
        byDay.set(dayKey, (byDay.get(dayKey) || 0) + amt);

        if (tx.is_recurring) recurringTotal += amt;
        else discretionaryTotal += amt;

        if (sample.length < 50) {
            sample.push({
                date: dayKey,
                amount: Math.round(amt * 100) / 100,
                category: cat,
                description: tx.description,
                place_name: tx.place_name,
                is_recurring: !!tx.is_recurring,
            });
        }
    }

    const round = (n: number) => Math.round(n * 100) / 100;
    return {
        period: label,
        baseCurrency,
        totalSpent: round(totalSpent),
        txCount,
        byCategory: Array.from(byCategory.entries())
            .map(([category, v]) => ({ category, total: round(v.total), count: v.count }))
            .sort((a, b) => b.total - a.total),
        byMerchant: Array.from(byMerchant.entries())
            .map(([name, v]) => ({ name, total: round(v.total), count: v.count }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 20),
        byPaymentMethod: Array.from(byPayment.entries())
            .map(([method, v]) => ({ method, total: round(v.total), count: v.count }))
            .sort((a, b) => b.total - a.total),
        byTag: Array.from(byTag.entries())
            .map(([tag, v]) => ({ tag, total: round(v.total), count: v.count }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 30),
        byDay: Array.from(byDay.entries())
            .map(([date, total]) => ({ date, total: round(total) }))
            .sort((a, b) => a.date.localeCompare(b.date)),
        recurringTotal: round(recurringTotal),
        discretionaryTotal: round(discretionaryTotal),
        sample,
    };
}
