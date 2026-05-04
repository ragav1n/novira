import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// Server-side proxy for v6.exchangerate-api.com so the API key stays out of the
// browser. Two modes:
//   GET /api/exchange-rate?from=USD                    → latest rates
//   GET /api/exchange-rate?from=USD&date=2026-05-04    → historical rates for that day
//
// Returns the upstream JSON body verbatim with conversion_rates: { ...currency: rate }.
export async function GET(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const from = url.searchParams.get('from');
    const date = url.searchParams.get('date');

    if (!from || !/^[A-Z]{3}$/.test(from)) {
        return NextResponse.json({ error: 'from must be a 3-letter currency code' }, { status: 400 });
    }
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 });
    }

    const apiKey = process.env.EXCHANGERATE_API_KEY ?? process.env.NEXT_PUBLIC_EXCHANGERATE_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: 'Exchange rate provider not configured' }, { status: 503 });
    }

    let upstream: string;
    if (date) {
        const [yyyy, mm, dd] = date.split('-');
        upstream = `https://v6.exchangerate-api.com/v6/${apiKey}/history/${from}/${yyyy}/${mm}/${dd}`;
    } else {
        upstream = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${from}`;
    }

    try {
        const res = await fetch(upstream);
        if (!res.ok) {
            return NextResponse.json({ error: `Upstream ${res.status}` }, { status: 502 });
        }
        const body = await res.json();
        return NextResponse.json(body);
    } catch (err) {
        console.error('[exchange-rate proxy]', err);
        return NextResponse.json({ error: 'Upstream fetch failed' }, { status: 502 });
    }
}
