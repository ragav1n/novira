import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import {
    authorizeCron,
    getServiceSupabase,
    pushReady,
    fmtMoney,
    loadSubsByUser,
    sendToUser,
    cleanupExpired,
} from '@/lib/server/push';

interface TemplateRow {
    id: string;
    user_id: string;
    description: string;
    amount: number;
    currency: string | null;
    category: string;
    group_id: string | null;
    is_active: boolean;
    metadata: Record<string, unknown> | null;
}

export async function GET(request: NextRequest) {
    const denied = authorizeCron(request);
    if (denied) return denied;
    const supabase = getServiceSupabase();
    if (supabase instanceof NextResponse) return supabase;

    const { data: templates } = await supabase
        .from('recurring_templates')
        .select('id, user_id, description, amount, currency, category, group_id, is_active, metadata')
        .eq('is_active', true)
        .returns<TemplateRow[]>();
    if (!templates?.length) return NextResponse.json({ scanned: 0, notified: 0 });

    interface Hit { tpl: TemplateRow; lastAmt: number; pct: number; }
    const hits: Hit[] = [];

    for (const t of templates) {
        const escaped = t.description.replace(/[%_\\]/g, '\\$&');
        let q = supabase
            .from('transactions')
            .select('amount, date, currency')
            .eq('user_id', t.user_id)
            .eq('category', t.category)
            .ilike('description', escaped)
            .order('date', { ascending: false })
            .limit(1);
        if (t.group_id) q = q.eq('group_id', t.group_id);
        else q = q.is('group_id', null);
        const { data: txs } = await q;
        if (!txs?.length) continue;
        const last = txs[0] as { amount: number; date: string; currency: string | null };
        const lastAmt = Number(last.amount);
        const tplAmt = Number(t.amount);
        if (!lastAmt || !tplAmt) continue;
        if ((last.currency || 'USD').toUpperCase() !== (t.currency || 'USD').toUpperCase()) continue;
        const pct = ((lastAmt - tplAmt) / tplAmt) * 100;
        if (Math.abs(pct) < 5) continue;
        const lastNotified = (t.metadata?.last_price_notified_amount as number | undefined) ?? null;
        if (lastNotified !== null && Math.abs(lastNotified - lastAmt) < 0.01) continue;
        hits.push({ tpl: t, lastAmt, pct });
    }

    if (!hits.length) return NextResponse.json({ scanned: templates.length, notified: 0 });

    const subsByUser = await loadSubsByUser(supabase, Array.from(new Set(hits.map(h => h.tpl.user_id))));
    const expired: string[] = [];
    let pushSent = 0;

    for (const h of hits) {
        const ccy = (h.tpl.currency || 'USD').toUpperCase();
        const direction = h.pct > 0 ? 'went up' : 'dropped';
        const arrow = h.pct > 0 ? '+' : '';
        const sent = await sendToUser(supabase, subsByUser, h.tpl.user_id, {
            title: `${h.tpl.description} ${direction}`,
            body: `New price: ${fmtMoney(h.lastAmt, ccy)} (${arrow}${h.pct.toFixed(0)}%). Tap to review.`,
            url: '/subscriptions',
        }, expired, 'event:price-change');
        pushSent += sent;
        if (sent > 0 || !pushReady) {
            const newMeta = { ...(h.tpl.metadata || {}), last_price_notified_amount: h.lastAmt };
            await supabase.from('recurring_templates').update({ metadata: newMeta }).eq('id', h.tpl.id);
        }
    }

    await cleanupExpired(supabase, expired);
    return NextResponse.json({ scanned: templates.length, notified: hits.length, pushSent });
}
