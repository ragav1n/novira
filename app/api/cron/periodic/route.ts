import { NextRequest, NextResponse } from 'next/server';

/**
 * Wrapper cron: runs every day, but only fans out on specific calendar days.
 *  - day 1 of each month → monthly-recap
 *  - Jan 2 each year     → yearly-recap (runs day after monthly so prior-year stats settle)
 * Other days no-op.
 *
 * Lets us cover both monthly and yearly recaps with a single Vercel cron slot
 * (Hobby cap is 2 — this slot pairs with /api/cron/daily).
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

    // Use UTC since Vercel cron runs in UTC. Recap content itself is timezone-agnostic.
    const now = new Date();
    const day = now.getUTCDate();
    const month = now.getUTCMonth() + 1; // 1-12

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

    if (day === 1) {
        await trigger('/api/cron/monthly-recap');
    }
    if (month === 1 && day === 2) {
        await trigger('/api/cron/yearly-recap');
    }

    return NextResponse.json({ ok: true, day, month, ran });
}
