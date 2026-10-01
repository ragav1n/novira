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
import { localDate, shiftDays } from '@/lib/server/local-date';
import { payerShare } from '@/lib/server/spend';
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
    converted_amount: number | null;
    date: string;
    splits: { amount: number }[] | null;
}

function ymd(d: Date): string { return d.toISOString().slice(0, 10); }

// Notify when yesterday's spending exceeded 1.5× the user's prior 30-day daily
// average AND the absolute amount is meaningful ($20 floor, converted). Comparing
// the user's local "yesterday" means the day being judged is already complete.
// One fire per user per day, dedup via notification_send_log.
export async function GET(request: NextRequest) {
    const denied = authorizeCron(request);
    if (denied) return denied;
    const supabase = getServiceSupabase();
    if (supabase instanceof NextResponse) return supabase;

    const MULT_THRESHOLD = 1.5;
    const ABSOLUTE_FLOOR_USD = 20;

    const now = new Date();
    const today = ymd(now);
    // "Yesterday" is each user's own calendar day. At 02:30 UTC that is the UTC
    // day before yesterday for anyone west of UTC, and UTC yesterday for anyone east.
    const earliestYesterday = shiftDays(today, -2);
    const latestYesterday = shiftDays(today, -1);

    // Rows the user paid, group ones included at their share — the dashboard's rule.
    const { data: recentTxs } = await supabase
        .from('transactions')
        .select('user_id, amount, currency, exchange_rate, base_currency, converted_amount, date, splits(amount)')
        .gte('date', earliestYesterday)
        .lte('date', latestYesterday)
        .eq('exclude_from_allowance', false)
        .eq('is_settlement', false)
        .eq('is_income', false)
        .eq('is_transfer', false)
        .returns<TxRow[]>();

    if (!recentTxs?.length) return NextResponse.json({ scanned: 0, notified: 0 });

    const userIds = Array.from(new Set(recentTxs.map(t => t.user_id)));

    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, currency, spending_pace_alerts, quiet_hours_start, quiet_hours_end, timezone')
        .in('id', userIds)
        .returns<ProfileRow[]>();
    const profileById = new Map((profiles || []).map(p => [p.id, p]));
    const yesterdayOf = new Map((profiles || []).map(p => [p.id, shiftDays(localDate(p.timezone, now), -1)]));
    const yesterdayTxs = recentTxs.filter(tx => tx.date.slice(0, 10) === yesterdayOf.get(tx.user_id));

    // The 30 days before each user's yesterday — excludes the day being evaluated
    // so it doesn't pollute its own baseline.
    const { data: rawHistory } = await supabase
        .from('transactions')
        .select('user_id, amount, currency, exchange_rate, base_currency, converted_amount, date, splits(amount)')
        .in('user_id', userIds)
        .gte('date', shiftDays(earliestYesterday, -30))
        .lt('date', latestYesterday)
        .eq('exclude_from_allowance', false)
        .eq('is_settlement', false)
        .eq('is_income', false)
        .eq('is_transfer', false)
        .returns<TxRow[]>();
    const history = (rawHistory || []).filter(tx => {
        const y = yesterdayOf.get(tx.user_id);
        const d = tx.date.slice(0, 10);
        return !!y && d < y && d >= shiftDays(y, -30);
    });

    // Already-sent today — dedup so the cron can run multiple times per day safely.
    const { data: alreadySent } = await supabase
        .from('notification_send_log')
        .select('user_id')
        .in('user_id', userIds)
        .eq('kind', 'event:unusual-spending')
        .eq('local_date', today);
    const sentToday = new Set((alreadySent || []).map(r => r.user_id));

    // Convert into the user's display currency; rows with no known rate count as 0.
    // The floor is $20 expressed in that currency, so it means the same for ₹ and ¥.
    const floorTx = { amount: ABSOLUTE_FLOOR_USD, currency: 'USD' };
    const toCurrency = await loadConverter([
        ...[...yesterdayTxs, ...history].map(tx => ({ tx, target: profileById.get(tx.user_id)?.currency })),
        ...(profiles || []).map(p => ({ tx: floorTx, target: p.currency })),
    ]);
    const convertToBase = (tx: TxRow, baseCcy: string): number => toCurrency(tx, baseCcy, payerShare(tx)) ?? 0;

    const yesterdayByUser = new Map<string, number>();
    for (const tx of yesterdayTxs) {
        const profile = profileById.get(tx.user_id);
        if (!profile) continue;
        const base = (profile.currency || 'USD').toUpperCase();
        yesterdayByUser.set(tx.user_id, (yesterdayByUser.get(tx.user_id) || 0) + convertToBase(tx, base));
    }

    const historyByUser = new Map<string, number>();
    for (const tx of history) {
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
        const baseCcy = (profile.currency || 'USD').toUpperCase();
        if (yesterdaySpend < (toCurrency(floorTx, baseCcy) ?? ABSOLUTE_FLOOR_USD)) continue;
        evaluated++;
        const multiple = yesterdaySpend / dailyAvg;
        if (multiple < MULT_THRESHOLD) continue;

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
