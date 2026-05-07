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
    amount: number;
    currency: string | null;
    category: string | null;
    description: string;
    date: string;
}

interface ProfileRow {
    id: string;
    last_anomaly_notified_at: string | null;
}

function ymd(d: Date): string { return d.toISOString().slice(0, 10); }

function median(values: number[]): number {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export async function GET(request: NextRequest) {
    const denied = authorizeCron(request);
    if (denied) return denied;
    const supabase = getServiceSupabase();
    if (supabase instanceof NextResponse) return supabase;

    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const yesterday = new Date(today); yesterday.setUTCDate(today.getUTCDate() - 1);
    const ninetyAgo = new Date(today); ninetyAgo.setUTCDate(today.getUTCDate() - 90);

    const { data: yesterdayTxs } = await supabase
        .from('transactions')
        .select('id, user_id, amount, currency, category, description, date')
        .eq('date', ymd(yesterday))
        .eq('exclude_from_allowance', false)
        .returns<TxRow[]>();
    if (!yesterdayTxs?.length) return NextResponse.json({ scanned: 0, notified: 0 });

    const userIds = Array.from(new Set(yesterdayTxs.map(t => t.user_id)));
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, last_anomaly_notified_at')
        .in('id', userIds)
        .returns<ProfileRow[]>();
    const profileById = new Map((profiles || []).map(p => [p.id, p]));

    const eligibleUsers = userIds.filter(uid => profileById.get(uid)?.last_anomaly_notified_at !== ymd(today));
    if (!eligibleUsers.length) return NextResponse.json({ scanned: yesterdayTxs.length, notified: 0 });

    const { data: history } = await supabase
        .from('transactions')
        .select('user_id, amount, currency, category, date')
        .in('user_id', eligibleUsers)
        .gte('date', ymd(ninetyAgo))
        .lt('date', ymd(yesterday))
        .eq('exclude_from_allowance', false)
        .returns<{ user_id: string; amount: number; currency: string | null; category: string | null; date: string }[]>();

    const histByKey = new Map<string, number[]>();
    for (const h of history || []) {
        const key = `${h.user_id}|${(h.category || '').toLowerCase()}|${(h.currency || 'USD').toUpperCase()}`;
        const arr = histByKey.get(key) || [];
        arr.push(Number(h.amount));
        histByKey.set(key, arr);
    }

    interface Anomaly { tx: TxRow; med: number; mult: number; }
    const anomaliesByUser = new Map<string, Anomaly>();

    for (const tx of yesterdayTxs) {
        if (!eligibleUsers.includes(tx.user_id)) continue;
        const key = `${tx.user_id}|${(tx.category || '').toLowerCase()}|${(tx.currency || 'USD').toUpperCase()}`;
        const hist = histByKey.get(key) || [];
        if (hist.length < 5) continue; // need a baseline to call something unusual
        const med = median(hist);
        if (med <= 0) continue;
        const amt = Number(tx.amount);
        if (amt < med * 2.5) continue;
        const existing = anomaliesByUser.get(tx.user_id);
        if (!existing || amt / med > existing.mult) {
            anomaliesByUser.set(tx.user_id, { tx, med, mult: amt / med });
        }
    }

    if (!anomaliesByUser.size) return NextResponse.json({ scanned: yesterdayTxs.length, notified: 0 });

    const subsByUser = await loadSubsByUser(supabase, Array.from(anomaliesByUser.keys()));
    const expired: string[] = [];
    let pushSent = 0;

    for (const [userId, a] of anomaliesByUser) {
        const ccy = (a.tx.currency || 'USD').toUpperCase();
        const cat = a.tx.category || 'spending';
        const sent = await sendToUser(supabase, subsByUser, userId, {
            title: `Unusual ${cat} spend`,
            body: `${fmtMoney(Number(a.tx.amount), ccy)} — about ${a.mult.toFixed(1)}× your usual.`,
            url: '/dashboard',
        }, expired, 'event:tx-anomaly');
        pushSent += sent;
        if (sent > 0) {
            await supabase.from('profiles').update({ last_anomaly_notified_at: ymd(today) }).eq('id', userId);
        }
    }

    await cleanupExpired(supabase, expired);
    return NextResponse.json({ scanned: yesterdayTxs.length, notified: anomaliesByUser.size, pushSent });
}
