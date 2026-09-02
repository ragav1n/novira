import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { generateRecap, VALID_PERIOD_RE } from '@/lib/recap-generator';
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rate-limit';
import { profileCurrency } from '@/lib/server/currency';

const READ_CFG = { max: 120, windowMs: 60_000 };
const GENERATE_CFG = { max: 10, windowMs: 24 * 60 * 60 * 1000 };

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

    const readLimit = checkRateLimit('recap-read', user.id, READ_CFG);
    if (!readLimit.allowed) return rateLimitResponse(readLimit, READ_CFG);

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
            return NextResponse.json({ error: 'Unable to load recap' }, { status: 500 });
        }
        if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        // The client can't work this out for itself: on a cold mount its
        // currency is still the provider's default, so it would call a perfectly
        // good recap stale and regenerate it on every open.
        let currencyStale = false;
        try {
            const stored = (data.recap as { currency?: string } | null)?.currency;
            currencyStale = stored !== await profileCurrency(supabase, user.id);
        } catch (err) {
            // Reads fine without it. Left false so an unverifiable currency defers
            // the rebuild instead of spending a generation on a guess.
            console.error('[recap GET] currency lookup failed', err);
        }
        return NextResponse.json({ ...data, currencyStale });
    }

    const { data, error } = await supabase
        .from('monthly_recaps')
        .select('month, created_at, seen_at')
        .eq('user_id', user.id)
        .order('month', { ascending: false });
    if (error) {
        console.error('[recap GET list]', error);
        return NextResponse.json({ error: 'Unable to load recaps' }, { status: 500 });
    }
    return NextResponse.json({ months: data || [] });
}

// POST /api/recap  { month, force? }
// Returns the cached recap unless force=true or it was built in a currency the
// user no longer uses.
export async function POST(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const genLimit = checkRateLimit('recap-generate', user.id, GENERATE_CFG);
    if (!genLimit.allowed) return rateLimitResponse(genLimit, GENERATE_CFG, `Daily recap generation limit reached (${GENERATE_CFG.max}/day).`);

    const { month, force } = (await req.json()) as { month?: string; force?: boolean };
    if (!month || !isValidMonthPeriod(month)) {
        return NextResponse.json({ error: 'month must be YYYY-MM or YYYY-FY' }, { status: 400 });
    }
    let baseCurrency: string;
    try {
        baseCurrency = await profileCurrency(supabase, user.id);
    } catch (err) {
        // Generating against a guess would persist a recap in the wrong currency.
        console.error('[recap POST] currency lookup failed', err);
        return NextResponse.json({ error: 'Unable to read your currency preference' }, { status: 500 });
    }

    if (!force) {
        const { data: existing } = await supabase
            .from('monthly_recaps')
            .select('month, recap, analyzed, created_at, seen_at')
            .eq('user_id', user.id)
            .eq('month', month)
            .maybeSingle();
        // A recap carries its currency in its totals and in the symbol the model
        // wrote into every sentence, so one built against a different base is
        // stale in the same way an out-of-date one is. Rebuild it.
        if (existing && (existing.recap as { currency?: string } | null)?.currency === baseCurrency) {
            return NextResponse.json({ ...existing, cached: true });
        }
    }

    try {
        const { recap, analyzed } = await generateRecap(supabase, user.id, month, baseCurrency);
        return NextResponse.json({ month, recap, analyzed, cached: false });
    } catch (err: unknown) {
        console.error('[recap] generation failed', err);
        return NextResponse.json({ error: 'Recap generation failed' }, { status: 500 });
    }
}

// PATCH /api/recap  { month }   → mark as seen
export async function PATCH(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const readLimit = checkRateLimit('recap-read', user.id, READ_CFG);
    if (!readLimit.allowed) return rateLimitResponse(readLimit, READ_CFG);

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
        return NextResponse.json({ error: 'Unable to update recap' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
}
