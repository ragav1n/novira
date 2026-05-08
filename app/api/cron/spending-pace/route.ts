import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { isInQuietHours } from '@/lib/push-quiet-hours';
import { logSend } from '@/lib/server/send-log';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const webpush = require('web-push') as typeof import('web-push');

/**
 * Mid-month spending-pace alert. Fires only on day 15 of the month for users
 * whose projected month-end spend (simple linear extrapolation from MTD) will
 * exceed their monthly budget by more than 10%. One push per month per user.
 *
 * No persistent flag: the day-15 gate guarantees single-fire per month.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.NEXT_PUBLIC_SITE_URL || 'mailto:admin@novira.app';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

interface ProfileRow {
    id: string;
    currency: string | null;
    monthly_budget: number | null;
    spending_pace_alerts?: boolean | null;
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
    exclude_from_allowance: boolean | null;
}

interface PushSubRow {
    user_id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
    USD: '$', EUR: '€', INR: '₹', GBP: '£', JPY: '¥', AUD: 'A$', CAD: 'C$', CHF: 'Fr',
    CNY: '¥', SGD: 'S$', HKD: 'HK$', THB: '฿', PHP: '₱', KRW: '₩', AED: 'AED'
};
function fmt(amount: number, ccy: string): string {
    return `${CURRENCY_SYMBOLS[ccy.toUpperCase()] || ''}${Math.round(amount).toLocaleString()}`;
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

    const today = new Date();
    if (today.getUTCDate() !== 15) {
        return NextResponse.json({ skipped: 'not day 15', day: today.getUTCDate() });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
        return NextResponse.json({ error: 'Service role key not configured' }, { status: 503 });
    }

    const supabase = createServiceClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false }
    });

    // Wide select first for the new prefs columns; fall back if columns aren't
    // deployed yet so the cron keeps working.
    let profiles: ProfileRow[] | null = null;
    {
        const wide = await supabase
            .from('profiles')
            .select('id, currency, monthly_budget, spending_pace_alerts, quiet_hours_start, quiet_hours_end, timezone')
            .gt('monthly_budget', 0)
            .returns<ProfileRow[]>();
        if (wide.error) {
            const legacy = await supabase
                .from('profiles')
                .select('id, currency, monthly_budget')
                .gt('monthly_budget', 0)
                .returns<ProfileRow[]>();
            profiles = legacy.data ?? null;
        } else {
            profiles = wide.data ?? null;
        }
    }

    if (!profiles?.length) return NextResponse.json({ recipients: 0 });

    // Last day of previous month boundary == first day of this month at 00:00 UTC
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const monthStartStr = monthStart.toISOString().slice(0, 10);
    const userIds = profiles.map(p => p.id);

    const { data: txs } = await supabase
        .from('transactions')
        .select('user_id, amount, currency, exchange_rate, base_currency, exclude_from_allowance')
        .in('user_id', userIds)
        .gte('date', monthStartStr)
        .is('group_id', null)
        .eq('is_settlement', false)
        .eq('is_income', false)
        .returns<TxRow[]>();

    const totalsByUser = new Map<string, number>();
    for (const tx of txs || []) {
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
        totalsByUser.set(tx.user_id, (totalsByUser.get(tx.user_id) || 0) + amt);
    }

    // Days in current month — used to extrapolate.
    const daysInMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)).getUTCDate();
    const currentDay = today.getUTCDate();

    let pushSent = 0;
    if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
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

        for (const profile of profiles) {
            if (profile.spending_pace_alerts === false) continue;
            if (isInQuietHours(profile.timezone, profile.quiet_hours_start, profile.quiet_hours_end)) continue;

            const total = totalsByUser.get(profile.id) || 0;
            const budget = Number(profile.monthly_budget) || 0;
            if (budget <= 0 || total <= 0) continue;
            const projected = (total / currentDay) * daysInMonth;
            if (projected <= budget * 1.10) continue; // <=10% over → skip

            const userSubs = subsByUser.get(profile.id);
            if (!userSubs?.length) continue;
            const baseCcy = (profile.currency || 'USD').toUpperCase();

            const overshoot = projected - budget;
            const overshootPct = Math.round(((projected - budget) / budget) * 100);

            const payload = JSON.stringify({
                title: 'Pacing over budget',
                body: `${fmt(total, baseCcy)} mid-month — projected to overshoot by ${fmt(overshoot, baseCcy)} (+${overshootPct}%).`,
                url: '/dashboard',
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
            let userSent = false;
            results.forEach((r, i) => {
                if (r.status === 'rejected') {
                    const status = (r.reason as { statusCode?: number } | undefined)?.statusCode;
                    if (status === 404 || status === 410) expiredEndpoints.push(userSubs[i].endpoint);
                } else {
                    pushSent++;
                    userSent = true;
                }
            });
            if (userSent) {
                await logSend(supabase, profile.id, 'event:spending-pace', new Date().toISOString().slice(0, 10));
            }
        }

        if (expiredEndpoints.length) {
            await supabase.from('push_subscriptions').delete().in('endpoint', expiredEndpoints);
        }
    }

    return NextResponse.json({ recipients: profiles.length, pushSent });
}
