import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import {
    authorizeCron,
    cleanupExpired,
    getServiceSupabase,
    loadSubsByUser,
    processInBatches,
    pushReady,
    sendToUser,
} from '@/lib/server/push';
import { isInQuietHours } from '@/lib/push-quiet-hours';
import {
    alreadySentSlotToday,
    localDateInTimezone,
    localHourInTimezone,
    sentInLastNHours,
    type SlotName,
} from '@/lib/server/send-log';
import {
    composeEvening,
    composeMidday,
    composeMorning,
    isActiveUser,
    loadSlotContext,
    type SlotProfile,
} from '@/lib/server/notification-slots';

/**
 * Hourly orchestrator that delivers a 3/day floor of "smart digest" pushes.
 * Resolves each subscribed user's local hour and dispatches the matching slot
 * (morning 08, midday 13, evening 19) if they haven't been sent that slot
 * today and haven't received any other push in the last 4 hours. Layers on
 * top of the 14 event-driven cron jobs without replacing them.
 */

const SLOT_HOURS: Record<number, SlotName> = {
    8: 'morning',
    13: 'midday',
    19: 'evening',
};

const COMPOSERS = {
    morning: composeMorning,
    midday: composeMidday,
    evening: composeEvening,
} as const;

export async function GET(request: NextRequest) {
    const forbidden = authorizeCron(request);
    if (forbidden) return forbidden;

    const supabase = getServiceSupabase();
    if (supabase instanceof NextResponse) return supabase;

    if (!pushReady) {
        return NextResponse.json({ error: 'VAPID not configured' }, { status: 503 });
    }

    // Optional clock override for local testing — gated to non-production so
    // it can't be abused to fire slots out of band in prod.
    const url = new URL(request.url);
    const simulateHourParam = url.searchParams.get('simulateHour');
    const now = new Date();
    if (simulateHourParam != null && process.env.NODE_ENV !== 'production') {
        const h = parseInt(simulateHourParam, 10);
        if (!isNaN(h) && h >= 0 && h <= 23) {
            now.setUTCHours(h, 0, 0, 0);
        }
    }

    const { data: profiles, error: profilesErr } = await supabase
        .from('profiles')
        .select('id, currency, monthly_budget, timezone, quiet_hours_start, quiet_hours_end, created_at, smart_digests_enabled')
        .eq('smart_digests_enabled', true)
        .returns<Array<SlotProfile & {
            quiet_hours_start: number | null;
            quiet_hours_end: number | null;
            smart_digests_enabled: boolean;
        }>>();

    if (profilesErr) {
        console.error('[slot-tick] profile fetch failed', profilesErr);
        return NextResponse.json({ error: profilesErr.message }, { status: 500 });
    }
    if (!profiles?.length) return NextResponse.json({ recipients: 0 });

    const subsByUser = await loadSubsByUser(supabase, profiles.map(p => p.id));
    const expired: string[] = [];

    let attempted = 0;
    let sent = 0;
    let skippedNoSlot = 0;
    let skippedQuiet = 0;
    let skippedDormant = 0;
    let skippedRecent = 0;
    let skippedAlreadySent = 0;
    let skippedEmpty = 0;
    let skippedNoSubs = 0;

    await processInBatches(profiles, 10, async (p) => {
        if (!subsByUser.has(p.id)) { skippedNoSubs++; return; }

        const tz = p.timezone || 'UTC';
        const localHour = localHourInTimezone(tz, now);
        if (localHour == null) { skippedNoSlot++; return; }
        const slot = SLOT_HOURS[localHour];
        if (!slot) { skippedNoSlot++; return; }

        if (isInQuietHours(tz, p.quiet_hours_start, p.quiet_hours_end, now)) {
            skippedQuiet++;
            return;
        }

        const localDate = localDateInTimezone(tz, now);

        if (await alreadySentSlotToday(supabase, p.id, slot, localDate)) {
            skippedAlreadySent++;
            return;
        }
        if (await sentInLastNHours(supabase, p.id, 4)) {
            skippedRecent++;
            return;
        }

        const ctx = await loadSlotContext(supabase, p, now);
        if (!isActiveUser(ctx)) { skippedDormant++; return; }

        const payload = COMPOSERS[slot](ctx);
        if (!payload) { skippedEmpty++; return; }

        attempted++;
        const delivered = await sendToUser(supabase, subsByUser, p.id, payload, expired, `slot:${slot}`, localDate);
        if (delivered > 0) sent += delivered;
    });

    await cleanupExpired(supabase, expired);

    return NextResponse.json({
        recipients: profiles.length,
        attempted,
        sent,
        skipped: {
            noSlot: skippedNoSlot,
            quiet: skippedQuiet,
            dormant: skippedDormant,
            recent: skippedRecent,
            alreadySent: skippedAlreadySent,
            empty: skippedEmpty,
            noSubs: skippedNoSubs,
        },
    });
}
