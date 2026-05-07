import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import {
    authorizeCron,
    getServiceSupabase,
    loadSubsByUser,
    sendToUser,
    cleanupExpired,
} from '@/lib/server/push';

const CELEBRATE_AT = [3, 7, 14, 30] as const;

interface ProfileRow {
    id: string;
    last_no_spend_streak: number | null;
}

interface DateRow {
    user_id: string;
    date: string;
}

function ymd(d: Date): string { return d.toISOString().slice(0, 10); }

export async function GET(request: NextRequest) {
    const denied = authorizeCron(request);
    if (denied) return denied;
    const supabase = getServiceSupabase();
    if (supabase instanceof NextResponse) return supabase;

    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const lookback = new Date(today); lookback.setUTCDate(today.getUTCDate() - 31);

    // Limit to users with subscriptions so we don't scan everyone.
    const { data: subUsers } = await supabase
        .from('push_subscriptions')
        .select('user_id')
        .returns<{ user_id: string }[]>();
    const candidateIds = Array.from(new Set((subUsers || []).map(s => s.user_id)));
    if (!candidateIds.length) return NextResponse.json({ scanned: 0, notified: 0 });

    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, last_no_spend_streak')
        .in('id', candidateIds)
        .returns<ProfileRow[]>();

    const { data: txDates } = await supabase
        .from('transactions')
        .select('user_id, date')
        .in('user_id', candidateIds)
        .gte('date', ymd(lookback))
        .lte('date', ymd(today))
        .eq('exclude_from_allowance', false)
        .returns<DateRow[]>();

    const datesByUser = new Map<string, Set<string>>();
    for (const t of txDates || []) {
        const set = datesByUser.get(t.user_id) || new Set<string>();
        set.add(t.date);
        datesByUser.set(t.user_id, set);
    }

    interface Streak { profile: ProfileRow; length: number; }
    const streaks: Streak[] = [];

    for (const p of profiles || []) {
        const dates = datesByUser.get(p.id) || new Set<string>();
        // Only count if they've ever logged a transaction in the lookback window
        // (otherwise a brand-new user gets falsely celebrated).
        if (dates.size === 0) continue;
        let streak = 0;
        const cursor = new Date(today);
        // Skip today itself — only count complete prior days.
        cursor.setUTCDate(cursor.getUTCDate() - 1);
        while (streak < 31) {
            if (dates.has(ymd(cursor))) break;
            streak++;
            cursor.setUTCDate(cursor.getUTCDate() - 1);
        }
        // Did we just cross a celebration milestone?
        const milestone = [...CELEBRATE_AT].reverse().find(m => streak >= m && (p.last_no_spend_streak || 0) < m);
        if (milestone) streaks.push({ profile: p, length: milestone });
    }

    if (!streaks.length) return NextResponse.json({ scanned: profiles?.length || 0, notified: 0 });

    const subsByUser = await loadSubsByUser(supabase, streaks.map(s => s.profile.id));
    const expired: string[] = [];
    let pushSent = 0;

    for (const s of streaks) {
        const next = CELEBRATE_AT.find(m => m > s.length);
        const teaser = next ? ` Day ${s.length + 1}?` : '';
        const sent = await sendToUser(supabase, subsByUser, s.profile.id, {
            title: `${s.length}-day no-spend streak`,
            body: `Nice run.${teaser}`,
            url: '/analytics',
        }, expired, 'event:no-spend');
        pushSent += sent;
        if (sent > 0) {
            await supabase.from('profiles').update({ last_no_spend_streak: s.length }).eq('id', s.profile.id);
        }
    }

    // Reset streak counter for anyone who logged a tx yesterday so the next milestone fires fresh.
    const userIdsWithRecent = (txDates || [])
        .filter(t => t.date === ymd(new Date(today.getTime() - 86400000)))
        .map(t => t.user_id);
    if (userIdsWithRecent.length) {
        await supabase.from('profiles')
            .update({ last_no_spend_streak: 0 })
            .in('id', Array.from(new Set(userIdsWithRecent)))
            .gt('last_no_spend_streak', 0);
    }

    await cleanupExpired(supabase, expired);
    return NextResponse.json({ scanned: profiles?.length || 0, notified: streaks.length, pushSent });
}
