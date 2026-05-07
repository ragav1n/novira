import { NextRequest, NextResponse } from 'next/server';

/**
 * Hourly wrapper cron. Two responsibilities:
 *
 * 1. Every hour: dispatch /api/cron/slot-tick so the smart-digest 3/day floor
 *    can hit each user at their local 08/13/19 hour regardless of timezone.
 *
 * 2. Once daily at 03:00 UTC: fan out to the calendar-conditional recap jobs:
 *    - day 1 of each month → monthly-recap, monthly-allowance-reset
 *    - day 15 of each month → midmonth-comparison
 *    - Jan 2 each year     → yearly-recap
 *
 * Vercel Hobby caps cron entries at 2; the second slot is /api/cron/daily.
 * Splitting these would need Pro, so we multiplex on the hour-of-day inside.
 */
export async function GET(request: NextRequest) {
    const cronSecret = process.env.CRON_SECRET;
    const auth = request.headers.get('authorization');
    const internal = request.headers.get('x-push-secret');
    const cronOk = !!cronSecret && auth === `Bearer ${cronSecret}`;
    const internalOk = !!internal && internal === process.env.PUSH_SECRET;
    if (!cronOk && !internalOk) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!cronSecret) {
        return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
    }

    const now = new Date();
    const hour = now.getUTCHours();
    const day = now.getUTCDate();
    const month = now.getUTCMonth() + 1;

    const origin = new URL(request.url).origin;
    const ran: { path: string; status: number | string; body?: unknown; error?: string }[] = [];

    const trigger = async (path: string) => {
        try {
            const r = await fetch(`${origin}${path}`, {
                headers: { authorization: `Bearer ${cronSecret}` },
                cache: 'no-store',
            });
            ran.push({ path, status: r.status, body: await r.json().catch(() => null) });
        } catch (e) {
            ran.push({ path, status: 'rejected', error: String(e) });
        }
    };

    // Slot tick fires every hour — the route itself filters to users whose
    // local hour matches one of the slot windows.
    await trigger('/api/cron/slot-tick');

    // Calendar-conditional jobs once a day, at the historical 03:00 UTC tick.
    if (hour === 3) {
        if (day === 1) {
            await trigger('/api/cron/monthly-recap');
            await trigger('/api/cron/monthly-allowance-reset');
        }
        if (day === 15) {
            await trigger('/api/cron/midmonth-comparison');
        }
        if (month === 1 && day === 2) {
            await trigger('/api/cron/yearly-recap');
        }
    }

    return NextResponse.json({ ok: true, hour, day, month, ran });
}
