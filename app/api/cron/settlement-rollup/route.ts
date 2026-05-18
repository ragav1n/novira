import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import {
    authorizeCron,
    cleanupExpired,
    fmtMoney,
    getServiceSupabase,
    loadSubsByUser,
    processInBatches,
    pushReady,
    sendToUser,
} from '@/lib/server/push';
import { isInQuietHours } from '@/lib/push-quiet-hours';

interface StaleSplitRow {
    id: string;
    user_id: string; // debtor
    amount: number;
    transaction: {
        user_id: string; // creditor (transaction owner)
        currency: string | null;
    } | { user_id: string; currency: string | null }[] | null;
}

interface ProfileRow {
    id: string;
    currency: string | null;
    timezone: string | null;
    settlement_notifications_enabled: boolean | null;
    quiet_hours_start: number | null;
    quiet_hours_end: number | null;
}

const STALE_AFTER_DAYS = 3;
const SUPPRESS_AFTER_HOURS = 6 * 24; // skip if we sent this kind in the last 6 days

/**
 * Daily cron — but each user only receives a settlement-rollup push at most
 * once every ~6 days, so this lands like a "weekly nudge" without locking
 * everyone to the same day of the week. Useful for users on different cron-
 * relevant timezones.
 */
export async function GET(request: NextRequest) {
    const denied = authorizeCron(request);
    if (denied) return denied;
    const supabase = getServiceSupabase();
    if (supabase instanceof NextResponse) return supabase;
    if (!pushReady) {
        return NextResponse.json({ error: 'VAPID not configured' }, { status: 503 });
    }

    const now = new Date();
    const cutoff = new Date(now.getTime() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: stale, error: staleErr } = await supabase
        .from('splits')
        .select('id, user_id, amount, transaction:transactions!inner(user_id, currency)')
        .eq('is_paid', false)
        .lt('created_at', cutoff)
        .returns<StaleSplitRow[]>();
    if (staleErr) {
        console.error('[settlement-rollup] stale fetch failed', staleErr);
        return NextResponse.json({ error: staleErr.message }, { status: 500 });
    }
    if (!stale?.length) return NextResponse.json({ scanned: 0, sent: 0 });

    interface UserAggregate {
        owedToMe: number;
        iOwe: number;
        owedCount: number;
        oweCount: number;
        currencyCounts: Map<string, number>;
    }
    const aggregateByUser = new Map<string, UserAggregate>();
    const ensure = (uid: string): UserAggregate => {
        let agg = aggregateByUser.get(uid);
        if (!agg) {
            agg = { owedToMe: 0, iOwe: 0, owedCount: 0, oweCount: 0, currencyCounts: new Map() };
            aggregateByUser.set(uid, agg);
        }
        return agg;
    };

    for (const row of stale) {
        const tx = Array.isArray(row.transaction) ? row.transaction[0] : row.transaction;
        if (!tx) continue;
        const amt = Number(row.amount) || 0;
        const ccy = (tx.currency || 'USD').toUpperCase();
        const debtor = row.user_id;
        const creditor = tx.user_id;
        if (debtor === creditor) continue;

        const debtorAgg = ensure(debtor);
        debtorAgg.iOwe += amt;
        debtorAgg.oweCount += 1;
        debtorAgg.currencyCounts.set(ccy, (debtorAgg.currencyCounts.get(ccy) || 0) + 1);

        const creditorAgg = ensure(creditor);
        creditorAgg.owedToMe += amt;
        creditorAgg.owedCount += 1;
        creditorAgg.currencyCounts.set(ccy, (creditorAgg.currencyCounts.get(ccy) || 0) + 1);
    }

    const candidateUserIds = Array.from(aggregateByUser.keys());
    if (!candidateUserIds.length) return NextResponse.json({ scanned: stale.length, sent: 0 });

    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, currency, timezone, settlement_notifications_enabled, quiet_hours_start, quiet_hours_end')
        .in('id', candidateUserIds)
        .returns<ProfileRow[]>();
    const profileById = new Map((profiles || []).map(p => [p.id, p]));

    const suppressCutoff = new Date(now.getTime() - SUPPRESS_AFTER_HOURS * 60 * 60 * 1000).toISOString();
    const { data: recentSends } = await supabase
        .from('notification_send_log')
        .select('user_id')
        .eq('kind', 'event:settlement-rollup')
        .gte('sent_at', suppressCutoff)
        .in('user_id', candidateUserIds);
    const recentlySent = new Set((recentSends || []).map(r => r.user_id));

    const eligibleUserIds = candidateUserIds.filter(uid => {
        const profile = profileById.get(uid);
        if (!profile) return false;
        if (profile.settlement_notifications_enabled === false) return false;
        if (recentlySent.has(uid)) return false;
        if (isInQuietHours(profile.timezone, profile.quiet_hours_start, profile.quiet_hours_end, now)) return false;
        return true;
    });
    if (!eligibleUserIds.length) {
        return NextResponse.json({ scanned: stale.length, candidates: candidateUserIds.length, sent: 0 });
    }

    const subsByUser = await loadSubsByUser(supabase, eligibleUserIds);
    const expired: string[] = [];
    let sent = 0;

    await processInBatches(eligibleUserIds, 10, async (userId) => {
        const agg = aggregateByUser.get(userId);
        if (!agg) return;
        if (!subsByUser.has(userId)) return;

        let topCcy = (profileById.get(userId)?.currency || 'USD').toUpperCase();
        let topCount = 0;
        for (const [c, n] of agg.currencyCounts.entries()) {
            if (n > topCount) { topCcy = c; topCount = n; }
        }

        let title: string;
        let body: string;
        if (agg.owedToMe > 0 && agg.iOwe > 0) {
            title = 'Time to settle up';
            body = `${fmtMoney(agg.owedToMe, topCcy)} owed to you · ${fmtMoney(agg.iOwe, topCcy)} to pay across ${agg.owedCount + agg.oweCount} splits.`;
        } else if (agg.owedToMe > 0) {
            title = `${fmtMoney(agg.owedToMe, topCcy)} owed to you`;
            body = `${agg.owedCount} ${agg.owedCount === 1 ? 'split has' : 'splits have'} been sitting unpaid for ${STALE_AFTER_DAYS}+ days.`;
        } else if (agg.iOwe > 0) {
            title = `${fmtMoney(agg.iOwe, topCcy)} to settle up`;
            body = `${agg.oweCount} ${agg.oweCount === 1 ? 'split' : 'splits'} you owe ${agg.oweCount === 1 ? 'has' : 'have'} been pending for ${STALE_AFTER_DAYS}+ days.`;
        } else {
            return;
        }

        const delivered = await sendToUser(
            supabase,
            subsByUser,
            userId,
            { title, body, url: '/groups' },
            expired,
            'event:settlement-rollup',
        );
        if (delivered > 0) sent += delivered;
    });

    await cleanupExpired(supabase, expired);

    return NextResponse.json({
        scanned: stale.length,
        candidates: candidateUserIds.length,
        eligible: eligibleUserIds.length,
        sent,
    });
}
