import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import {
    authorizeCron,
    getServiceSupabase,
    loadSubsByUser,
    sendToUser,
    cleanupExpired,
} from '@/lib/server/push';

interface ProfileRow {
    id: string;
    last_reengagement_at: string | null;
}

interface RecentTx {
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
    const fiveAgo = new Date(today); fiveAgo.setUTCDate(today.getUTCDate() - 5);
    const fortnightAgo = new Date(today); fortnightAgo.setUTCDate(today.getUTCDate() - 14);

    // Only target users who have any subscription so we don't pester everyone.
    const { data: subUsers } = await supabase
        .from('push_subscriptions')
        .select('user_id')
        .returns<{ user_id: string }[]>();
    const candidateIds = Array.from(new Set((subUsers || []).map(s => s.user_id)));
    if (!candidateIds.length) return NextResponse.json({ scanned: 0, notified: 0 });

    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, last_reengagement_at')
        .in('id', candidateIds)
        .returns<ProfileRow[]>();

    const eligible = (profiles || []).filter(p => {
        if (!p.last_reengagement_at) return true;
        const last = new Date(p.last_reengagement_at + 'T00:00:00Z');
        return last < fortnightAgo;
    });
    if (!eligible.length) return NextResponse.json({ scanned: profiles?.length || 0, notified: 0 });

    // Find each candidate's most recent transaction date.
    const { data: latest } = await supabase
        .from('transactions')
        .select('user_id, date')
        .in('user_id', eligible.map(p => p.id))
        .gte('date', ymd(fiveAgo))
        .returns<RecentTx[]>();
    const recentSet = new Set((latest || []).map(t => t.user_id));

    const idle = eligible.filter(p => !recentSet.has(p.id));
    if (!idle.length) return NextResponse.json({ scanned: profiles?.length || 0, notified: 0 });

    const subsByUser = await loadSubsByUser(supabase, idle.map(p => p.id));
    const expired: string[] = [];
    let pushSent = 0;

    for (const p of idle) {
        const sent = await sendToUser(supabase, subsByUser, p.id, {
            title: 'Quiet week?',
            body: "No expenses logged in 5 days. Tap to catch up.",
            url: '/add',
        }, expired, 'event:re-engagement');
        pushSent += sent;
        if (sent > 0) {
            await supabase.from('profiles').update({ last_reengagement_at: ymd(today) }).eq('id', p.id);
        }
    }

    await cleanupExpired(supabase, expired);
    return NextResponse.json({ scanned: profiles?.length || 0, notified: idle.length, pushSent });
}
