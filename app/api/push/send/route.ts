import { NextRequest, NextResponse } from 'next/server';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const webpush = require('web-push') as typeof import('web-push');
import { createClient as createServiceClient } from '@supabase/supabase-js';

// VAPID keys must be set in environment variables.
// Generate with: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.NEXT_PUBLIC_SITE_URL || 'mailto:admin@novira.app';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

interface PushPayload {
    title: string;
    body: string;
    icon?: string;
    url?: string;
}

/**
 * Internal API — send a push to a specific user_id.
 * Protected by a shared PUSH_SECRET to prevent abuse (only server-side callers).
 */
export async function POST(request: NextRequest) {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
        return NextResponse.json({ error: 'Push notifications not configured. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY env vars.' }, { status: 503 });
    }

    // Verify shared secret. Accepts either:
    //   - x-push-secret: <PUSH_SECRET>          (legacy/internal callers)
    //   - Authorization: Bearer <CRON_SECRET>   (Vercel Cron + manual curl tests)
    const xPushSecret = request.headers.get('x-push-secret');
    const auth = request.headers.get('authorization');
    const pushOk = !!process.env.PUSH_SECRET && xPushSecret === process.env.PUSH_SECRET;
    const cronOk = !!process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
    if (!pushOk && !cronOk) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    try {
        const { userId, payload }: { userId: string; payload: PushPayload } = await request.json();

        // Use service-role client so RLS doesn't block this cron-style endpoint.
        // Curl / Vercel-cron calls carry no user session cookies, so the user
        // client would return zero rows even when subscriptions exist.
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !serviceKey) {
            return NextResponse.json({ error: 'Service role key not configured' }, { status: 503 });
        }
        const supabase = createServiceClient(supabaseUrl, serviceKey, {
            auth: { persistSession: false, autoRefreshToken: false }
        });

        const { data: subs } = await supabase
            .from('push_subscriptions')
            .select('endpoint, p256dh, auth')
            .eq('user_id', userId);

        if (!subs?.length) return NextResponse.json({ sent: 0 });

        const results = await Promise.allSettled(
            subs.map(sub =>
                webpush.sendNotification(
                    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                    JSON.stringify({ ...payload, icon: payload.icon || '/Novira.png' })
                )
            )
        );

        // Remove expired/invalid subscriptions
        const expired = subs.filter((_, i) => {
            const r = results[i];
            if (r.status !== 'rejected') return false;
            const status = (r.reason as { statusCode?: number } | undefined)?.statusCode;
            return status === 404 || status === 410;
        });
        if (expired.length) {
            await supabase.from('push_subscriptions')
                .delete()
                .in('endpoint', expired.map(s => s.endpoint));
        }

        return NextResponse.json({ sent: results.filter(r => r.status === 'fulfilled').length });
    } catch (err: unknown) {
        console.error('[Push Send]', err);
        const message = err instanceof Error ? err.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
