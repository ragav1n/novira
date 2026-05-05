import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { isInQuietHours } from '@/lib/push-quiet-hours';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const webpush = require('web-push') as typeof import('web-push');

/**
 * Bucket deadline warning. Fires a push when an active bucket's `end_date` is
 * exactly 3 days or 1 day away. No state column required: cron runs once per
 * day, so each threshold (3-day, 1-day) gets exactly one chance per bucket.
 * If the user changes the end_date later, the new date re-enters the window.
 *
 * Pairs with /api/cron/bucket-completion which handles the "deadline reached"
 * archive + final push. This route is the heads-up before that.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.NEXT_PUBLIC_SITE_URL || 'mailto:admin@novira.app';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

interface BucketRow {
    id: string;
    user_id: string;
    name: string;
    end_date: string;
}

interface PushSubRow {
    user_id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
}

function ymd(d: Date): string {
    return d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
    const cronSecret = process.env.CRON_SECRET;
    const auth = request.headers.get('authorization');
    const internal = request.headers.get('x-push-secret');
    const cronOk = !!cronSecret && auth === `Bearer ${cronSecret}`;
    const internalOk = !!internal && internal === process.env.PUSH_SECRET;
    if (!cronOk && !internalOk) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
        return NextResponse.json({ error: 'Service role key not configured' }, { status: 503 });
    }

    const supabase = createServiceClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false }
    });

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const inThree = new Date(today); inThree.setUTCDate(inThree.getUTCDate() + 3);
    const inOne = new Date(today); inOne.setUTCDate(inOne.getUTCDate() + 1);
    const targets = new Set([ymd(inThree), ymd(inOne)]);

    const { data: candidates, error } = await supabase
        .from('buckets')
        .select('id, user_id, name, end_date')
        .eq('is_archived', false)
        .is('completed_at', null)
        .in('end_date', Array.from(targets))
        .returns<BucketRow[]>();

    if (error) {
        console.error('[bucket-deadline] fetch failed', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!candidates?.length) {
        return NextResponse.json({ warned: 0 });
    }

    let pushSent = 0;
    let skippedQuiet = 0;
    let skippedDisabled = 0;
    if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
        const userIds = Array.from(new Set(candidates.map(b => b.user_id)));
        const { data: subs } = await supabase
            .from('push_subscriptions')
            .select('user_id, endpoint, p256dh, auth')
            .in('user_id', userIds)
            .returns<PushSubRow[]>();

        const subsByUser = new Map<string, PushSubRow[]>();
        for (const s of subs || []) {
            const arr = subsByUser.get(s.user_id) || [];
            arr.push(s);
            subsByUser.set(s.user_id, arr);
        }

        // Per-user gating: opt-out flag + quiet hours. Best-effort: if columns
        // don't exist (older deployments), the select fails and we fall back
        // to sending unconditionally rather than blocking everyone.
        type ProfilePrefs = {
            bucket_deadline_alerts?: boolean | null;
            quiet_hours_start?: number | null;
            quiet_hours_end?: number | null;
            timezone?: string | null;
        };
        const prefsByUser = new Map<string, ProfilePrefs>();
        const { data: profiles, error: profilesErr } = await supabase
            .from('profiles')
            .select('id, bucket_deadline_alerts, quiet_hours_start, quiet_hours_end, timezone')
            .in('id', userIds);
        if (!profilesErr && profiles) {
            for (const p of profiles as Array<ProfilePrefs & { id: string }>) {
                prefsByUser.set(p.id, p);
            }
        }

        const expiredEndpoints: string[] = [];

        for (const b of candidates) {
            const userSubs = subsByUser.get(b.user_id);
            if (!userSubs?.length) continue;

            const prefs = prefsByUser.get(b.user_id);
            if (prefs && prefs.bucket_deadline_alerts === false) {
                skippedDisabled++;
                continue;
            }
            if (prefs && isInQuietHours(prefs.timezone, prefs.quiet_hours_start, prefs.quiet_hours_end)) {
                skippedQuiet++;
                continue;
            }

            const isOneDay = b.end_date === ymd(inOne);
            const title = isOneDay ? `${b.name} ends tomorrow` : `${b.name} ends in 3 days`;
            const body = isOneDay
                ? 'Last day to log expenses and review.'
                : 'Wrap up spending and review before it closes.';

            const payload = JSON.stringify({
                title,
                body,
                url: '/groups',
                icon: '/Novira.png'
            });

            const results = await Promise.allSettled(
                userSubs.map(s =>
                    webpush.sendNotification(
                        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                        payload
                    )
                )
            );
            results.forEach((r, i) => {
                if (r.status === 'rejected') {
                    const status = (r.reason as { statusCode?: number } | undefined)?.statusCode;
                    if (status === 404 || status === 410) expiredEndpoints.push(userSubs[i].endpoint);
                } else {
                    pushSent++;
                }
            });
        }

        if (expiredEndpoints.length) {
            await supabase.from('push_subscriptions').delete().in('endpoint', expiredEndpoints);
        }
    }

    return NextResponse.json({ warned: candidates.length, pushSent, skippedQuiet, skippedDisabled });
}
