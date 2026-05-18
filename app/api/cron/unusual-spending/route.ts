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
import { isInQuietHours } from '@/lib/push-quiet-hours';

interface ProfileRow {
    id: string;
    currency: string | null;
    spending_pace_alerts?: boolean | null;
    quiet_hours_start?: number | null;
    quiet_hours_end?: number | null;
    timezone?: string | null;
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

// Notify when yesterday's spending exceeded 1.5× the user's prior 30-day daily
// average AND the absolute amount is meaningful ($20 floor). Comparing
// "yesterday" not "today" keeps the cron timezone-consistent: yesterday is
// already-complete spend regardless of when in their local day the cron fires.
// One fire per user per day, dedup via notification_send_log.
export async function GET(request: NextRequest) {
    const denied = authorizeCron(request);
    if (denied) return denied;
    const supabase = getServiceSupabase();
    if (supabase instanceof NextResponse) return supabase;

    const MULT_THRESHOLD = 1.5;
    const ABSOLUTE_FLOOR_BASE = 20; // in the user's display currency

    const now = new Date();
    const today = ymd(now);
    const yesterday = new Date(now);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayStr = ymd(yesterday);
    // History window: the 30 days ending the day before yesterday — i.e. excludes
    // the day we're evaluating so it doesn't pollute its own baseline.
    const thirtyAgo = new Date(yesterday);
    thirtyAgo.setUTCDate(thirtyAgo.getUTCDate() - 30);
    const thirtyAgoStr = ymd(thirtyAgo);

    const { data: yesterdayTxs } = await supabase
        .from('transactions')
        .select('user_id, amount, currency, exchange_rate, base_currency, date')
        .eq('date', yesterdayStr)
        .is('group_id', null)
        .eq('exclude_from_allowance', false)
        .eq('is_settlement', false)
        .eq('is_income', false)
        .eq('is_transfer', false)
        .returns<TxRow[]>();

    if (!yesterdayTxs?.length) return NextResponse.json({ scanned: 0, notified: 0 });

    const userIds = Array.from(new Set(yesterdayTxs.map(t => t.user_id)));

    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, currency, spending_pace_alerts, quiet_hours_start, quiet_hours_end, timezone')
        .in('id', userIds)
        .returns<ProfileRow[]>();
    const profileById = new Map((profiles || []).map(p => [p.id, p]));

    // Pull the 30-day history ending the day before yesterday.
    const { data: history } = await supabase
        .from('transactions')
        .select('user_id, amount, currency, exchange_rate, base_currency, date')
        .in('user_id', userIds)
        .gte('date', thirtyAgoStr)
        .lt('date', yesterdayStr)
        .is('group_id', null)
        .eq('exclude_from_allowance', false)
        .eq('is_settlement', false)
        .eq('is_income', false)
        .eq('is_transfer', false)
        .returns<TxRow[]>();

    // Already-sent today — dedup so the cron can run multiple times per day safely.
    const { data: alreadySent } = await supabase
        .from('notification_send_log')
        .select('user_id')
        .in('user_id', userIds)
        .eq('kind', 'event:unusual-spending')
        .eq('local_date', today);
    const sentToday = new Set((alreadySent || []).map(r => r.user_id));

    // Convert an amount into the user's display currency. Falls back to the
    // raw amount when no rate is available — matches the spending-pace cron's
    // pragmatic approach.
    const convertToBase = (tx: TxRow, baseCcy: string): number => {
        const txCcy = (tx.currency || 'USD').toUpperCase();
        let amt = Number(tx.amount);
        if (txCcy !== baseCcy && tx.exchange_rate && (tx.base_currency || '').toUpperCase() === baseCcy) {
            amt = amt * Number(tx.exchange_rate);
        }
        return amt;
    };

    const yesterdayByUser = new Map<string, number>();
    for (const tx of yesterdayTxs) {
        const profile = profileById.get(tx.user_id);
        if (!profile) continue;
        const base = (profile.currency || 'USD').toUpperCase();
        yesterdayByUser.set(tx.user_id, (yesterdayByUser.get(tx.user_id) || 0) + convertToBase(tx, base));
    }

    const historyByUser = new Map<string, number>();
    for (const tx of history || []) {
        const profile = profileById.get(tx.user_id);
        if (!profile) continue;
        const base = (profile.currency || 'USD').toUpperCase();
        historyByUser.set(tx.user_id, (historyByUser.get(tx.user_id) || 0) + convertToBase(tx, base));
    }

    const subsByUser = await loadSubsByUser(supabase, userIds);
    const expired: string[] = [];
    let pushSent = 0;
    let evaluated = 0;

    for (const userId of userIds) {
        if (sentToday.has(userId)) continue;
        const profile = profileById.get(userId);
        if (!profile) continue;
        if (profile.spending_pace_alerts === false) continue;
        if (isInQuietHours(profile.timezone, profile.quiet_hours_start, profile.quiet_hours_end)) continue;

        const yesterdaySpend = yesterdayByUser.get(userId) || 0;
        const histTotal = historyByUser.get(userId) || 0;
        const dailyAvg = histTotal / 30;
        if (dailyAvg <= 0) continue;
        if (yesterdaySpend < ABSOLUTE_FLOOR_BASE) continue;
        evaluated++;
        const multiple = yesterdaySpend / dailyAvg;
        if (multiple < MULT_THRESHOLD) continue;

        const baseCcy = (profile.currency || 'USD').toUpperCase();
        const sent = await sendToUser(
            supabase,
            subsByUser,
            userId,
            {
                title: 'Unusual spending yesterday',
                body: `${fmtMoney(yesterdaySpend, baseCcy)} — about ${multiple.toFixed(1)}× your daily average.`,
                url: '/analytics',
            },
            expired,
            'event:unusual-spending',
            today
        );
        pushSent += sent;
    }

    await cleanupExpired(supabase, expired);
    return NextResponse.json({ recipients: userIds.length, evaluated, pushSent });
}
