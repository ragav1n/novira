'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChartLine, Sparkles, PencilLine } from 'lucide-react';
import { format } from 'date-fns';
import { usePathname, useRouter } from 'next/navigation';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { HolographicCard } from '@/components/ui/holographic-card';
import { RecapBody, RecapSkeleton, type RecapData, type RecapAnalyzed } from '@/components/recap/recap-card';

function RecapEmpty({ monthLabel, onAdd }: { monthLabel: string; onAdd: () => void }) {
    return (
        <div className="space-y-3 py-2">
            <div className="rounded-2xl bg-secondary/30 border border-white/10 p-4 text-center space-y-1">
                <p className="text-[13px] font-semibold text-foreground">Nothing to recap for {monthLabel}.</p>
                <p className="text-[11px] text-muted-foreground">Log a few expenses and we'll have a real story for you next time.</p>
            </div>
            <button
                onClick={onAdd}
                className="w-full h-11 text-[13px] font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.99] shadow-[0_6px_22px_-6px_rgba(168,85,247,0.7)] ring-1 ring-inset ring-white/15 transition-all flex items-center justify-center gap-2"
            >
                <PencilLine className="w-3.5 h-3.5" />
                Add a transaction
            </button>
        </div>
    );
}

const SEEN_KEY = 'novira:recap-modal-seen';
const SKIP_PATHS = ['/add', '/scan', '/signin', '/signup'];
const SHOW_DELAY_MS = 4500;
// Only auto-generate (POST) inside this window. Outside, only show if cached.
const AUTO_GENERATE_DAY_LIMIT = 7;

function priorMonthKey(): string {
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`;
}

export function MonthlyRecapModal() {
    const { formatCurrency, currency, userId } = useUserPreferences();
    const pathname = usePathname();
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [recap, setRecap] = useState<RecapData | null>(null);
    const [analyzed, setAnalyzed] = useState<RecapAnalyzed | null>(null);
    const [month, setMonth] = useState<string | null>(null);

    const markSeen = useCallback(async (targetMonth: string) => {
        try {
            localStorage.setItem(`${SEEN_KEY}:${userId || 'anon'}:${targetMonth}`, '1');
            await fetch('/api/recap', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ month: targetMonth })
            });
        } catch (err) {
            console.error('[recap modal mark seen]', err);
        }
    }, [userId]);

    const dismiss = useCallback(async () => {
        setOpen(false);
        if (month) await markSeen(month);
    }, [month, markSeen]);

    const drillTo = useCallback(async (subject: string, kind?: string) => {
        if (!month || !subject) return;
        const params = new URLSearchParams();
        if (kind === 'category' || kind === 'new') params.set('category', subject);
        else if (kind === 'payment') params.set('payment', subject);
        else params.set('q', subject);
        // Scope to the recap's month range
        const [y, m] = month.split('-').map(Number);
        if (y && m) {
            const start = new Date(Date.UTC(y, m - 1, 1));
            const end = new Date(Date.UTC(y, m, 0));
            params.set('from', start.toISOString().slice(0, 10));
            params.set('to', end.toISOString().slice(0, 10));
        }
        await markSeen(month);
        setOpen(false);
        router.push(`/search?${params.toString()}`);
    }, [month, markSeen, router]);

    useEffect(() => {
        if (!userId) return;
        if (pathname && SKIP_PATHS.some((p) => pathname.startsWith(p))) return;
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        (async () => {
            const target = priorMonthKey();
            // Local guard so a single device doesn't keep hammering the API.
            if (localStorage.getItem(`${SEEN_KEY}:${userId}:${target}`) === '1') return;

            try {
                // Always try the cache first.
                let res = await fetch(`/api/recap?month=${target}`);
                if (res.status === 404) {
                    // Only auto-generate during the first 7 days of the month so a user
                    // installing mid-month doesn't trigger a fresh Anthropic call on open.
                    const dayOfMonth = new Date().getDate();
                    if (dayOfMonth > AUTO_GENERATE_DAY_LIMIT) return;
                    setLoading(true);
                    res = await fetch('/api/recap', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ month: target, currency })
                    });
                }
                if (cancelled) return;
                if (!res.ok) {
                    setLoading(false);
                    return;
                }
                const data = await res.json();
                // If user already viewed it on another device, don't pop again.
                if (data.seen_at) {
                    localStorage.setItem(`${SEEN_KEY}:${userId}:${target}`, '1');
                    setLoading(false);
                    return;
                }
                if (!data.recap) {
                    setLoading(false);
                    return;
                }
                setRecap(data.recap);
                setAnalyzed(data.analyzed || null);
                setMonth(target);
                setLoading(false);
                // Delay opening so we don't interrupt the user mid-load
                timer = setTimeout(() => {
                    if (!cancelled) setOpen(true);
                }, SHOW_DELAY_MS);
            } catch (err) {
                console.error('[recap modal]', err);
                setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
        };
    }, [userId, currency, pathname]);

    const monthLabel = month ? (() => {
        const [y, m] = month.split('-').map(Number);
        return format(new Date(y, m - 1, 1), 'MMMM yyyy');
    })() : '';

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="recap-modal-title"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[180] flex items-end sm:items-center justify-center bg-background/70 backdrop-blur-md p-0 sm:p-4"
                    onClick={dismiss}
                >
                    <motion.div
                        initial={{ y: 40, opacity: 0, scale: 0.98 }}
                        animate={{ y: 0, opacity: 1, scale: 1 }}
                        exit={{ y: 30, opacity: 0, scale: 0.98 }}
                        transition={{ type: 'spring', damping: 24, stiffness: 280 }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto"
                    >
                        <HolographicCard className="border-primary/40 rounded-3xl sm:rounded-3xl rounded-t-3xl rounded-b-none sm:rounded-b-3xl">
                            <div className="p-5 sm:p-6 space-y-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-10 h-10 rounded-2xl bg-primary/30 border border-primary/50 flex items-center justify-center shadow-[0_0_22px_-4px_rgba(168,85,247,0.7)]">
                                            <Sparkles className="w-[18px] h-[18px] text-primary-foreground" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Your {monthLabel} recap</p>
                                            <h2 id="recap-modal-title" className="text-base font-bold text-foreground">A new month is here</h2>
                                        </div>
                                    </div>
                                    <button
                                        onClick={dismiss}
                                        aria-label="Dismiss recap"
                                        className="w-8 h-8 rounded-full bg-secondary/40 hover:bg-secondary/60 border border-white/10 flex items-center justify-center text-foreground/70 hover:text-foreground transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                {loading ? (
                                    <RecapSkeleton />
                                ) : recap && recap.transactionCount === 0 ? (
                                    <RecapEmpty
                                        monthLabel={monthLabel}
                                        onAdd={() => {
                                            if (month) markSeen(month);
                                            setOpen(false);
                                            router.push('/add');
                                        }}
                                    />
                                ) : recap ? (
                                    <RecapBody
                                        recap={recap}
                                        analyzed={analyzed}
                                        formatCurrency={formatCurrency}
                                        onInsightClick={drillTo}
                                    />
                                ) : null}

                                {!(recap && recap.transactionCount === 0) && (
                                    <button
                                        onClick={dismiss}
                                        className="w-full h-11 text-[13px] font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.99] shadow-[0_6px_22px_-6px_rgba(168,85,247,0.7)] ring-1 ring-inset ring-white/15 transition-all flex items-center justify-center gap-2"
                                    >
                                        <ChartLine className="w-3.5 h-3.5" />
                                        Got it
                                    </button>
                                )}
                                <p className="text-[10px] text-muted-foreground/70 text-center">
                                    You can revisit any month's recap anytime from Analytics.
                                </p>
                            </div>
                        </HolographicCard>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
