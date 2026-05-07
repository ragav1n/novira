import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient, SupabaseClient } from '@supabase/supabase-js';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const webpush = require('web-push') as typeof import('web-push');

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.NEXT_PUBLIC_SITE_URL || 'mailto:admin@novira.app';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export const pushReady = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

export const CURRENCY_SYMBOLS: Record<string, string> = {
    USD: '$', EUR: '€', INR: '₹', GBP: '£', SGD: 'S$', JPY: '¥', AUD: 'A$', CAD: 'C$', AED: 'AED'
};

export function fmtMoney(amount: number, ccy: string): string {
    const symbol = CURRENCY_SYMBOLS[ccy.toUpperCase()] || ccy;
    return `${symbol}${Math.round(amount).toLocaleString()}`;
}

export interface PushPayload {
    title: string;
    body: string;
    url: string;
    icon?: string;
}

export interface PushSubRow {
    user_id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
}

export function authorizeCron(request: NextRequest): NextResponse | null {
    const cronSecret = process.env.CRON_SECRET;
    const auth = request.headers.get('authorization');
    const internal = request.headers.get('x-push-secret');
    const cronOk = !!cronSecret && auth === `Bearer ${cronSecret}`;
    const internalOk = !!internal && internal === process.env.PUSH_SECRET;
    if (!cronOk && !internalOk) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return null;
}

export function getServiceSupabase(): SupabaseClient | NextResponse {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        return NextResponse.json({ error: 'Service role not configured' }, { status: 503 });
    }
    return createServiceClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function sendToUser(
    supabase: SupabaseClient,
    subsByUser: Map<string, PushSubRow[]>,
    userId: string,
    payload: PushPayload,
    expiredSink: string[],
    /**
     * Optional log kind, e.g. "event:bucket-deadline" or "slot:morning". When
     * provided, a row is inserted into notification_send_log on successful
     * delivery so the slot orchestrator can suppress slots within a 4-hour
     * window of any other push (anti-stacking).
     */
    logKind?: string,
    /**
     * Override for the `local_date` column. Slot dedup uses the user's local
     * civil date (so a slot only fires once per local day regardless of UTC
     * crossover). Event-driven jobs can leave it undefined and use the UTC
     * date — the slot-dedup unique index is partial (kind LIKE 'slot:%') so
     * event rows never conflict.
     */
    logLocalDate?: string
): Promise<number> {
    const subs = subsByUser.get(userId);
    if (!subs?.length || !pushReady) return 0;
    const body = JSON.stringify({ icon: '/Novira.png', ...payload });
    const results = await Promise.allSettled(
        subs.map(s => webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body
        ))
    );
    let sent = 0;
    results.forEach((r, i) => {
        if (r.status === 'rejected') {
            const status = (r.reason as { statusCode?: number } | undefined)?.statusCode;
            if (status === 404 || status === 410) expiredSink.push(subs[i].endpoint);
        } else {
            sent++;
        }
    });
    if (sent > 0 && logKind) {
        const localDate = logLocalDate ?? new Date().toISOString().slice(0, 10);
        const { error } = await supabase.from('notification_send_log').insert({
            user_id: userId, kind: logKind, local_date: localDate,
        });
        if (error && error.code !== '23505') {
            console.error('[push] send-log insert failed', { logKind, userId, error: error.message });
        }
    }
    return sent;
}

export async function loadSubsByUser(
    supabase: SupabaseClient,
    userIds: string[]
): Promise<Map<string, PushSubRow[]>> {
    if (!userIds.length) return new Map();
    const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('user_id, endpoint, p256dh, auth')
        .in('user_id', userIds)
        .returns<PushSubRow[]>();
    const byUser = new Map<string, PushSubRow[]>();
    for (const s of subs || []) {
        const arr = byUser.get(s.user_id) || [];
        arr.push(s);
        byUser.set(s.user_id, arr);
    }
    return byUser;
}

export async function cleanupExpired(supabase: SupabaseClient, endpoints: string[]) {
    if (!endpoints.length) return;
    await supabase.from('push_subscriptions').delete().in('endpoint', endpoints);
}

// Process items with bounded concurrency. Replaces the serial per-user loops that
// blow past Vercel function timeouts at >1k users.
export async function processInBatches<T>(
    items: T[],
    concurrency: number,
    handler: (item: T) => Promise<void>
): Promise<void> {
    for (let i = 0; i < items.length; i += concurrency) {
        const slice = items.slice(i, i + concurrency);
        await Promise.allSettled(slice.map(handler));
    }
}
