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
    last_allowance_reset_month: string | null;
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
    const thisMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const lastMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
    const lastMonthLabel = lastMonthStart.toLocaleString('en-US', { month: 'long', timeZone: 'UTC' });

    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, currency, budgets, last_allowance_reset_month')
        .returns<ProfileRow[]>();
    if (!profiles?.length) return NextResponse.json({ scanned: 0, notified: 0 });

    const eligible = profiles.filter(p => {
        if (p.last_allowance_reset_month === thisMonth) return false;
        const ccy = (p.currency || 'USD').toUpperCase();
        const budget = Number(p.budgets?.[ccy] || 0);
        return budget > 0;
    });
    if (!eligible.length) return NextResponse.json({ scanned: profiles.length, notified: 0 });

    const { data: txs } = await supabase
        .from('transactions')
        .select('user_id, amount, currency, exchange_rate, base_currency, exclude_from_allowance')
        .in('user_id', eligible.map(p => p.id))
        .gte('date', ymd(lastMonthStart))
        .lte('date', ymd(lastMonthEnd))
        .returns<TxRow[]>();

    const subsByUser = await loadSubsByUser(supabase, eligible.map(p => p.id));
    const expired: string[] = [];
    let pushSent = 0;

    for (const p of eligible) {
        const ccy = (p.currency || 'USD').toUpperCase();
        const budget = Number(p.budgets?.[ccy] || 0);
        let lastSpent = 0;
        for (const tx of txs || []) {
            if (tx.user_id !== p.id) continue;
            if (tx.exclude_from_allowance) continue;
            const txCcy = (tx.currency || 'USD').toUpperCase();
            let amt = Number(tx.amount);
            if (txCcy !== ccy) {
                if (tx.exchange_rate && (tx.base_currency || '').toUpperCase() === ccy) {
                    amt = amt * Number(tx.exchange_rate);
                } else continue;
            }
            lastSpent += amt;
        }

        const sent = await sendToUser(supabase, subsByUser, p.id, {
            title: 'Allowance reset',
            body: `${fmtMoney(budget, ccy)} for the new month. ${lastMonthLabel}: ${fmtMoney(lastSpent, ccy)}.`,
            url: '/dashboard',
        }, expired);
        pushSent += sent;
        if (sent > 0) {
            await supabase.from('profiles').update({ last_allowance_reset_month: thisMonth }).eq('id', p.id);
        }
    }

    await cleanupExpired(supabase, expired);
    return NextResponse.json({ scanned: profiles.length, notified: eligible.length, pushSent });
}
