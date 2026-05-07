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
 * if they haven't been sent that slot today and haven't received any other
 * push in the last 4 hours. Layers on top of the 14 event-driven cron jobs
 * without replacing them.
 *
 * Slot windows are 2 hours wide (07-08 morning, 12-13 midday, 18-19 evening)
 * to absorb Vercel's ±59 min cron precision: an entry scheduled at HH:00 may
 * fire anywhere in HH:00-HH:59, by which time the user's local hour can have
 * already rolled over. `alreadySentSlotToday` dedup guarantees one fire per
 * slot per local day regardless of how many hours map to the same slot name.
 */

const SLOT_HOURS: Record<number, SlotName> = {
    7: 'morning', 8: 'morning',
    12: 'midday', 13: 'midday',
    18: 'evening', 19: 'evening',
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
    const previewUserId = url.searchParams.get('previewUser');
    const now = new Date();
    if (simulateHourParam != null && process.env.NODE_ENV !== 'production') {
        const h = parseInt(simulateHourParam, 10);
        if (!isNaN(h) && h >= 0 && h <= 23) {
            now.setUTCHours(h, 0, 0, 0);
        }
    }

    // Preview mode: render all 3 slot composers for one user without sending
    // and without writing to send_log. Auth-gated by the same cron secret —
    // useful for tuning copy from a curl. Returns context + composer outputs.
    if (previewUserId) {
        const { data: profile, error: previewErr } = await supabase
            .from('profiles')
            .select('id, currency, monthly_budget, timezone, quiet_hours_start, quiet_hours_end')
            .eq('id', previewUserId)
            .single<SlotProfile & {
                quiet_hours_start: number | null;
                quiet_hours_end: number | null;
            }>();
        if (previewErr || !profile) {
            return NextResponse.json({ error: 'Profile not found', detail: previewErr?.message }, { status: 404 });
        }
        const tz = profile.timezone || 'UTC';
        const localHour = localHourInTimezone(tz, now);
        const localDate = localDateInTimezone(tz, now);
        const matchedSlot = localHour != null ? SLOT_HOURS[localHour] : undefined;
        const ctx = await loadSlotContext(supabase, profile, now);
        return NextResponse.json({
            user: { id: profile.id, timezone: tz, currency: profile.currency, monthly_budget: profile.monthly_budget },
            now: { utc: now.toISOString(), localHour, localDate },
            quiet: isInQuietHours(tz, profile.quiet_hours_start, profile.quiet_hours_end, now),
            active: isActiveUser(ctx),
            matchedSlot: matchedSlot ?? null,
            context: {
                todaySpend: ctx.todaySpend, todayCount: ctx.todayCount,
                yesterdaySpend: ctx.yesterdaySpend, yesterdayCount: ctx.yesterdayCount,
                mtdSpend: ctx.mtdSpend, txCount14d: ctx.txCount14d,
                upcomingBills: ctx.upcomingBills,
                nearestBucket: ctx.nearestBucket,
            },
            slots: {
                morning: composeMorning(ctx),
                midday: composeMidday(ctx),
                evening: composeEvening(ctx),
            },
        });
    }

    const { data: profiles, error: profilesErr } = await supabase
        .from('profiles')
        .select('id, currency, monthly_budget, timezone, quiet_hours_start, quiet_hours_end, smart_digests_enabled')
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
