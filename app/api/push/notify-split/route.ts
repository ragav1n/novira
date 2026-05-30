import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient as createSsrClient } from '@/utils/supabase/server';
import {
    cleanupExpired,
    fmtMoney,
    loadSubsByUser,
    pushReady,
    sendToUser,
} from '@/lib/server/push';
import { isInQuietHours } from '@/lib/push-quiet-hours';
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rate-limit';

const RATE_CFG = { max: 30, windowMs: 60 * 60 * 1000 };

interface SplitRow {
    id: string;
    user_id: string;
    amount: number;
    transaction: {
        user_id: string;
        description: string | null;
        currency: string | null;
    } | null;
}

interface RecipientProfile {
    id: string;
    full_name: string | null;
    timezone: string | null;
    settlement_notifications_enabled: boolean | null;
    quiet_hours_start: number | null;
    quiet_hours_end: number | null;
}

interface CreatorProfile {
    id: string;
    full_name: string | null;
}

/**
 * Client-triggered fan-out: the split creator's device calls this immediately
 * after inserting splits, so debtors get a push even when their app is closed.
 * Auth is the SSR cookie session — only the caller authoring the splits can
 * fire pushes. Dedup via `notification_send_log` (kind = `event:split:<id>`)
 * keeps multiple devices on the creator side from sending duplicates.
 */
export async function POST(request: NextRequest) {
    if (!pushReady) {
        return NextResponse.json({ error: 'Push notifications not configured' }, { status: 503 });
    }

    const ssr = await createSsrClient();
    const { data: { user } } = await ssr.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limit = checkRateLimit('notify-split', user.id, RATE_CFG);
    if (!limit.allowed) return rateLimitResponse(limit, RATE_CFG);

    let body: { transaction_id?: unknown };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const transactionId = typeof body.transaction_id === 'string' ? body.transaction_id : '';
    if (!transactionId) {
        return NextResponse.json({ error: 'transaction_id required' }, { status: 400 });
    }

    const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceUrl || !serviceKey) {
        return NextResponse.json({ error: 'Service role not configured' }, { status: 503 });
    }
    const supabase = createServiceClient(serviceUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: splits, error: splitsErr } = await supabase
        .from('splits')
        .select('id, user_id, amount, transaction:transactions!inner(user_id, description, currency)')
        .eq('transaction_id', transactionId)
        .returns<SplitRow[]>();
    if (splitsErr) {
        console.error('[notify-split] splits fetch failed', splitsErr.message);
        return NextResponse.json({ error: splitsErr.message }, { status: 500 });
    }

    // Only the transaction owner may notify on its splits — anything else
    // would let a third party fire pushes about transactions they don't own.
    const eligible = (splits || []).filter(s => {
        const tx = Array.isArray(s.transaction) ? s.transaction[0] : s.transaction;
        return tx && tx.user_id === user.id && s.user_id !== user.id;
    });
    if (!eligible.length) return NextResponse.json({ sent: 0 });

    const recipientIds = Array.from(new Set(eligible.map(s => s.user_id)));
    const [{ data: profiles }, { data: creator }] = await Promise.all([
        supabase
            .from('profiles')
            .select('id, full_name, timezone, settlement_notifications_enabled, quiet_hours_start, quiet_hours_end')
            .in('id', recipientIds)
            .returns<RecipientProfile[]>(),
        supabase
            .from('profiles')
            .select('id, full_name')
            .eq('id', user.id)
            .maybeSingle<CreatorProfile>(),
    ]);

    const profileById = new Map((profiles || []).map(p => [p.id, p]));
    const creatorName = creator?.full_name?.trim() || 'a friend';

    const now = new Date();
    const dedupKind = `event:split-tx:${transactionId}`;
    const { data: alreadySent } = await supabase
        .from('notification_send_log')
        .select('user_id')
        .eq('kind', dedupKind)
        .in('user_id', recipientIds);
    const alreadySentSet = new Set((alreadySent || []).map(r => r.user_id));

    const subsByUser = await loadSubsByUser(supabase, recipientIds);
    const expired: string[] = [];
    let sent = 0;
    let skippedDisabled = 0;
    let skippedQuiet = 0;
    let skippedNoSubs = 0;
    let skippedDuplicate = 0;

    // Aggregate per recipient — one push per recipient even if a single
    // transaction was split across multiple lines for them.
    interface PerRecipient { total: number; count: number; currency: string; desc: string; }
    const byRecipient = new Map<string, PerRecipient>();
    for (const s of eligible) {
        const tx = Array.isArray(s.transaction) ? s.transaction[0] : s.transaction;
        if (!tx) continue;
        const existing = byRecipient.get(s.user_id);
        if (existing) {
            existing.total += Number(s.amount) || 0;
            existing.count += 1;
        } else {
            byRecipient.set(s.user_id, {
                total: Number(s.amount) || 0,
                count: 1,
                currency: (tx.currency || 'USD').toUpperCase(),
                desc: (tx.description || '').trim(),
            });
        }
    }

    for (const [recipientId, agg] of byRecipient.entries()) {
        if (alreadySentSet.has(recipientId)) {
            skippedDuplicate++;
            continue;
        }
        const profile = profileById.get(recipientId);
        if (profile && profile.settlement_notifications_enabled === false) {
            skippedDisabled++;
            continue;
        }
        if (profile && isInQuietHours(profile.timezone, profile.quiet_hours_start, profile.quiet_hours_end, now)) {
            skippedQuiet++;
            continue;
        }
        if (!subsByUser.has(recipientId)) {
            skippedNoSubs++;
            continue;
        }

        const moneyText = fmtMoney(agg.total, agg.currency);
        const title = agg.count === 1 ? `New split: ${moneyText}` : `${agg.count} new splits: ${moneyText}`;
        const descPart = agg.desc ? `${agg.desc}: ` : '';
        const body = `${descPart}you owe ${creatorName} ${moneyText}`;

        const delivered = await sendToUser(
            supabase,
            subsByUser,
            recipientId,
            { title, body, url: '/groups' },
            expired,
            dedupKind,
        );
        if (delivered > 0) sent += delivered;
    }

    await cleanupExpired(supabase, expired);

    return NextResponse.json({
        sent,
        recipients: byRecipient.size,
        skipped: { disabled: skippedDisabled, quiet: skippedQuiet, noSubs: skippedNoSubs, duplicate: skippedDuplicate },
    });
}
