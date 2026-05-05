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

type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface RecurringTemplateRow {
    id: string;
    user_id: string;
    description: string;
    amount: number;
    currency: string;
    frequency: Frequency;
    next_occurrence: string;
    is_active: boolean;
}

interface ProfileRow {
    id: string;
    bill_reminder_lead_days: number | null;
    quiet_hours_start?: number | null;
    quiet_hours_end?: number | null;
    timezone?: string | null;
}

interface PushSubRow {
    user_id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
    USD: '$', EUR: '€', INR: '₹', GBP: '£', SGD: 'S$', JPY: '¥', AUD: 'A$', CAD: 'C$', AED: 'AED'
};

function formatBillNotification(t: RecurringTemplateRow, daysUntil: number) {
    const symbol = CURRENCY_SYMBOLS[t.currency?.toUpperCase()] || t.currency || '';
    const amount = `${symbol}${Number(t.amount).toLocaleString()}`;
    const when = daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`;
    return {
        title: `${t.description} due ${when}`,
        body: amount,
    };
}

export async function GET(request: NextRequest) {
    // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. Allow either that
    // or the existing internal x-push-secret header so the route can be invoked
    // manually for testing.
    const cronSecret = process.env.CRON_SECRET;
    const auth = request.headers.get('authorization');
    const internal = request.headers.get('x-push-secret');
    const cronOk = cronSecret && auth === `Bearer ${cronSecret}`;
    const internalOk = internal && internal === process.env.PUSH_SECRET;
    if (!cronOk && !internalOk) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
        return NextResponse.json({ error: 'Push not configured' }, { status: 503 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
        return NextResponse.json({ error: 'Service role key not configured' }, { status: 503 });
    }

    const supabase = createServiceClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false }
    });

    // 1. Profiles with reminders enabled (lead_days set, > 0). Wide select for
    //    quiet-hours columns; fall back if not deployed.
    let profiles: ProfileRow[] | null = null;
    {
        const wide = await supabase
            .from('profiles')
            .select('id, bill_reminder_lead_days, quiet_hours_start, quiet_hours_end, timezone')
            .not('bill_reminder_lead_days', 'is', null)
            .gt('bill_reminder_lead_days', 0)
            .returns<ProfileRow[]>();
        if (wide.error) {
            const legacy = await supabase
                .from('profiles')
                .select('id, bill_reminder_lead_days')
                .not('bill_reminder_lead_days', 'is', null)
                .gt('bill_reminder_lead_days', 0)
                .returns<ProfileRow[]>();
            if (legacy.error) {
                console.error('[bill-reminders] profile fetch failed', legacy.error);
                return NextResponse.json({ error: legacy.error.message }, { status: 500 });
            }
            profiles = legacy.data ?? null;
        } else {
            profiles = wide.data ?? null;
        }
    }
    if (!profiles?.length) return NextResponse.json({ sent: 0, scanned: 0 });

    // Map user_id -> lead_days. Drop users currently in quiet hours.
    const leadByUser = new Map<string, number>();
    let maxLead = 0;
    for (const p of profiles) {
        if (p.bill_reminder_lead_days == null) continue;
        if (isInQuietHours(p.timezone, p.quiet_hours_start, p.quiet_hours_end)) continue;
        leadByUser.set(p.id, p.bill_reminder_lead_days);
        if (p.bill_reminder_lead_days > maxLead) maxLead = p.bill_reminder_lead_days;
    }
    if (!leadByUser.size) return NextResponse.json({ sent: 0, scanned: 0, skippedQuiet: profiles.length });

    // 2. Active recurring templates whose next_occurrence falls within [today, today+maxLead]
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + maxLead);
    const horizonStr = horizon.toISOString().slice(0, 10);

    const { data: templates, error: tErr } = await supabase
        .from('recurring_templates')
        .select('id, user_id, description, amount, currency, frequency, next_occurrence, is_active')
        .eq('is_active', true)
        .gte('next_occurrence', todayStr)
        .lte('next_occurrence', horizonStr)
        .in('user_id', Array.from(leadByUser.keys()))
        .returns<RecurringTemplateRow[]>();

    if (tErr) {
        console.error('[bill-reminders] template fetch failed', tErr);
        return NextResponse.json({ error: tErr.message }, { status: 500 });
    }
    if (!templates?.length) return NextResponse.json({ sent: 0, scanned: 0 });

    // Filter to templates that fall within *this user's* lead window.
    const dueTemplates = templates.filter(t => {
        const lead = leadByUser.get(t.user_id);
        if (lead == null) return false;
        const occ = new Date(t.next_occurrence + 'T00:00:00Z');
        const days = Math.round((occ.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return days >= 0 && days <= lead;
    });

    if (!dueTemplates.length) {
        return NextResponse.json({ sent: 0, scanned: templates.length });
    }

    // 3. Skip templates we've already notified for this occurrence.
    const { data: alreadyNotified } = await supabase
        .from('bill_reminder_log')
        .select('template_id, next_occurrence')
        .in('template_id', dueTemplates.map(t => t.id));
    const notifiedSet = new Set(
        (alreadyNotified || []).map(r => `${r.template_id}::${r.next_occurrence}`)
    );

    const toNotify = dueTemplates.filter(
        t => !notifiedSet.has(`${t.id}::${t.next_occurrence}`)
    );
    if (!toNotify.length) {
        return NextResponse.json({ sent: 0, scanned: dueTemplates.length });
    }

    // 4. Push subscriptions for affected users.
    const userIds = Array.from(new Set(toNotify.map(t => t.user_id)));
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

    let sent = 0;
    const expiredEndpoints: string[] = [];
    const successfulNotifications: { user_id: string; template_id: string; next_occurrence: string }[] = [];

    for (const t of toNotify) {
        const userSubs = subsByUser.get(t.user_id);
        if (!userSubs?.length) continue;

        const occ = new Date(t.next_occurrence + 'T00:00:00Z');
        const daysUntil = Math.round((occ.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const { title, body } = formatBillNotification(t, daysUntil);
        const payload = JSON.stringify({
            title,
            body,
            url: '/subscriptions',
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

        const anyFulfilled = results.some(r => r.status === 'fulfilled');
        results.forEach((r, i) => {
            if (r.status === 'rejected') {
                const status = (r.reason as { statusCode?: number } | undefined)?.statusCode;
                if (status === 404 || status === 410) expiredEndpoints.push(userSubs[i].endpoint);
            } else {
                sent++;
            }
        });

        if (anyFulfilled) {
            successfulNotifications.push({
                user_id: t.user_id,
                template_id: t.id,
                next_occurrence: t.next_occurrence
            });
        }
    }

    if (expiredEndpoints.length) {
        await supabase.from('push_subscriptions').delete().in('endpoint', expiredEndpoints);
    }

    if (successfulNotifications.length) {
        const { error: logErr } = await supabase
            .from('bill_reminder_log')
            .insert(successfulNotifications);
        if (logErr) console.error('[bill-reminders] log insert failed', logErr);
    }

    return NextResponse.json({
        sent,
        scanned: toNotify.length,
        users: userIds.length
    });
}
