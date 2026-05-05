import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { isInQuietHours } from '@/lib/push-quiet-hours';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const webpush = require('web-push') as typeof import('web-push');

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.NEXT_PUBLIC_SITE_URL || 'mailto:admin@novira.app';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

interface ProfileRow {
    id: string;
    currency: string | null;
    digest_frequency: 'daily' | 'weekly';
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
    date: string;
    exclude_from_allowance: boolean | null;
}

interface PushSubRow {
    user_id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
    USD: '$', EUR: '€', INR: '₹', GBP: '£', CHF: 'Fr', SGD: 'S$', VND: '₫',
    TWD: 'NT$', JPY: '¥', KRW: '₩', HKD: 'HK$', MYR: 'RM',
    PHP: '₱', THB: '฿', CAD: 'C$', AUD: 'A$', MXN: 'Mex$', BRL: 'R$', IDR: 'Rp', AED: 'AED',
};

function fmt(amount: number, ccy: string): string {
    const sym = CURRENCY_SYMBOLS[ccy.toUpperCase()] || '';
    return `${sym}${amount.toFixed(2)}`;
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
        auth: { persistSession: false, autoRefreshToken: false },
    });

    const now = new Date();
    const isMonday = now.getUTCDay() === 1;

    // Daily digest fires every day, weekly only on Monday.
    const eligibleFrequencies: Array<'daily' | 'weekly'> = isMonday ? ['daily', 'weekly'] : ['daily'];

    let profiles: ProfileRow[] | null = null;
    {
        const wide = await supabase
            .from('profiles')
            .select('id, currency, digest_frequency, quiet_hours_start, quiet_hours_end, timezone')
            .in('digest_frequency', eligibleFrequencies)
            .returns<ProfileRow[]>();
        if (wide.error) {
            const legacy = await supabase
                .from('profiles')
                .select('id, currency, digest_frequency')
                .in('digest_frequency', eligibleFrequencies)
                .returns<ProfileRow[]>();
            if (legacy.error) {
                console.error('[daily-digest] profile fetch failed', legacy.error);
                return NextResponse.json({ error: legacy.error.message }, { status: 500 });
            }
            profiles = legacy.data ?? null;
        } else {
            profiles = wide.data ?? null;
        }
    }
    if (!profiles?.length) {
        return NextResponse.json({ recipients: 0, pushSent: 0 });
    }

    // Pull last 8 days of transactions — covers both single-day (yesterday)
    // and 7-day (last week) windows in one round-trip.
    const eightDaysAgo = new Date(now);
    eightDaysAgo.setUTCDate(eightDaysAgo.getUTCDate() - 8);
    const allUserIds = profiles.map(p => p.id);

    const { data: txs } = await supabase
        .from('transactions')
        .select('user_id, amount, currency, exchange_rate, base_currency, date, exclude_from_allowance')
        .in('user_id', allUserIds)
        .gte('date', eightDaysAgo.toISOString().slice(0, 10))
        .is('group_id', null)
        .returns<TxRow[]>();

    const yesterday = new Date(now);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().slice(0, 10);

    // Per-user totals in their preferred currency. Currency conversion is
    // approximated using stored exchange_rate when available; otherwise we
    // use the raw amount (most users have one base currency).
    interface Totals { yesterday: number; yesterdayCount: number; week: number; weekCount: number; }
    const totalsByUser = new Map<string, Totals>();
    for (const p of profiles) {
        totalsByUser.set(p.id, { yesterday: 0, yesterdayCount: 0, week: 0, weekCount: 0 });
    }

    for (const tx of txs || []) {
        // Match the dashboard's "Spent in <month>" semantics: anything the user
        // has flagged as excluded from allowance shouldn't show up in the digest
        // either. Otherwise the notification total disagrees with what they see
        // on the home screen.
        if (tx.exclude_from_allowance) continue;
        const profile = profiles.find(p => p.id === tx.user_id);
        if (!profile) continue;
        const baseCcy = (profile.currency || 'USD').toUpperCase();
        const txCcy = (tx.currency || 'USD').toUpperCase();
        let amt = Number(tx.amount);
        if (txCcy !== baseCcy && tx.exchange_rate && (tx.base_currency || '').toUpperCase() === baseCcy) {
            amt = amt * Number(tx.exchange_rate);
        }
        if (amt <= 0) continue;

        const totals = totalsByUser.get(tx.user_id);
        if (!totals) continue;

        const dateOnly = tx.date.slice(0, 10);
        if (dateOnly === yesterdayStr) {
            totals.yesterday += amt;
            totals.yesterdayCount += 1;
        }
        if (dateOnly >= sevenDaysAgoStr) {
            totals.week += amt;
            totals.weekCount += 1;
        }
    }

    let pushSent = 0;
    if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
        const { data: subs } = await supabase
            .from('push_subscriptions')
            .select('user_id, endpoint, p256dh, auth')
            .in('user_id', allUserIds)
            .returns<PushSubRow[]>();

        const subsByUser = new Map<string, PushSubRow[]>();
        for (const s of subs || []) {
            const arr = subsByUser.get(s.user_id) || [];
            arr.push(s);
            subsByUser.set(s.user_id, arr);
        }

        const expiredEndpoints: string[] = [];

        for (const profile of profiles) {
            if (isInQuietHours(profile.timezone, profile.quiet_hours_start, profile.quiet_hours_end)) continue;
            const userSubs = subsByUser.get(profile.id);
            if (!userSubs?.length) continue;
            const totals = totalsByUser.get(profile.id);
            if (!totals) continue;

            const baseCcy = (profile.currency || 'USD').toUpperCase();
            let title: string;
            let body: string;
            if (profile.digest_frequency === 'daily') {
                if (totals.yesterdayCount === 0) continue; // skip silent days
                title = 'Yesterday\'s spending';
                body = `${fmt(totals.yesterday, baseCcy)} across ${totals.yesterdayCount} transaction${totals.yesterdayCount === 1 ? '' : 's'}.`;
            } else {
                if (totals.weekCount === 0) continue;
                title = 'Your weekly recap';
                body = `${fmt(totals.week, baseCcy)} across ${totals.weekCount} transaction${totals.weekCount === 1 ? '' : 's'} this week.`;
            }

            const payload = JSON.stringify({
                title,
                body,
                url: '/dashboard',
                icon: '/Novira.png',
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

    return NextResponse.json({
        recipients: profiles.length,
        pushSent,
        isMonday,
    });
}
