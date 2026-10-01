import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { isInQuietHours } from '@/lib/push-quiet-hours';
import { authorizeCron, fmtMoney, processInBatches } from '@/lib/server/push';
import { loadConverter } from '@/lib/server/fx';
import { localDate, shiftDays } from '@/lib/server/local-date';
import { payerShare } from '@/lib/server/spend';
import { logSend } from '@/lib/server/send-log';
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
    smart_digests_enabled?: boolean | null;
}

interface TxRow {
    user_id: string;
    amount: number;
    currency: string | null;
    exchange_rate: number | null;
    base_currency: string | null;
    converted_amount: number | null;
    date: string;
    exclude_from_allowance: boolean | null;
    splits: { amount: number }[] | null;
}

interface PushSubRow {
    user_id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
}

export async function GET(request: NextRequest) {
    const denied = authorizeCron(request);
    if (denied) return denied;

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
            .select('id, currency, digest_frequency, quiet_hours_start, quiet_hours_end, timezone, smart_digests_enabled')
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

    // "Yesterday" and "this week" are the user's own calendar days. At 02:30 UTC
    // the Americas are still on the previous evening, so a UTC yesterday would
    // report their unfinished today. One fetch wide enough for every timezone.
    const allUserIds = profiles.map(p => p.id);
    const windowByUser = new Map(profiles.map(p => {
        const yesterday = shiftDays(localDate(p.timezone, now), -1);
        return [p.id, { yesterday, weekStart: shiftDays(yesterday, -6) }];
    }));

    // Rows the user paid, group ones included at their share — the dashboard's rule.
    const { data: txs } = await supabase
        .from('transactions')
        .select('user_id, amount, currency, exchange_rate, base_currency, converted_amount, date, exclude_from_allowance, splits(amount)')
        .in('user_id', allUserIds)
        .gte('date', shiftDays(now.toISOString().slice(0, 10), -9))
        .eq('is_settlement', false)
        .eq('is_income', false)
        .eq('is_transfer', false)
        .returns<TxRow[]>();

    // Per-user totals in their preferred currency.
    const baseOf = (userId: string) => profiles.find(p => p.id === userId)?.currency;
    const toCurrency = await loadConverter((txs || []).map(tx => ({ tx, target: baseOf(tx.user_id) })));
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
        const share = payerShare(tx);
        if (share <= 0) continue;
        const amt = toCurrency(tx, (profile.currency || 'USD').toUpperCase(), share);
        if (amt === null || amt <= 0) continue;

        const totals = totalsByUser.get(tx.user_id);
        const window = windowByUser.get(tx.user_id);
        if (!totals || !window) continue;

        const dateOnly = tx.date.slice(0, 10);
        if (dateOnly > window.yesterday) continue;
        if (dateOnly === window.yesterday) {
            totals.yesterday += amt;
            totals.yesterdayCount += 1;
        }
        if (dateOnly >= window.weekStart) {
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
        let pushSentLocal = 0;

        await processInBatches(profiles, 25, async (profile) => {
            // Smart digests cover the same ground (yesterday recap is the morning
            // slot's headline). Skip daily-digest only when smart digests are
            // explicitly on. Legacy rows (column missing → undefined) and users
            // who disabled smart digests still get the legacy daily-digest path.
            if (profile.smart_digests_enabled === true) return;
            if (isInQuietHours(profile.timezone, profile.quiet_hours_start, profile.quiet_hours_end)) return;
            const userSubs = subsByUser.get(profile.id);
            if (!userSubs?.length) return;
            const totals = totalsByUser.get(profile.id);
            if (!totals) return;

            const baseCcy = (profile.currency || 'USD').toUpperCase();
            let title: string;
            let body: string;
            if (profile.digest_frequency === 'daily') {
                if (totals.yesterdayCount === 0) return;
                title = 'Yesterday\'s spending';
                body = `${fmtMoney(totals.yesterday, baseCcy)} across ${totals.yesterdayCount} transaction${totals.yesterdayCount === 1 ? '' : 's'}.`;
            } else {
                if (totals.weekCount === 0) return;
                title = 'Your weekly recap';
                body = `${fmtMoney(totals.week, baseCcy)} across ${totals.weekCount} transaction${totals.weekCount === 1 ? '' : 's'} this week.`;
            }

            const payload = JSON.stringify({ title, body, url: '/dashboard', icon: '/Novira.png' });

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
                    pushSentLocal++;
                    userSent = true;
                }
            });
            if (userSent) {
                await logSend(supabase, profile.id, 'event:daily-digest', new Date().toISOString().slice(0, 10));
            }
        });

        pushSent += pushSentLocal;

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
