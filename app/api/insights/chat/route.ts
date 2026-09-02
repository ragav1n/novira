import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/utils/supabase/server';
import { buildInsightsSnapshot, type SnapshotRange } from '@/lib/insights-snapshot';
import { checkRateLimit } from '@/lib/server/rate-limit';
import { profileCurrency } from '@/lib/server/currency';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = 'claude-haiku-4-5-20251001';

const DAILY_LIMIT = 3;
const RATE_CFG = { max: DAILY_LIMIT, windowMs: 24 * 60 * 60 * 1000 };

const SYSTEM_PROMPT = `You are the analyst behind Novira's insights chat. You answer the user's questions about their own spending using ONLY the JSON snapshot in the next block.

How to answer:
- Lead with the answer in the first sentence, then at most two or three more of supporting detail. Stop there unless the user asks for more.
- Every figure must be derivable from the snapshot. Sort and aggregate it yourself — "biggest expense" is the highest amount in "sample", "most-visited place" is the highest count in "byMerchant". Never invent a merchant, category, date, or amount. If the snapshot can't answer the question, say so plainly and say what would.
- Wrap every figure — amounts, percentages, counts, dates — in **double asterisks**. The client renders those bold.
- Every amount in the snapshot is already in the user's own currency. Write each one with the snapshot's "currencySymbol" in front of it, and no other currency symbol or code anywhere.
- Plain sentences only. The client renders your reply as plain text, so bullet lists, headings, tables, and code fences arrive as literal characters on screen.
- Second person, direct. No emojis, no opener ("Great question", "Based on the data"), no moralising about how they spend.

Reading the snapshot:
- "byDay" is ascending by date. "byCategory", "byMerchant", "byPaymentMethod", and "byTag" are descending by total.
- "recurringTotal" covers transactions flagged as recurring; "discretionaryTotal" is everything else. Together they make up "totalSpent".
- "sample" is the 50 most recent transactions in range, newest first — never describe it as the complete list.
- Amounts are the user's own share (splits already applied), converted to "baseCurrency". Income, transfers, and settlements are excluded, so this is spending only.
- "today", "rangeStart", and "rangeEnd" are ISO dates. Use them to resolve anything relative, like "last week" or "yesterday". A null range means all time.`;

interface RequestBody {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    range:
        | { kind: 'preset'; value: '1M' | 'LM' | '3M' | '6M' | '1Y' | 'ALL' }
        | { kind: 'custom'; from: string; to: string };
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

    const limit = checkRateLimit('insights-chat', user.id, RATE_CFG);
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
            // Not from the body: every figure in the snapshot is converted into
            // this, and the model writes its symbol into the reply, so it has to
            // be the profile's rather than whatever the client happened to hold.
            baseCurrency: await profileCurrency(supabase, user.id),
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
                            text: `Snapshot for ${snapshot.period} (currency=${snapshot.baseCurrency}, today=${snapshot.today}):\n${snapshotJson}`,
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
