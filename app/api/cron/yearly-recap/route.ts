import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export const maxDuration = 60;

function priorYearRange() {
    const now = new Date();
    const year = now.getUTCFullYear() - 1;
    return {
        year,
        key: `${year}-FY`,
        startStr: `${year}-01-01`,
        endStr: `${year}-12-31`
    };
}

function workerBaseUrl(request: NextRequest) {
    if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
    return new URL(request.url).origin;
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

    const pushSecret = process.env.PUSH_SECRET;
    if (!pushSecret) {
        return NextResponse.json({ error: 'PUSH_SECRET not configured' }, { status: 503 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
        return NextResponse.json({ error: 'Service role key not configured' }, { status: 503 });
    }

    const supabase = createServiceClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false }
    });

    const { year, key, startStr, endStr } = priorYearRange();

    const { data: txs, error: txErr } = await supabase
        .from('transactions')
        .select('user_id')
        .gte('date', startStr)
        .lte('date', endStr);
    if (txErr) {
        console.error('[yearly-recap-cron] tx fetch failed', txErr);
        return NextResponse.json({ error: txErr.message }, { status: 500 });
    }
    const activeUserIds = Array.from(new Set((txs || []).map(t => t.user_id as string)));
    if (!activeUserIds.length) return NextResponse.json({ dispatched: 0, year: key });

    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, currency')
        .in('id', activeUserIds);
    const currencyByUser = new Map<string, string>(
        (profiles || []).map(p => [p.id as string, ((p.currency as string) || 'USD').toUpperCase()])
    );

    const baseUrl = workerBaseUrl(request);
    const workerUrl = `${baseUrl}/api/cron/_recap-worker`;
    const pushPayload = {
        title: `Your ${year} year in money is here`,
        body: 'See how the whole year stacked up — open Novira.',
        url: '/analytics',
        icon: '/Novira.png'
    };

    const dispatchResults = await Promise.allSettled(
        activeUserIds.map(uid =>
            fetch(workerUrl, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    'x-push-secret': pushSecret
                },
                body: JSON.stringify({
                    userId: uid,
                    period: key,
                    currency: currencyByUser.get(uid) || 'USD',
                    push: pushPayload
                }),
                keepalive: true
            })
        )
    );

    let dispatched = 0;
    let dispatchFailed = 0;
    for (const r of dispatchResults) {
        if (r.status === 'fulfilled' && r.value.ok) dispatched++;
        else {
            dispatchFailed++;
            if (r.status === 'rejected') console.error('[yearly-recap-cron] dispatch error', r.reason);
            else console.error('[yearly-recap-cron] worker non-2xx', r.value.status);
        }
    }

    return NextResponse.json({
        year: key,
        active: activeUserIds.length,
        dispatched,
        dispatchFailed
    });
}
