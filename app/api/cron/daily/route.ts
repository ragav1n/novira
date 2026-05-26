import { NextRequest, NextResponse } from 'next/server';
import { authorizeCron } from '@/lib/server/push';

/**
 * Wrapper cron: fans out to the 4 daily-cadence cron routes in one Vercel slot.
 * Vercel Hobby caps cron jobs at 2; this consolidation keeps every notification
 * feature alive without upgrading.
 *
 * Each child route already validates `Authorization: Bearer ${CRON_SECRET}` and
 * runs independently, so we just forward authenticated HTTP calls.
 */
export async function GET(request: NextRequest) {
    const denied = authorizeCron(request);
    if (denied) return denied;
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
    }

    const origin = new URL(request.url).origin;
    const targets = [
        '/api/cron/bill-reminders',
        '/api/cron/bucket-completion',
        '/api/cron/bucket-deadline',
        '/api/cron/bucket-thresholds',
        '/api/cron/daily-digest',
        '/api/cron/spending-pace',
        '/api/cron/subscription-price-change',
        '/api/cron/goal-thresholds',
        '/api/cron/goal-deadline',
        '/api/cron/cash-flow-shortfall',
        '/api/cron/transaction-anomaly',
        '/api/cron/unusual-spending',
        '/api/cron/re-engagement',
        '/api/cron/group-activity',
        '/api/cron/no-spend-streak',
    ];

    const results = await Promise.allSettled(
        targets.map(path =>
            fetch(`${origin}${path}`, {
                headers: { authorization: `Bearer ${cronSecret}` },
                cache: 'no-store',
            }).then(async r => ({ path, status: r.status, body: await r.json().catch(() => null) }))
        )
    );

    const summary = results.map((r, i) => {
        if (r.status === 'fulfilled') return { ...r.value };
        return { path: targets[i], status: 'rejected', error: String(r.reason) };
    });

    const ok = summary.every(s => typeof s.status === 'number' && s.status >= 200 && s.status < 300);
    return NextResponse.json({ ok, ran: summary }, { status: ok ? 200 : 207 });
}
