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
    last_midmonth_compared_month: string | null;
}

interface TxRow {
    user_id: string;
    amount: number;
    currency: string | null;
    exchange_rate: number | null;
    base_currency: string | null;
    date: string;
}

function ymd(d: Date): string { return d.toISOString().slice(0, 10); }

export async function GET(request: NextRequest) {
    const denied = authorizeCron(request);
    if (denied) return denied;
    const supabase = getServiceSupabase();
    if (supabase instanceof NextResponse) return supabase;

    const now = new Date();
    const monthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const dayOfMonth = now.getUTCDate();

    const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const thisMonthCutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), dayOfMonth));
    const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const lastMonthCutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, dayOfMonth));

    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, currency, last_midmonth_compared_month')
        .returns<ProfileRow[]>();
    if (!profiles?.length) return NextResponse.json({ scanned: 0, notified: 0 });

    const eligible = profiles.filter(p => p.last_midmonth_compared_month !== monthKey);
    if (!eligible.length) return NextResponse.json({ scanned: profiles.length, notified: 0 });

    const { data: txs } = await supabase
        .from('transactions')
        .select('user_id, amount, currency, exchange_rate, base_currency, date')
        .in('user_id', eligible.map(p => p.id))
        .gte('date', ymd(lastMonthStart))
        .lte('date', ymd(thisMonthCutoff))
        .eq('exclude_from_allowance', false)
        .eq('is_settlement', false)
        .eq('is_income', false)
        .eq('is_transfer', false)
        .returns<TxRow[]>();

    interface Hit { profile: ProfileRow; thisMtd: number; lastMtd: number; deltaPct: number; }
    const hits: Hit[] = [];

    for (const p of eligible) {
        const ccy = (p.currency || 'USD').toUpperCase();
        let thisMtd = 0; let lastMtd = 0;
        for (const tx of txs || []) {
            if (tx.user_id !== p.id) continue;
            const txCcy = (tx.currency || 'USD').toUpperCase();
            let amt = Number(tx.amount);
            if (txCcy !== ccy) {
                if (tx.exchange_rate && (tx.base_currency || '').toUpperCase() === ccy) {
                    amt = amt * Number(tx.exchange_rate);
                } else continue;
            }
            const d = tx.date;
            if (d >= ymd(thisMonthStart) && d <= ymd(thisMonthCutoff)) thisMtd += amt;
            else if (d >= ymd(lastMonthStart) && d <= ymd(lastMonthCutoff)) lastMtd += amt;
        }
        if (lastMtd <= 0) continue;
        const deltaPct = ((thisMtd - lastMtd) / lastMtd) * 100;
        if (Math.abs(deltaPct) < 10) continue;
        hits.push({ profile: p, thisMtd, lastMtd, deltaPct });
    }

    if (!hits.length) return NextResponse.json({ scanned: profiles.length, notified: 0 });

    const subsByUser = await loadSubsByUser(supabase, hits.map(h => h.profile.id));
    const expired: string[] = [];
    let pushSent = 0;

    for (const h of hits) {
        const ccy = (h.profile.currency || 'USD').toUpperCase();
        const ahead = h.deltaPct > 0;
        const sent = await sendToUser(supabase, subsByUser, h.profile.id, {
            title: ahead ? 'Spending ahead of last month' : 'Spending behind last month',
            body: `${fmtMoney(h.thisMtd, ccy)} so far, ${ahead ? '+' : ''}${h.deltaPct.toFixed(0)}% vs same window.`,
            url: '/analytics',
        }, expired);
        pushSent += sent;
        if (sent > 0) {
            await supabase.from('profiles').update({ last_midmonth_compared_month: monthKey }).eq('id', h.profile.id);
        }
    }

    await cleanupExpired(supabase, expired);
    return NextResponse.json({ scanned: profiles.length, notified: hits.length, pushSent });
}
