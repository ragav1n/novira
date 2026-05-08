import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import {
    authorizeCron,
    getServiceSupabase,
    loadSubsByUser,
    sendToUser,
    cleanupExpired,
    fmtMoney,
} from '@/lib/server/push';

interface ProfileRow {
    id: string;
    currency: string | null;
    budgets: Record<string, number> | null;
    last_cashflow_shortfall_at: string | null;
}

interface BillRow {
    user_id: string;
    amount: number;
    currency: string | null;
    next_occurrence: string;
    description: string;
}

interface TxRow {
    user_id: string;
    amount: number;
    currency: string | null;
    exchange_rate: number | null;
    base_currency: string | null;
    exclude_from_allowance: boolean;
}

function ymd(d: Date): string { return d.toISOString().slice(0, 10); }

export async function GET(request: NextRequest) {
    const denied = authorizeCron(request);
    if (denied) return denied;
    const supabase = getServiceSupabase();
    if (supabase instanceof NextResponse) return supabase;

    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    const horizon = new Date(today); horizon.setUTCDate(today.getUTCDate() + 7);
    const horizonClamped = horizon > monthEnd ? monthEnd : horizon;

    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, currency, budgets, last_cashflow_shortfall_at')
        .returns<ProfileRow[]>();
    if (!profiles?.length) return NextResponse.json({ scanned: 0, notified: 0 });

    // Throttle: at most one shortfall push per user per 7 days.
    const eligible = profiles.filter(p => {
        if (!p.last_cashflow_shortfall_at) return true;
        const last = new Date(p.last_cashflow_shortfall_at + 'T00:00:00Z');
        return (today.getTime() - last.getTime()) / 86400000 >= 7;
    });
    const userIds = eligible.map(p => p.id);
    if (!userIds.length) return NextResponse.json({ scanned: profiles.length, notified: 0 });

    const { data: txs } = await supabase
        .from('transactions')
        .select('user_id, amount, currency, exchange_rate, base_currency, exclude_from_allowance')
        .in('user_id', userIds)
        .gte('date', ymd(monthStart))
        .lte('date', ymd(today))
        .eq('is_settlement', false)
        .eq('is_income', false)
        .returns<TxRow[]>();

    const { data: bills } = await supabase
        .from('recurring_templates')
        .select('user_id, amount, currency, next_occurrence, description')
        .in('user_id', userIds)
        .eq('is_active', true)
        .gt('next_occurrence', ymd(today))
        .lte('next_occurrence', ymd(horizonClamped))
        .returns<BillRow[]>();

    interface Hit { profile: ProfileRow; remaining: number; upcoming: number; gap: number; nextBill: BillRow | null; }
    const hits: Hit[] = [];

    for (const p of eligible) {
        const baseCcy = (p.currency || 'USD').toUpperCase();
        const budget = Number(p.budgets?.[baseCcy] || 0);
        if (budget <= 0) continue;

        let spent = 0;
        for (const tx of txs || []) {
            if (tx.user_id !== p.id) continue;
            if (tx.exclude_from_allowance) continue;
            const txCcy = (tx.currency || 'USD').toUpperCase();
            let amt = Number(tx.amount);
            if (txCcy !== baseCcy) {
                if (tx.exchange_rate && (tx.base_currency || '').toUpperCase() === baseCcy) {
                    amt = amt * Number(tx.exchange_rate);
                } else continue;
            }
            spent += amt;
        }
        const remaining = budget - spent;

        let upcoming = 0;
        let nextBill: BillRow | null = null;
        for (const b of bills || []) {
            if (b.user_id !== p.id) continue;
            const bCcy = (b.currency || 'USD').toUpperCase();
            if (bCcy !== baseCcy) continue;
            upcoming += Number(b.amount);
            if (!nextBill || b.next_occurrence < nextBill.next_occurrence) nextBill = b;
        }
        if (upcoming <= 0) continue;

        const gap = upcoming - remaining;
        if (gap > 0) hits.push({ profile: p, remaining, upcoming, gap, nextBill });
    }

    if (!hits.length) return NextResponse.json({ scanned: profiles.length, notified: 0 });

    const subsByUser = await loadSubsByUser(supabase, hits.map(h => h.profile.id));
    const expired: string[] = [];
    let pushSent = 0;

    for (const h of hits) {
        const ccy = (h.profile.currency || 'USD').toUpperCase();
        const billCount = (bills || []).filter(b => b.user_id === h.profile.id && (b.currency || 'USD').toUpperCase() === ccy).length;
        const sent = await sendToUser(supabase, subsByUser, h.profile.id, {
            title: 'Tight week ahead',
            body: `Projected short by ${fmtMoney(h.gap, ccy)} after ${billCount} upcoming bill${billCount === 1 ? '' : 's'}.`,
            url: '/cashflow',
        }, expired, 'event:cash-flow');
        pushSent += sent;
        if (sent > 0) {
            await supabase.from('profiles')
                .update({ last_cashflow_shortfall_at: ymd(today) })
                .eq('id', h.profile.id);
        }
    }

    await cleanupExpired(supabase, expired);
    return NextResponse.json({ scanned: profiles.length, notified: hits.length, pushSent });
}
