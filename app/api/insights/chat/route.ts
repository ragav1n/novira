import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/utils/supabase/server';
import { buildInsightsSnapshot, type SnapshotRange } from '@/lib/insights-snapshot';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = 'claude-haiku-4-5-20251001';

const DAILY_LIMIT = 3;

// Per-user request log for the rolling 24h window. In-memory is enough for our scale —
// Vercel cold starts will occasionally reset it, which is fine for soft abuse prevention.
const requestLog = new Map<string, number[]>();

function checkRateLimit(userId: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const windowMs = 24 * 60 * 60 * 1000;
    const cutoff = now - windowMs;
    const recent = (requestLog.get(userId) || []).filter(ts => ts > cutoff);
    if (recent.length >= DAILY_LIMIT) {
        const resetAt = recent[0] + windowMs;
        requestLog.set(userId, recent);
        return { allowed: false, remaining: 0, resetAt };
    }
    recent.push(now);
    requestLog.set(userId, recent);
    return { allowed: true, remaining: DAILY_LIMIT - recent.length, resetAt: now + windowMs };
}

const SYSTEM_PROMPT = `You are a personal finance analyst embedded in Novira. You answer the user's questions about their own spending using ONLY the JSON snapshot below.

Rules:
- Be direct and specific. Wrap every numeric figure (amounts, percentages, counts) in **double asterisks** so the client can render them bold.
- Use the user's currency: ₹ for INR, $ for USD, € for EUR, £ for GBP. The currency code is in baseCurrency.
- Never invent merchants, categories, dates, or amounts. If the snapshot doesn't contain the answer, say so plainly.
- Keep replies to 1–4 short sentences unless the user explicitly asks for more detail.
- Sort/aggregate from the data when needed (e.g. "biggest expense" = highest amount in sample, "most-visited place" = highest count in byMerchant).
- No moralizing, no emojis, no markdown other than the bold-number convention.
- "byDay" is sorted ascending; "byCategory", "byMerchant", "byPaymentMethod", "byTag" are sorted by total spend descending.
- "sample" is the 50 most recent transactions only — never claim it's exhaustive.`;

interface RequestBody {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    range:
        | { kind: 'preset'; value: '1M' | 'LM' | '3M' | '6M' | '1Y' | 'ALL' }
        | { kind: 'custom'; from: string; to: string };
    baseCurrency: string;
    bucketId?: string | null;
}

function isValidRange(r: unknown): r is SnapshotRange {
    if (!r || typeof r !== 'object') return false;
    const o = r as Record<string, unknown>;
    if (o.kind === 'preset') {
        return typeof o.value === 'string' && ['1M', 'LM', '3M', '6M', '1Y', 'ALL'].includes(o.value);
    }
    if (o.kind === 'custom') {
        return typeof o.from === 'string' && typeof o.to === 'string'
            && /^\d{4}-\d{2}-\d{2}$/.test(o.from) && /^\d{4}-\d{2}-\d{2}$/.test(o.to);
    }
    return false;
}

export async function POST(req: NextRequest) {
    if (!process.env.ANTHROPIC_API_KEY) {
        return NextResponse.json({ error: 'Insights chat is not configured (missing ANTHROPIC_API_KEY).' }, { status: 503 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const limit = checkRateLimit(user.id);
    if (!limit.allowed) {
        const minutes = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 60000));
        const hours = Math.floor(minutes / 60);
        const wait = hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
        return NextResponse.json(
            { error: `Daily limit reached (${DAILY_LIMIT}/day). Try again in ${wait}.`, resetAt: limit.resetAt },
            { status: 429, headers: { 'X-RateLimit-Reset': String(limit.resetAt) } }
        );
    }

    let body: RequestBody;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
        return NextResponse.json({ error: 'messages required' }, { status: 400 });
    }
    if (!isValidRange(body.range)) {
        return NextResponse.json({ error: 'invalid range' }, { status: 400 });
    }
    if (typeof body.baseCurrency !== 'string' || body.baseCurrency.length === 0) {
        return NextResponse.json({ error: 'baseCurrency required' }, { status: 400 });
    }

    // Cap conversation length to avoid runaway costs.
    const messages = body.messages.slice(-12).map(m => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content.slice(0, 2000) : '',
    })).filter(m => m.content.length > 0 && (m.role === 'user' || m.role === 'assistant'));

    if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
        return NextResponse.json({ error: 'last message must be from user' }, { status: 400 });
    }

    let snapshot;
    try {
        snapshot = await buildInsightsSnapshot(supabase, user.id, {
            range: body.range,
            baseCurrency: body.baseCurrency,
            bucketId: body.bucketId || undefined,
        });
    } catch (err) {
        console.error('[insights-chat] snapshot failed', err);
        return NextResponse.json({ error: 'Failed to build snapshot' }, { status: 500 });
    }

    if (snapshot.txCount === 0) {
        return NextResponse.json({
            stream: false,
            reply: "There's no spending data in this range yet. Add some transactions or pick a wider period.",
        });
    }

    const snapshotJson = JSON.stringify(snapshot);

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            try {
                const anthropicStream = await anthropic.messages.stream({
                    model: MODEL,
                    max_tokens: 600,
                    // Cache the snapshot system block so multi-turn chats reuse the tokens.
                    system: [
                        { type: 'text', text: SYSTEM_PROMPT },
                        {
                            type: 'text',
                            text: `Snapshot for ${snapshot.period} (currency=${snapshot.baseCurrency}):\n${snapshotJson}`,
                            cache_control: { type: 'ephemeral' },
                        },
                    ],
                    messages,
                });

                for await (const evt of anthropicStream) {
                    if (evt.type === 'content_block_delta' && evt.delta.type === 'text_delta') {
                        controller.enqueue(encoder.encode(evt.delta.text));
                    }
                }
                controller.close();
            } catch (err) {
                console.error('[insights-chat] stream failed', err);
                controller.enqueue(encoder.encode("\n\n[error] Couldn't reach the model. Try again in a moment."));
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-store',
            'X-RateLimit-Remaining': String(limit.remaining),
            'X-RateLimit-Limit': String(DAILY_LIMIT),
        },
    });
}
