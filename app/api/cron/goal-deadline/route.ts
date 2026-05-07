import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import {
    authorizeCron,
    getServiceSupabase,
    loadSubsByUser,
    sendToUser,
    cleanupExpired,
} from '@/lib/server/push';

interface GoalRow {
    id: string;
    user_id: string;
    name: string;
    target_amount: number;
    current_amount: number;
    deadline: string | null;
    last_deadline_notified: string | null;
}

function ymd(d: Date): string {
    return d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
    const denied = authorizeCron(request);
    if (denied) return denied;
    const supabase = getServiceSupabase();
    if (supabase instanceof NextResponse) return supabase;

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const inOne = new Date(today); inOne.setUTCDate(today.getUTCDate() + 1);
    const inThree = new Date(today); inThree.setUTCDate(today.getUTCDate() + 3);

    const { data: goals } = await supabase
        .from('savings_goals')
        .select('id, user_id, name, target_amount, current_amount, deadline, last_deadline_notified')
        .not('deadline', 'is', null)
        .in('deadline', [ymd(inOne), ymd(inThree)])
        .returns<GoalRow[]>();
    if (!goals?.length) return NextResponse.json({ scanned: 0, notified: 0 });

    const candidates = goals.filter(g => {
        const isOne = g.deadline === ymd(inOne);
        const want = isOne ? '1d' : '3d';
        return g.last_deadline_notified !== want;
    });
    if (!candidates.length) return NextResponse.json({ scanned: goals.length, notified: 0 });

    const subsByUser = await loadSubsByUser(supabase, Array.from(new Set(candidates.map(g => g.user_id))));
    const expired: string[] = [];
    let pushSent = 0;

    for (const g of candidates) {
        const isOne = g.deadline === ymd(inOne);
        const cur = Number(g.current_amount) || 0;
        const tgt = Number(g.target_amount) || 0;
        const pct = tgt > 0 ? (cur / tgt) * 100 : 0;
        const title = isOne ? `${g.name} due tomorrow` : `${g.name} due in 3 days`;
        const body = pct >= 100
            ? "You've already hit it — final stretch."
            : `${pct.toFixed(0)}% saved so far.`;
        const sent = await sendToUser(supabase, subsByUser, g.user_id, {
            title, body, url: '/goals',
        }, expired, 'event:goal-deadline');
        pushSent += sent;
        if (sent > 0) {
            await supabase.from('savings_goals')
                .update({ last_deadline_notified: isOne ? '1d' : '3d' })
                .eq('id', g.id);
        }
    }

    await cleanupExpired(supabase, expired);
    return NextResponse.json({ scanned: goals.length, notified: candidates.length, pushSent });
}
