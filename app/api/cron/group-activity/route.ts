import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import {
    authorizeCron,
    getServiceSupabase,
    loadSubsByUser,
    sendToUser,
    cleanupExpired,
    fmtMoney,
} from '@/lib/server/push';

interface TxRow {
    id: string;
    user_id: string;
    group_id: string | null;
    amount: number;
    currency: string | null;
    description: string;
    created_at: string;
}

interface MemberRow {
    group_id: string;
    user_id: string;
}

interface GroupRow {
    id: string;
    name: string;
}

interface ProfileRow {
    id: string;
    last_group_activity_at: string | null;
}

export async function GET(request: NextRequest) {
    const denied = authorizeCron(request);
    if (denied) return denied;
    const supabase = getServiceSupabase();
    if (supabase instanceof NextResponse) return supabase;

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const { data: txs } = await supabase
        .from('transactions')
        .select('id, user_id, group_id, amount, currency, description, created_at')
        .not('group_id', 'is', null)
        .gte('created_at', cutoff.toISOString())
        .returns<TxRow[]>();
    if (!txs?.length) return NextResponse.json({ scanned: 0, notified: 0 });

    const groupIds = Array.from(new Set(txs.map(t => t.group_id!).filter(Boolean)));
    const [{ data: members }, { data: groups }] = await Promise.all([
        supabase.from('group_members').select('group_id, user_id').in('group_id', groupIds).returns<MemberRow[]>(),
        supabase.from('groups').select('id, name').in('id', groupIds).returns<GroupRow[]>(),
    ]);

    const groupNameById = new Map((groups || []).map(g => [g.id, g.name]));
    const membersByGroup = new Map<string, string[]>();
    for (const m of members || []) {
        const arr = membersByGroup.get(m.group_id) || [];
        arr.push(m.user_id);
        membersByGroup.set(m.group_id, arr);
    }

    interface PerUserSummary { groupId: string; groupName: string; count: number; total: number; ccy: string; lastDesc: string; lastActor: string; }
    const summariesByUser = new Map<string, PerUserSummary[]>();

    for (const groupId of groupIds) {
        const groupTxs = txs.filter(t => t.group_id === groupId);
        if (!groupTxs.length) continue;
        const groupName = groupNameById.get(groupId) || 'shared bucket';
        const groupMembers = membersByGroup.get(groupId) || [];

        for (const memberId of groupMembers) {
            const others = groupTxs.filter(t => t.user_id !== memberId);
            if (!others.length) continue;
            const totalsByCcy = new Map<string, number>();
            for (const t of others) {
                const c = (t.currency || 'USD').toUpperCase();
                totalsByCcy.set(c, (totalsByCcy.get(c) || 0) + Number(t.amount));
            }
            // Pick the dominant-currency total.
            const [topCcy, topTotal] = Array.from(totalsByCcy.entries()).sort((a, b) => b[1] - a[1])[0];
            const last = others[others.length - 1];
            const arr = summariesByUser.get(memberId) || [];
            arr.push({
                groupId,
                groupName,
                count: others.length,
                total: topTotal,
                ccy: topCcy,
                lastDesc: last.description,
                lastActor: last.user_id,
            });
            summariesByUser.set(memberId, arr);
        }
    }

    if (!summariesByUser.size) return NextResponse.json({ scanned: txs.length, notified: 0 });

    const userIds = Array.from(summariesByUser.keys());
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, last_group_activity_at')
        .in('id', userIds)
        .returns<ProfileRow[]>();
    const profileById = new Map((profiles || []).map(p => [p.id, p]));
    const eligibleUsers = userIds.filter(uid => {
        const last = profileById.get(uid)?.last_group_activity_at;
        if (!last) return true;
        return Date.now() - new Date(last).getTime() >= 20 * 60 * 60 * 1000; // ~daily cadence
    });
    if (!eligibleUsers.length) return NextResponse.json({ scanned: txs.length, notified: 0 });

    const subsByUser = await loadSubsByUser(supabase, eligibleUsers);
    const expired: string[] = [];
    let pushSent = 0;

    for (const userId of eligibleUsers) {
        const summaries = summariesByUser.get(userId) || [];
        if (!summaries.length) continue;
        // If only one group has activity, use a richer single-group title.
        let title: string; let body: string; let url: string;
        if (summaries.length === 1) {
            const s = summaries[0];
            title = `New activity in ${s.groupName}`;
            body = s.count === 1
                ? `${fmtMoney(s.total, s.ccy)} added — "${s.lastDesc}".`
                : `${s.count} expenses by others — ${fmtMoney(s.total, s.ccy)} total.`;
            url = '/groups';
        } else {
            const totalCount = summaries.reduce((sum, s) => sum + s.count, 0);
            title = `Activity across ${summaries.length} groups`;
            body = `${totalCount} new expenses by others.`;
            url = '/groups';
        }
        const sent = await sendToUser(supabase, subsByUser, userId, { title, body, url }, expired);
        pushSent += sent;
        if (sent > 0) {
            await supabase.from('profiles').update({ last_group_activity_at: new Date().toISOString() }).eq('id', userId);
        }
    }

    await cleanupExpired(supabase, expired);
    return NextResponse.json({ scanned: txs.length, notified: eligibleUsers.length, pushSent });
}
