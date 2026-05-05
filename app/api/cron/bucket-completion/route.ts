import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const webpush = require('web-push') as typeof import('web-push');

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
    end_date: string | null;
    is_archived: boolean;
    completed_at: string | null;
    completion_notified: boolean;
}

interface PushSubRow {
    user_id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
}

export async function GET(request: NextRequest) {
    const cronSecret = process.env.CRON_SECRET;
    const auth = request.headers.get('authorization');
    const internal = request.headers.get('x-push-secret');
    const cronOk = cronSecret && auth === `Bearer ${cronSecret}`;
    const internalOk = internal && internal === process.env.PUSH_SECRET;
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
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);

    // 1. Find buckets whose end_date is on/before today, not archived, not yet completed.
    //    Index `buckets_end_date_idx` covers the (is_archived = FALSE AND completed_at IS NULL) shape.
    const { data: candidates, error: candidatesErr } = await supabase
        .from('buckets')
        .select('id, user_id, name, end_date, is_archived, completed_at, completion_notified')
        .eq('is_archived', false)
        .is('completed_at', null)
        .not('end_date', 'is', null)
        .lte('end_date', todayStr)
        .returns<BucketRow[]>();

    if (candidatesErr) {
        console.error('[bucket-completion] candidate fetch failed', candidatesErr);
        return NextResponse.json({ error: candidatesErr.message }, { status: 500 });
    }
    if (!candidates?.length) {
        return NextResponse.json({ archived: 0, scanned: 0 });
    }

    // 2. Archive + stamp completed_at in one update per bucket. We don't batch
    //    these because a partial RLS failure on one shouldn't block the others.
    const archivedIds: string[] = [];
    for (const b of candidates) {
        const { error: updErr } = await supabase
            .from('buckets')
            .update({
                is_archived: true,
                completed_at: new Date().toISOString(),
            })
            .eq('id', b.id);
        if (updErr) {
            console.error('[bucket-completion] archive failed for', b.id, updErr);
            continue;
        }
        archivedIds.push(b.id);
    }

    if (!archivedIds.length) {
        return NextResponse.json({ archived: 0, scanned: candidates.length });
    }

    // 3. Best-effort push notification. Skipped if VAPID isn't configured —
    //    archiving still happens, the user just doesn't get a ping.
    let pushSent = 0;
    if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
        const archivedBuckets = candidates.filter(b => archivedIds.includes(b.id));
        const userIds = Array.from(new Set(archivedBuckets.map(b => b.user_id)));
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

        const expiredEndpoints: string[] = [];
        const notifiedBucketIds: string[] = [];

        for (const b of archivedBuckets) {
            if (b.completion_notified) continue;
            const userSubs = subsByUser.get(b.user_id);
            if (!userSubs?.length) continue;

            const payload = JSON.stringify({
                title: `${b.name} wrapped up`,
                body: 'Tap to see your final summary.',
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

            let anyFulfilled = false;
            results.forEach((r, i) => {
                if (r.status === 'rejected') {
                    const status = (r.reason as { statusCode?: number } | undefined)?.statusCode;
                    if (status === 404 || status === 410) expiredEndpoints.push(userSubs[i].endpoint);
                } else {
                    pushSent++;
                    anyFulfilled = true;
                }
            });

            if (anyFulfilled) notifiedBucketIds.push(b.id);
        }

        if (expiredEndpoints.length) {
            await supabase.from('push_subscriptions').delete().in('endpoint', expiredEndpoints);
        }

        if (notifiedBucketIds.length) {
            await supabase
                .from('buckets')
                .update({ completion_notified: true })
                .in('id', notifiedBucketIds);
        }
    }

    return NextResponse.json({
        archived: archivedIds.length,
        scanned: candidates.length,
        pushSent,
    });
}
