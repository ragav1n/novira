import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import {
    authorizeCron,
    getServiceSupabase,
    loadSubsByUser,
    sendToUser,
    cleanupExpired,
} from '@/lib/server/push';

const THRESHOLDS = [50, 75, 100] as const;

interface GoalRow {
    id: string;
    user_id: string;
    name: string;
    target_amount: number;
    current_amount: number;
    last_threshold_notified: number | null;
}

export async function GET(request: NextRequest) {
    const denied = authorizeCron(request);
    if (denied) return denied;
    const supabase = getServiceSupabase();
    if (supabase instanceof NextResponse) return supabase;

    const { data: goals } = await supabase
        .from('savings_goals')
        .select('id, user_id, name, target_amount, current_amount, last_threshold_notified')
        .gt('target_amount', 0)
        .returns<GoalRow[]>();
    if (!goals?.length) return NextResponse.json({ scanned: 0, notified: 0 });

    interface Crossing { goal: GoalRow; threshold: number; pct: number; }
    const crossings: Crossing[] = [];
    for (const g of goals) {
        const cur = Number(g.current_amount) || 0;
        const tgt = Number(g.target_amount) || 0;
        if (tgt <= 0) continue;
        const pct = (cur / tgt) * 100;
        const already = g.last_threshold_notified || 0;
        const reached = [...THRESHOLDS].reverse().find(t => pct >= t && t > already);
        if (reached) crossings.push({ goal: g, threshold: reached, pct });
    }

    if (!crossings.length) return NextResponse.json({ scanned: goals.length, notified: 0 });

    const subsByUser = await loadSubsByUser(supabase, Array.from(new Set(crossings.map(c => c.goal.user_id))));
    const expired: string[] = [];
    let pushSent = 0;

    for (const c of crossings) {
        const title = c.threshold === 100
            ? `${c.goal.name} fully funded`
            : `${c.goal.name} at ${c.threshold}%`;
        const body = c.threshold === 100
            ? "You hit your target — time to celebrate."
            : `${c.pct.toFixed(0)}% of your savings goal saved.`;
        const sent = await sendToUser(supabase, subsByUser, c.goal.user_id, {
            title, body, url: '/goals',
        }, expired, 'event:goal-threshold');
        pushSent += sent;
        if (sent > 0) {
            await supabase.from('savings_goals').update({ last_threshold_notified: c.threshold }).eq('id', c.goal.id);
        }
    }

    await cleanupExpired(supabase, expired);
    return NextResponse.json({ scanned: goals.length, notified: crossings.length, pushSent });
}
