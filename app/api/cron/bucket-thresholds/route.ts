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

const THRESHOLDS = [50, 80, 100] as const;

interface BucketRow {
    id: string;
    user_id: string;
    group_id: string | null;
    name: string;
    budget: number;
    currency: string | null;
    start_date: string | null;
    end_date: string | null;
    allowed_categories: string[] | null;
    last_threshold_notified: number | null;
}

interface TxRow {
    bucket_id: string | null;
    user_id: string;
    amount: number;
    category: string | null;
    currency: string | null;
    exchange_rate: number | null;
    base_currency: string | null;
    splits?: { user_id: string; amount: number }[];
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
        auth: { persistSession: false, autoRefreshToken: false },
    });

    const todayStr = new Date().toISOString().slice(0, 10);

    // Active buckets with a non-zero budget. completed_at IS NULL excludes finished buckets.
    const { data: buckets, error: bucketsErr } = await supabase
        .from('buckets')
        .select('id, user_id, group_id, name, budget, currency, start_date, end_date, allowed_categories, last_threshold_notified')
        .eq('is_archived', false)
        .is('completed_at', null)
        .gt('budget', 0)
        .returns<BucketRow[]>();

    if (bucketsErr) {
        console.error('[bucket-thresholds] bucket fetch failed', bucketsErr);
        return NextResponse.json({ error: bucketsErr.message }, { status: 500 });
    }
    if (!buckets?.length) {
        return NextResponse.json({ scanned: 0, notified: 0 });
    }

    const bucketIds = buckets.map(b => b.id);
    const { data: txs } = await supabase
        .from('transactions')
        .select('bucket_id, user_id, amount, category, currency, exchange_rate, base_currency, splits(user_id, amount)')
        .in('bucket_id', bucketIds)
        .returns<TxRow[]>();

    // Compute per-bucket spend in the bucket's currency. Currency conversion is
    // approximated: same-currency or via stored exchange_rate; mismatched
    // currencies without a stored rate fall back to raw amount (rare for
    // bucket-tagged transactions).
    const spendByBucket = new Map<string, number>();
    for (const tx of txs || []) {
        const bId = tx.bucket_id;
        if (!bId) continue;
        const bucket = buckets.find(b => b.id === bId);
        if (!bucket) continue;

        const allowed = bucket.allowed_categories || [];
        if (allowed.length > 0 && !allowed.includes((tx.category || '').toLowerCase())) continue;

        let share = Number(tx.amount);
        if (tx.splits && tx.splits.length > 0) {
            if (tx.user_id === bucket.user_id) {
                const othersOwe = tx.splits.reduce((sum, s) => sum + Number(s.amount || 0), 0);
                share = Number(tx.amount) - othersOwe;
            } else {
                const my = tx.splits.find(s => s.user_id === bucket.user_id);
                share = my ? Number(my.amount || 0) : 0;
            }
        } else if (tx.user_id !== bucket.user_id) {
            share = 0;
        }
        if (share <= 0) continue;

        const bucketCcy = (bucket.currency || 'USD').toUpperCase();
        const txCcy = (tx.currency || 'USD').toUpperCase();
        let inBucketCcy = share;
        if (txCcy !== bucketCcy) {
            if (tx.exchange_rate && (tx.base_currency || '').toUpperCase() === bucketCcy) {
                inBucketCcy = share * Number(tx.exchange_rate);
            }
        }
        spendByBucket.set(bId, (spendByBucket.get(bId) || 0) + inBucketCcy);
    }

    // Determine which buckets have crossed a new threshold.
    interface Crossing { bucket: BucketRow; threshold: number; spent: number; pct: number; }
    const crossings: Crossing[] = [];
    for (const bucket of buckets) {
        const spent = spendByBucket.get(bucket.id) || 0;
        if (spent <= 0) continue;
        const pct = (spent / bucket.budget) * 100;
        const already = bucket.last_threshold_notified || 0;
        // Pick the highest threshold the user has crossed but not yet been notified about.
        const reached = [...THRESHOLDS].reverse().find(t => pct >= t && t > already);
        if (reached) {
            crossings.push({ bucket, threshold: reached, spent, pct });
        }
    }

    if (crossings.length === 0) {
        return NextResponse.json({ scanned: buckets.length, notified: 0 });
    }

    let pushSent = 0;
    if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
        const userIds = Array.from(new Set(crossings.map(c => c.bucket.user_id)));
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

        for (const c of crossings) {
            const userSubs = subsByUser.get(c.bucket.user_id);
            if (!userSubs?.length) continue;

            const title =
                c.threshold === 100
                    ? `${c.bucket.name} budget hit`
                    : `${c.bucket.name} at ${c.threshold}%`;
            const body =
                c.threshold === 100
                    ? `You've used ${c.pct.toFixed(0)}% of your budget.`
                    : `${c.pct.toFixed(0)}% of your budget is spent.`;

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

            if (anyFulfilled) {
                await supabase
                    .from('buckets')
                    .update({ last_threshold_notified: c.threshold })
                    .eq('id', c.bucket.id);
            }
        }

        if (expiredEndpoints.length) {
            await supabase.from('push_subscriptions').delete().in('endpoint', expiredEndpoints);
        }
    }

    return NextResponse.json({
        scanned: buckets.length,
        notified: crossings.length,
        pushSent,
        today: todayStr,
    });
}
