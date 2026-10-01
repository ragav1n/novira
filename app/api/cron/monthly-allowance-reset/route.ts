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
import { loadConverter } from '@/lib/server/fx';
import { localDate } from '@/lib/server/local-date';
import { payerShare } from '@/lib/server/spend';

interface ProfileRow {
    id: string;
    currency: string | null;
    monthly_budget: number | null;
    timezone: string | null;
    last_allowance_reset_month: string | null;
}

interface TxRow {
    user_id: string;
    amount: number;
    currency: string | null;
    exchange_rate: number | null;
    base_currency: string | null;
    converted_amount: number | null;
    exclude_from_allowance: boolean;
    splits: { amount: number }[] | null;
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
        .select('id, currency, monthly_budget, timezone, last_allowance_reset_month')
        .returns<ProfileRow[]>();
    if (!profiles?.length) return NextResponse.json({ scanned: 0, notified: 0 });

    // Runs on the 1st and 2nd (UTC). Each user is sent once, when their own
    // calendar has reached the new month: at 03:30 UTC on the 1st it is still the
    // 30th/31st across the Americas, and last month isn't over for them yet.
    const eligible = profiles.filter(p => {
        if (p.last_allowance_reset_month === thisMonth) return false;
        const local = localDate(p.timezone, now);
        if (local.slice(0, 7) !== thisMonth) return false;
        return Number(p.monthly_budget) > 0;
    });
    if (!eligible.length) return NextResponse.json({ scanned: profiles.length, notified: 0 });

    const { data: txs } = await supabase
        .from('transactions')
        .select('user_id, amount, currency, exchange_rate, base_currency, converted_amount, exclude_from_allowance, splits(amount)')
        .in('user_id', eligible.map(p => p.id))
        .gte('date', ymd(lastMonthStart))
        .lte('date', ymd(lastMonthEnd))
        .eq('is_settlement', false)
        .eq('is_income', false)
        .eq('is_transfer', false)
        .returns<TxRow[]>();

    const baseOf = (userId: string) => eligible.find(p => p.id === userId)?.currency;
    const toCurrency = await loadConverter((txs || []).map(tx => ({ tx, target: baseOf(tx.user_id) })));

    const subsByUser = await loadSubsByUser(supabase, eligible.map(p => p.id));
    const expired: string[] = [];
    let pushSent = 0;

    for (const p of eligible) {
        const ccy = (p.currency || 'USD').toUpperCase();
        const budget = Number(p.monthly_budget) || 0;
        let lastSpent = 0;
        for (const tx of txs || []) {
            if (tx.user_id !== p.id) continue;
            if (tx.exclude_from_allowance) continue;
            // Group rows count at the payer's share, as on the dashboard.
            const share = payerShare(tx);
            if (share <= 0) continue;
            const amt = toCurrency(tx, ccy, share);
            if (amt === null) continue;
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
