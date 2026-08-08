'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { QUICK_FADE, SNAPPY } from '@/lib/motion';
import { Card, CardContent } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Sparkles, Send } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import type { DateRange } from '@/hooks/useAnalyticsData';

interface Props {
    dateRange: DateRange;
    customStart: string;
    customEnd: string;
    bucketId: string | 'all';
    baseCurrency: string;
}

type ChatMessage = { role: 'user' | 'assistant'; content: string; pending?: boolean };

const SUGGESTIONS = [
    'What did I spend the most on?',
    'Which day was most expensive?',
    'How much went to coffee or food delivery?',
    'Any unusual spending this period?',
];

function renderBoldChunks(text: string): ReactNode[] {
    const parts: ReactNode[] = [];
    const re = /\*\*(.+?)\*\*/g;
    let lastIdx = 0;
    let m: RegExpExecArray | null;
    let i = 0;
    while ((m = re.exec(text)) !== null) {
        if (m.index > lastIdx) parts.push(text.slice(lastIdx, m.index));
        parts.push(<strong key={`b-${i++}`} className="font-bold tabular-nums">{m[1]}</strong>);
        lastIdx = m.index + m[0].length;
    }
    if (lastIdx < text.length) parts.push(text.slice(lastIdx));
    return parts;
}

/** Smooth Claude-style reveal: paces character emission at a steady cadence
 *  decoupled from network chunk timing. Each newly revealed word fades and lifts
 *  in, and a blinking caret marks the streaming tip. */
function StreamedAssistantMessage({ text, streaming }: { text: string; streaming: boolean }) {
    // If the message is not actively streaming on first render (e.g. drawer reopened
    // for a finished reply), reveal it instantly. Only stream-then-mounted messages
    // get the typewriter effect.
    const [revealedLength, setRevealedLength] = useState(() => (streaming ? 0 : text.length));
    const lastTickRef = useRef<number>(0);
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
        // If text shrank (new message), snap back to 0.
        if (text.length < revealedLength) setRevealedLength(text.length);
    }, [text, revealedLength]);

    useEffect(() => {
        if (revealedLength >= text.length) {
            // If the network is done and we've caught up, stop animating.
            if (!streaming) return;
            // Otherwise wait for new text — handled by the effect re-running on `text` change.
            return;
        }
        // Target reveal speed adapts to backlog so we never fall behind:
        // base 80 chars/sec, scaled up to 220 when many chars are buffered.
        const tick = (now: number) => {
            if (!lastTickRef.current) lastTickRef.current = now;
            const dt = now - lastTickRef.current;
            lastTickRef.current = now;
            const backlog = text.length - revealedLength;
            const charsPerMs = backlog > 60 ? 0.22 : backlog > 20 ? 0.12 : 0.08;
            const advance = Math.max(1, Math.floor(dt * charsPerMs));
            setRevealedLength(prev => Math.min(text.length, prev + advance));
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
            lastTickRef.current = 0;
        };
    }, [text, revealedLength, streaming]);

    // Render the revealed prefix as styled words; keep already-shown words static
    // (no re-animation) by keying on the word's start index.
    const visible = text.slice(0, revealedLength);
    const tokens: Array<{ key: string; text: string; bold: boolean; fresh: boolean }> = [];
    {
        // Compute bold ranges over `visible` only.
        const boldRanges: Array<[number, number]> = [];
        const re = /\*\*(.+?)\*\*/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(visible)) !== null) {
            boldRanges.push([m.index, m.index + m[0].length]);
        }
        const wordRe = /(\s+|\S+)/g;
        let w: RegExpExecArray | null;
        // Tokens that are completely past `revealedLength - 24` are "fresh" and animate in;
        // older tokens render statically.
        const freshThreshold = Math.max(0, revealedLength - 24);
        while ((w = wordRe.exec(visible)) !== null) {
            const start = w.index;
            const end = start + w[0].length;
            const isBold = boldRanges.some(([a, b]) => start >= a && end <= b);
            const cleaned = w[0].replace(/\*\*/g, '');
            if (!cleaned) continue;
            tokens.push({
                key: `t-${start}`,
                text: cleaned,
                bold: isBold,
                fresh: start >= freshThreshold,
            });
        }
    }

    const showCaret = streaming || revealedLength < text.length;

    return (
        <>
            {tokens.map(t => (
                t.fresh ? (
                    // Opacity + y only. This fires per streamed token — many times a
                    // second while a reply comes in — and animating `filter` on each
                    // one meant a fresh blur pass per token per frame. The blur was
                    // never legible at 4px over 220ms on inline text anyway.
                    <motion.span
                        key={t.key}
                        initial={{ opacity: 0, y: 1 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={QUICK_FADE}
                        className={t.bold ? 'font-bold tabular-nums' : undefined}
                    >
                        {t.text}
                    </motion.span>
                ) : (
                    <span key={t.key} className={t.bold ? 'font-bold tabular-nums' : undefined}>{t.text}</span>
                )
            ))}
            {showCaret && (
                <motion.span
                    aria-hidden
                    className="inline-block w-[2px] h-[1em] align-[-2px] ml-[1px] bg-primary rounded-sm"
                    animate={{ opacity: [1, 0.2, 1] }}
                    transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
                />
            )}
        </>
    );
}

function TypingDots() {
    return (
        <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-foreground/50 animate-bounce [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-foreground/50 animate-bounce [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-foreground/50 animate-bounce" />
        </span>
    );
}

export function InsightsChatCard({ dateRange, customStart, customEnd, bucketId, baseCurrency }: Props) {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [streaming, setStreaming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [remaining, setRemaining] = useState<number | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const t = setTimeout(() => {
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
        }, 50);
        return () => clearTimeout(t);
    }, [open, messages.length]);

    const send = useCallback(async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || streaming) return;
        setError(null);

        const range = dateRange === 'CUSTOM'
            ? { kind: 'custom' as const, from: customStart, to: customEnd }
            : { kind: 'preset' as const, value: dateRange };

        if (range.kind === 'custom' && (!range.from || !range.to)) {
            setError('Pick a custom date range first.');
            return;
        }

        const next: ChatMessage[] = [...messages, { role: 'user', content: trimmed }, { role: 'assistant', content: '', pending: true }];
        setMessages(next);
        setInput('');
        setStreaming(true);

        abortRef.current?.abort();
        const ac = new AbortController();
        abortRef.current = ac;

        try {
            const res = await fetch('/api/insights/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: ac.signal,
                body: JSON.stringify({
                    messages: next.filter(m => !m.pending && m.content.length > 0),
                    range,
                    baseCurrency,
                    bucketId: bucketId === 'all' ? null : bucketId,
                }),
            });

            const remainingHdr = res.headers.get('X-RateLimit-Remaining');
            if (remainingHdr !== null) setRemaining(Number(remainingHdr));

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || `HTTP ${res.status}`);
            }

            const ct = res.headers.get('content-type') || '';
            if (ct.includes('application/json')) {
                const data = await res.json();
                setMessages(prev => {
                    const out = [...prev];
                    out[out.length - 1] = { role: 'assistant', content: data.reply || '' };
                    return out;
                });
                return;
            }

            const reader = res.body?.getReader();
            if (!reader) throw new Error('No response stream');
            const decoder = new TextDecoder();
            let firstChunkSeen = false;
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                if (!firstChunkSeen && chunk.length > 0) firstChunkSeen = true;
                setMessages(prev => {
                    const out = [...prev];
                    const last = out[out.length - 1];
                    if (last && last.role === 'assistant') {
                        out[out.length - 1] = { role: 'assistant', content: last.content + chunk, pending: false };
                    }
                    return out;
                });
            }
        } catch (err) {
            if ((err as { name?: string }).name === 'AbortError') return;
            console.error('[insights-chat] error', err);
            const msg = err instanceof Error ? err.message : 'Something went wrong';
            setError(msg);
            setMessages(prev => {
                const out = [...prev];
                if (out.length && out[out.length - 1].pending) out.pop();
                return out;
            });
        } finally {
            setStreaming(false);
        }
    }, [messages, streaming, dateRange, customStart, customEnd, bucketId, baseCurrency]);

    return (
        <>
            <Card className="bg-gradient-to-br from-primary/10 via-card/40 to-card/40 border-primary/20 shadow-none backdrop-blur-md">
                <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shrink-0">
                        <Sparkles className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-body font-bold">Ask about your spending</p>
                        <p className="text-meta text-muted-foreground/80">Get a quick answer grounded in this view&apos;s data.</p>
                    </div>
                    <button
                        onClick={() => setOpen(true)}
                        className="h-9 px-4 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all shrink-0"
                    >
                        Ask
                    </button>
                </CardContent>
            </Card>

            <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) abortRef.current?.abort(); }}>
                {/* Was a vaul Drawer — the only consumer of that dependency in the whole
                    app, and it used none of vaul's features (no snap points, no
                    direction, no dismissible/handleOnly). A bottom Sheet is the same
                    surface on the Radix dialog this app already uses everywhere else.

                    The X is deliberately kept: drag-to-dismiss goes away with vaul, so
                    without it the only ways out would be the backdrop and Escape. The
                    grab handle is deliberately NOT carried over — a handle that can't
                    be dragged advertises a gesture that no longer exists. (Drag was a
                    liability here anyway: this sheet holds a focused textarea, and vaul
                    needs repositionInputs/handleOnly tuning for that, which it never had.) */}
                <SheetContent side="bottom" className="max-h-[85vh] rounded-t-lg">
                    <SheetHeader className="text-left border-b border-white/5">
                        <div className="flex items-center justify-between gap-2">
                            <SheetTitle className="flex items-center gap-2 text-base">
                                <Sparkles className="w-4 h-4 text-primary" />
                                Insights
                            </SheetTitle>
                            {remaining !== null && (
                                <span className="text-caption font-bold tabular-nums px-2 py-0.5 rounded-md bg-secondary/30 text-foreground/70">
                                    {remaining} / 3 today
                                </span>
                            )}
                        </div>
                    </SheetHeader>

                    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px]">
                        {messages.length === 0 && (
                            <motion.div
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.25 }}
                                className="space-y-2"
                            >
                                <p className="text-meta font-bold uppercase tracking-wider text-foreground/60">Try asking</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {SUGGESTIONS.map((s, i) => (
                                        <motion.button
                                            key={s}
                                            initial={{ opacity: 0, y: 4 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.05 * i, duration: 0.2 }}
                                            onClick={() => send(s)}
                                            className="text-meta px-3 py-1.5 rounded-full bg-secondary/30 border border-white/5 hover:bg-secondary/50 hover:border-primary/30 transition-colors text-foreground/90"
                                        >
                                            {s}
                                        </motion.button>
                                    ))}
                                </div>
                                <p className="text-caption text-foreground/50 pt-2">Limited to 3 questions per day to keep this feature free.</p>
                            </motion.div>
                        )}

                        <AnimatePresence initial={false}>
                            {messages.map((m, i) => (
                                // No `layout`: the message list only ever grows, and
                                // shared-layout made each new message re-measure and
                                // re-project every message before it — unbounded for the
                                // length of a session. The y/scale entrance is the whole
                                // effect; nothing here reorders or resizes.
                                <motion.div
                                    key={i}
                                    initial={{ opacity: 0, y: 8, scale: 0.98 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    transition={SNAPPY}
                                    className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
                                >
                                    <div
                                        className={cn(
                                            'max-w-[85%] rounded-xl px-3.5 py-2.5 text-body leading-relaxed whitespace-pre-wrap shadow-sm',
                                            m.role === 'user'
                                                ? 'bg-primary text-primary-foreground rounded-tr-md'
                                                : 'bg-secondary/40 border border-white/10 text-foreground rounded-tl-md backdrop-blur-sm'
                                        )}
                                    >
                                        {m.role === 'assistant'
                                            ? (m.pending && m.content.length === 0
                                                ? <TypingDots />
                                                : <StreamedAssistantMessage
                                                    text={m.content}
                                                    streaming={streaming && i === messages.length - 1}
                                                />)
                                            : renderBoldChunks(m.content)}
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="text-meta text-destructive border border-destructive/30 bg-destructive/10 rounded-xl px-3 py-2"
                            >
                                {error}
                            </motion.div>
                        )}
                    </div>

                    <form
                        onSubmit={(e) => { e.preventDefault(); send(input); }}
                        className="p-3 border-t border-white/5 flex items-center gap-2"
                    >
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask anything…"
                            disabled={streaming}
                            className="flex-1 h-10 px-4 rounded-full bg-secondary/20 border border-white/5 text-body focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/30 disabled:opacity-50 transition-all"
                            aria-label="Ask about your spending"
                        />
                        <motion.button
                            whileHover={{ scale: streaming || !input.trim() ? 1 : 1.05 }}
                            whileTap={{ scale: streaming || !input.trim() ? 1 : 0.95 }}
                            type="submit"
                            disabled={streaming || !input.trim()}
                            className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:bg-primary/90 transition-colors shadow-md shadow-primary/20"
                            aria-label="Send"
                        >
                            {streaming ? <Spinner className="w-4 h-4" label={null} /> : <Send className="w-4 h-4" />}
                        </motion.button>
                    </form>
                </SheetContent>
            </Sheet>
        </>
    );
}
