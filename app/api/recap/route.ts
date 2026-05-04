import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { generateRecap, VALID_PERIOD_RE } from '@/lib/recap-generator';

// VALID_PERIOD_RE allows shapes like "2099-99" or "0000-13". Bound the numeric
// pieces here so callers can't trigger needlessly expensive queries.
function isValidMonthPeriod(value: string): boolean {
    if (!VALID_PERIOD_RE.test(value)) return false;
    const year = parseInt(value.slice(0, 4), 10);
    if (year < 2000 || year > 2100) return false;
    const tail = value.slice(5);
    if (tail === 'FY') return true;
    const month = parseInt(tail, 10);
    return month >= 1 && month <= 12;
}

// GET /api/recap                   → list of months the user has stored recaps for
// GET /api/recap?month=YYYY-MM     → stored recap for that month, or 404
export async function GET(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const month = url.searchParams.get('month');

    if (month) {
        if (!isValidMonthPeriod(month)) {
            return NextResponse.json({ error: 'month must be YYYY-MM or YYYY-FY' }, { status: 400 });
        }
        const { data, error } = await supabase
            .from('monthly_recaps')
            .select('month, recap, analyzed, created_at, seen_at')
            .eq('user_id', user.id)
            .eq('month', month)
            .maybeSingle();
        if (error) {
            console.error('[recap GET]', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        return NextResponse.json(data);
    }

    const { data, error } = await supabase
        .from('monthly_recaps')
        .select('month, created_at, seen_at')
        .eq('user_id', user.id)
        .order('month', { ascending: false });
    if (error) {
        console.error('[recap GET list]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ months: data || [] });
}

// POST /api/recap  { month, currency, force? }
// Returns cached recap unless force=true.
export async function POST(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { month, currency, force } = (await req.json()) as { month?: string; currency?: string; force?: boolean };
    if (!month || !isValidMonthPeriod(month)) {
        return NextResponse.json({ error: 'month must be YYYY-MM or YYYY-FY' }, { status: 400 });
    }
    const baseCurrency = (currency || 'USD').toUpperCase();

    if (!force) {
        const { data: existing } = await supabase
            .from('monthly_recaps')
            .select('month, recap, analyzed, created_at, seen_at')
            .eq('user_id', user.id)
            .eq('month', month)
            .maybeSingle();
        if (existing) {
            return NextResponse.json({ ...existing, cached: true });
        }
    }

    try {
        const { recap, analyzed } = await generateRecap(supabase, user.id, month, baseCurrency);
        return NextResponse.json({ month, recap, analyzed, cached: false });
    } catch (err: unknown) {
        console.error('[recap] generation failed', err);
        const msg = err instanceof Error ? err.message : 'Recap generation failed';
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// PATCH /api/recap  { month }   → mark as seen
export async function PATCH(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { month } = (await req.json()) as { month?: string };
    if (!month || !isValidMonthPeriod(month)) {
        return NextResponse.json({ error: 'month must be YYYY-MM or YYYY-FY' }, { status: 400 });
    }
    const { error } = await supabase
        .from('monthly_recaps')
        .update({ seen_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('month', month);
    if (error) {
        console.error('[recap PATCH]', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
}
