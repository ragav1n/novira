import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { generateRecap, VALID_PERIOD_RE } from '@/lib/recap-generator';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const webpush = require('web-push') as typeof import('web-push');

export const maxDuration = 60;

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.NEXT_PUBLIC_SITE_URL || 'mailto:admin@novira.app';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

interface PushSubRow {
    endpoint: string;
    p256dh: string;
    auth: string;
}

interface WorkerPayload {
    userId?: string;
    period?: string;
    currency?: string;
    push?: { title: string; body: string; url: string; icon?: string };
}

export async function POST(request: NextRequest) {
    const internal = request.headers.get('x-push-secret');
    const auth = request.headers.get('authorization');
    const internalOk = !!internal && internal === process.env.PUSH_SECRET;
    const cronOk = !!process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;
    if (!internalOk && !cronOk) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { userId, period, currency, push } = (await request.json()) as WorkerPayload;
    if (!userId || !period || !VALID_PERIOD_RE.test(period)) {
        return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
        return NextResponse.json({ error: 'Service role not configured' }, { status: 503 });
    }
    const supabase = createServiceClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false }
    });

    let generated = false;
    const { data: existing } = await supabase
        .from('monthly_recaps')
        .select('user_id, seen_at')
        .eq('user_id', userId)
        .eq('month', period)
        .maybeSingle();
    if (!existing) {
        const GENERATION_TIMEOUT_MS = 50_000; // keep headroom under maxDuration=60
        try {
            await Promise.race([
                generateRecap(supabase, userId, period, (currency || 'USD').toUpperCase()),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('generateRecap timeout')), GENERATION_TIMEOUT_MS)
                )
            ]);
            generated = true;
        } catch (err) {
            console.error('[recap-worker] generation failed', userId, period, err);
            return NextResponse.json({ error: 'Generation failed', userId, period }, { status: 500 });
        }
    }

    // Don't re-notify a user who has already seen this recap (e.g. they generated
    // it manually mid-period, opened the modal, then the cron fired later).
    const alreadySeen = !!(existing && existing.seen_at);
    let pushed = 0;
    if (push && !alreadySeen && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
        const { data: subs } = await supabase
            .from('push_subscriptions')
            .select('endpoint, p256dh, auth')
            .eq('user_id', userId)
            .returns<PushSubRow[]>();
        if (subs?.length) {
            const payload = JSON.stringify(push);
            const expiredEndpoints: string[] = [];
            const results = await Promise.allSettled(
                subs.map(s =>
                    webpush.sendNotification(
                        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
                        payload
                    )
                )
            );
            results.forEach((r, i) => {
                if (r.status === 'rejected') {
                    const status = (r.reason as { statusCode?: number } | undefined)?.statusCode;
                    if (status === 404 || status === 410) expiredEndpoints.push(subs[i].endpoint);
                } else {
                    pushed++;
                }
            });
            if (expiredEndpoints.length) {
                await supabase.from('push_subscriptions').delete().in('endpoint', expiredEndpoints);
            }
        }
    }

    return NextResponse.json({ ok: true, userId, period, generated, pushed, skippedPush: alreadySeen });
}
