import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fmtMoney, type PushPayload } from '@/lib/server/push';

export interface SlotProfile {
    id: string;
    currency: string | null;
    monthly_budget: number | null;
    timezone: string | null;
}

export interface SlotContext {
    profile: SlotProfile;
    /** Today's local civil date (YYYY-MM-DD) */
    localToday: string;
    /** Yesterday's local civil date (YYYY-MM-DD) */
    localYesterday: string;
    /** Tomorrow's local civil date (YYYY-MM-DD) */
    localTomorrow: string;
    /** Sum of today's allowance-affecting spend, base currency. */
    todaySpend: number;
    todayCount: number;
    /** Sum of yesterday's allowance-affecting spend, base currency. */
    yesterdaySpend: number;
    yesterdayCount: number;
    /** Sum of MTD allowance-affecting spend, base currency. */
    mtdSpend: number;
    /** Number of allowance-affecting transactions in last 14 days. */
    txCount14d: number;
    /** Bills due within the next 2 days (today, tomorrow, or +2). */
    upcomingBills: Array<{ description: string; amount: number; currency: string; next_occurrence: string }>;
    /** Bucket whose end_date is closest in the future (within 14 days). */
    nearestBucket: { name: string; end_date: string; daysOut: number } | null;
}

interface TxRow {
    user_id: string;
    amount: number;
    currency: string | null;
    exchange_rate: number | null;
    base_currency: string | null;
    date: string;
    exclude_from_allowance: boolean | null;
}

interface RecurringRow {
    user_id: string;
    description: string;
    amount: number;
    currency: string | null;
    next_occurrence: string;
    is_active: boolean | null;
}

interface BucketRow {
    user_id: string;
    name: string;
    end_date: string | null;
    is_archived: boolean | null;
    completed_at: string | null;
}

function localDate(timezone: string | null, d: Date): string {
    const tz = timezone || 'UTC';
    try {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: tz,
            year: 'numeric', month: '2-digit', day: '2-digit',
        }).format(d);
    } catch {
        return d.toISOString().slice(0, 10);
    }
}

function shiftDays(yyyymmdd: string, n: number): string {
    const d = new Date(yyyymmdd + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
}

function toBaseAmount(tx: TxRow, baseCcy: string): number {
    const txCcy = (tx.currency || 'USD').toUpperCase();
    let amt = Number(tx.amount);
    if (txCcy !== baseCcy && tx.exchange_rate && (tx.base_currency || '').toUpperCase() === baseCcy) {
        amt = amt * Number(tx.exchange_rate);
    }
    return amt;
}

/**
 * Single fetch reused across all 3 composers for a given user. Pulls a 14-day
 * transaction window (covers yesterday/today + activity check), upcoming
 * recurring bills, and the nearest non-archived bucket.
 */
export async function loadSlotContext(
    supabase: SupabaseClient,
    profile: SlotProfile,
    now: Date = new Date(),
): Promise<SlotContext> {
    const tz = profile.timezone;
    const localToday = localDate(tz, now);
    const localYesterday = shiftDays(localToday, -1);
    const localTomorrow = shiftDays(localToday, 1);
    const fourteenAgo = shiftDays(localToday, -14);
    const monthStart = localToday.slice(0, 8) + '01';
    const horizon = shiftDays(localToday, 2);
    const baseCcy = (profile.currency || 'USD').toUpperCase();

    const { data: txs } = await supabase
        .from('transactions')
        .select('user_id, amount, currency, exchange_rate, base_currency, date, exclude_from_allowance')
        .eq('user_id', profile.id)
        .gte('date', fourteenAgo)
        .is('group_id', null)
        .returns<TxRow[]>();

    let todaySpend = 0, todayCount = 0;
    let yesterdaySpend = 0, yesterdayCount = 0;
    let mtdSpend = 0;
    let txCount14d = 0;
    for (const tx of txs || []) {
        if (tx.exclude_from_allowance) continue;
        const amt = toBaseAmount(tx, baseCcy);
        if (amt <= 0) continue;
        const d = tx.date.slice(0, 10);
        txCount14d += 1;
        if (d === localToday) { todaySpend += amt; todayCount += 1; }
        if (d === localYesterday) { yesterdaySpend += amt; yesterdayCount += 1; }
        if (d >= monthStart && d <= localToday) mtdSpend += amt;
    }

    const { data: recs } = await supabase
        .from('recurring_templates')
        .select('user_id, description, amount, currency, next_occurrence, is_active')
        .eq('user_id', profile.id)
        .eq('is_active', true)
        .gte('next_occurrence', localToday)
        .lte('next_occurrence', horizon)
        .order('next_occurrence', { ascending: true })
        .returns<RecurringRow[]>();

    const upcomingBills = (recs || []).map(r => ({
        description: r.description,
        amount: Number(r.amount),
        currency: (r.currency || baseCcy).toUpperCase(),
        next_occurrence: r.next_occurrence,
    }));

    const { data: buckets } = await supabase
        .from('buckets')
        .select('user_id, name, end_date, is_archived, completed_at')
        .eq('user_id', profile.id)
        .eq('is_archived', false)
        .is('completed_at', null)
        .gte('end_date', localToday)
        .lte('end_date', shiftDays(localToday, 14))
        .order('end_date', { ascending: true })
        .limit(1)
        .returns<BucketRow[]>();

    const b = buckets?.[0];
    let nearestBucket: SlotContext['nearestBucket'] = null;
    if (b?.end_date) {
        const days = Math.round(
            (new Date(b.end_date + 'T00:00:00Z').getTime() - new Date(localToday + 'T00:00:00Z').getTime())
            / (1000 * 60 * 60 * 24),
        );
        nearestBucket = { name: b.name, end_date: b.end_date, daysOut: days };
    }

    return {
        profile, localToday, localYesterday, localTomorrow,
        todaySpend, todayCount, yesterdaySpend, yesterdayCount,
        mtdSpend, txCount14d, upcomingBills, nearestBucket,
    };
}

/**
 * "Active user" predicate. Slots fire for users with at least one transaction
 * in the last 14 days. Dormant users stay owned by the re-engagement cron
 * solo. Brand-new users without any transactions naturally fall through —
 * composers also return null when there's no data, so empty pushes are
 * suppressed at both layers.
 */
export function isActiveUser(ctx: SlotContext): boolean {
    return ctx.txCount14d > 0;
}

function dayOfMonth(yyyymmdd: string): number {
    return parseInt(yyyymmdd.slice(8, 10), 10);
}

function daysInMonth(yyyymmdd: string): number {
    const y = parseInt(yyyymmdd.slice(0, 4), 10);
    const m = parseInt(yyyymmdd.slice(5, 7), 10);
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function composeMorning(ctx: SlotContext): PushPayload | null {
    const baseCcy = (ctx.profile.currency || 'USD').toUpperCase();
    const budget = Number(ctx.profile.monthly_budget) || 0;

    if (ctx.txCount14d === 0) return null;

    const parts: string[] = [];
    if (ctx.yesterdayCount > 0) {
        parts.push(`Yesterday ${fmtMoney(ctx.yesterdaySpend, baseCcy)}`);
    }
    if (budget > 0) {
        const remaining = Math.max(0, budget - ctx.mtdSpend);
        const dayCount = daysInMonth(ctx.localToday);
        const daysLeft = Math.max(1, dayCount - dayOfMonth(ctx.localToday) + 1);
        const dailyAllowance = remaining / daysLeft;
        parts.push(`${fmtMoney(dailyAllowance, baseCcy)} to spend today`);
    }
    const billToday = ctx.upcomingBills.find(b => b.next_occurrence === ctx.localToday);
    const billTomorrow = ctx.upcomingBills.find(b => b.next_occurrence === ctx.localTomorrow);
    if (billToday) {
        parts.push(`${billToday.description} due today`);
    } else if (billTomorrow) {
        parts.push(`${billTomorrow.description} due tomorrow`);
    } else if (ctx.nearestBucket && ctx.nearestBucket.daysOut <= 3) {
        parts.push(`${ctx.nearestBucket.name} ends in ${ctx.nearestBucket.daysOut}d`);
    }

    if (!parts.length) return null;

    return {
        title: 'Good morning',
        body: parts.join(' · '),
        url: '/dashboard',
    };
}

export function composeMidday(ctx: SlotContext): PushPayload | null {
    const baseCcy = (ctx.profile.currency || 'USD').toUpperCase();
    const budget = Number(ctx.profile.monthly_budget) || 0;

    if (ctx.mtdSpend <= 0 && ctx.todayCount === 0) return null;
    if (budget <= 0) {
        if (ctx.todayCount === 0) return null;
        return {
            title: 'Midday check-in',
            body: `${fmtMoney(ctx.todaySpend, baseCcy)} spent so far today across ${ctx.todayCount} ${ctx.todayCount === 1 ? 'expense' : 'expenses'}.`,
            url: '/dashboard',
        };
    }

    const day = dayOfMonth(ctx.localToday);
    const dayCount = daysInMonth(ctx.localToday);
    const idealMtd = (budget / dayCount) * day;
    const delta = ctx.mtdSpend - idealMtd;

    let title: string;
    let body: string;
    if (delta > budget * 0.05) {
        title = 'Pacing over budget';
        body = `${fmtMoney(Math.abs(delta), baseCcy)} over the daily curve so far this month.`;
    } else if (delta < -budget * 0.05) {
        title = 'On a strong pace';
        body = `${fmtMoney(Math.abs(delta), baseCcy)} under the daily curve so far this month.`;
    } else {
        title = 'Right on pace';
        body = `${fmtMoney(ctx.mtdSpend, baseCcy)} spent month-to-date.`;
    }

    return { title, body, url: '/analytics' };
}

export function composeEvening(ctx: SlotContext): PushPayload | null {
    const baseCcy = (ctx.profile.currency || 'USD').toUpperCase();

    const billTomorrow = ctx.upcomingBills.find(b => b.next_occurrence === ctx.localTomorrow);
    const parts: string[] = [];

    // Evening summary: prefer today's spend (the day is wrapping up) and fall
    // back to yesterday only if there were no transactions today.
    if (ctx.todayCount > 0) {
        parts.push(`Today ${fmtMoney(ctx.todaySpend, baseCcy)} across ${ctx.todayCount} ${ctx.todayCount === 1 ? 'expense' : 'expenses'}`);
    } else if (ctx.yesterdayCount > 0) {
        parts.push(`Yesterday ${fmtMoney(ctx.yesterdaySpend, baseCcy)} across ${ctx.yesterdayCount} ${ctx.yesterdayCount === 1 ? 'expense' : 'expenses'}`);
    }
    if (billTomorrow) {
        parts.push(`${billTomorrow.description} due tomorrow`);
    }

    if (!parts.length) return null;

    return {
        title: 'Evening check-in',
        body: parts.join(' · '),
        url: '/dashboard',
    };
}
