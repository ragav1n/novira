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
    expiredSink: string[]
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
