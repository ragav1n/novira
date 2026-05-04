'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChartLine, Sparkles, Repeat, Tags, Store, Wallet, Lightbulb } from 'lucide-react';
import { format } from 'date-fns';
import { HolographicCard } from '@/components/ui/holographic-card';
import { RecapBody, RecapSkeleton, type RecapData, type RecapAnalyzed } from '@/components/recap/recap-card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/utils/haptics';

interface Props {
    currency: string;
    formatCurrency: (amount: number, currency?: string) => string;
}

export function MonthlyRecapCard({ currency, formatCurrency }: Props) {
    const router = useRouter();
    const [recapLoading, setRecapLoading] = useState(false);
    const [recap, setRecap] = useState<RecapData | null>(null);
    const [recapMeta, setRecapMeta] = useState<RecapAnalyzed | null>(null);
    const [recapMonth, setRecapMonth] = useState<string | null>(null);
    const [availableMonths, setAvailableMonths] = useState<string[]>([]);
    const recapAbortRef = useRef<AbortController | null>(null);

    const priorMonthKey = useMemo(() => {
        const now = new Date();
        const target = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`;
    }, []);

    const loadRecap = useCallback(async (monthKey: string) => {
        recapAbortRef.current?.abort();
        const ac = new AbortController();
        recapAbortRef.current = ac;
        setRecapLoading(true);
        try {
            const res = await fetch(`/api/recap?month=${monthKey}`, { signal: ac.signal });
            if (res.status === 404) {
                setRecap(null);
                setRecapMeta(null);
                setRecapMonth(monthKey);
                return false;
            }
            if (!res.ok) throw new Error('Failed to load recap');
            const data = await res.json();
            setRecap(data.recap || null);
            setRecapMeta(data.analyzed || null);
            setRecapMonth(monthKey);
            return true;
        } catch (err) {
            if ((err as { name?: string })?.name === 'AbortError') return false;
            console.error('[recap load]', err);
            return false;
        } finally {
            if (!ac.signal.aborted) setRecapLoading(false);
        }
    }, []);

    const generateRecap = useCallback(async (monthKey?: string, force = false) => {
        const target = monthKey || recapMonth || priorMonthKey;
        recapAbortRef.current?.abort();
        const ac = new AbortController();
        recapAbortRef.current = ac;
        setRecapLoading(true);
        if (force) {
            setRecap(null);
            setRecapMeta(null);
        }
        try {
            const res = await fetch('/api/recap', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ month: target, currency, force }),
                signal: ac.signal,
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Recap failed');
            }
            const data = await res.json();
            setRecap(data.recap || null);
            setRecapMeta(data.analyzed || null);
            setRecapMonth(target);
            setAvailableMonths((prev) => prev.includes(target) ? prev : [target, ...prev]);
        } catch (err) {
            if ((err as { name?: string })?.name === 'AbortError') return;
            console.error('[recap]', err);
            toast.error('Could not generate recap');
        } finally {
            if (!ac.signal.aborted) setRecapLoading(false);
        }
    }, [currency, priorMonthKey, recapMonth]);

    useEffect(() => () => recapAbortRef.current?.abort(), []);

    const recapMonthLabel = useMemo(() => {
        if (!recapMonth) return null;
        const [y, m] = recapMonth.split('-').map(Number);
        return format(new Date(y, m - 1, 1), 'MMMM yyyy');
    }, [recapMonth]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch('/api/recap');
                if (!res.ok) return;
                const data = await res.json();
                if (cancelled) return;
                const months: string[] = (data.months || []).map((m: { month: string }) => m.month);
                setAvailableMonths(months);
                if (months.length > 0) {
                    await loadRecap(months[0]);
                } else {
                    setRecapMonth(priorMonthKey);
                }
            } catch (err) {
                console.error('[recap prefetch]', err);
            }
        })();
        return () => { cancelled = true; };
    }, [loadRecap, priorMonthKey]);

    return (
        <HolographicCard className="border-primary/30">
            <div className="p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-2xl bg-primary/25 border border-primary/40 flex items-center justify-center shadow-[0_0_18px_-4px_rgba(168,85,247,0.55)] shrink-0">
                            <ChartLine className="w-[18px] h-[18px] text-primary-foreground" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-[12px] uppercase tracking-wider text-foreground">Monthly Recap</h3>
                            <p className="text-[10px] text-muted-foreground font-medium truncate">A look at last month's spending</p>
                        </div>
                    </div>
                    {availableMonths.length > 0 ? (
                        <Select
                            value={recapMonth || availableMonths[0]}
                            onValueChange={(v) => loadRecap(v)}
                        >
                            <SelectTrigger className="h-8 w-auto min-w-[120px] text-[10px] font-bold uppercase tracking-wider bg-primary/15 border-primary/30 text-foreground/90 rounded-full px-3">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {availableMonths.map((m) => {
                                    const [y, mm] = m.split('-').map(Number);
                                    return (
                                        <SelectItem key={m} value={m} className="text-[11px]">
                                            {format(new Date(y, mm - 1, 1), 'MMMM yyyy')}
                                        </SelectItem>
                                    );
                                })}
                            </SelectContent>
                        </Select>
                    ) : recapMonthLabel ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/80 bg-primary/15 border border-primary/30 px-2 py-1 rounded-full whitespace-nowrap">
                            {recapMonthLabel}
                        </span>
                    ) : null}
                </div>

                {recapLoading ? (
                    <RecapSkeleton />
                ) : recap ? (
                    <RecapBody
                        recap={recap}
                        analyzed={recapMeta}
                        formatCurrency={formatCurrency}
                        onInsightClick={(subject, kind) => {
                            if (!recapMonth || !subject) return;
                            const params = new URLSearchParams();
                            if (kind === 'category' || kind === 'new') params.set('category', subject);
                            else if (kind === 'payment') params.set('payment', subject);
                            else params.set('q', subject);
                            if (!recapMonth.endsWith('-FY')) {
                                const [y, m] = recapMonth.split('-').map(Number);
                                if (y && m) {
                                    const start = new Date(y, m - 1, 1);
                                    const end = new Date(y, m, 0);
                                    params.set('from', format(start, 'yyyy-MM-dd'));
                                    params.set('to', format(end, 'yyyy-MM-dd'));
                                }
                            } else {
                                const y = Number(recapMonth.slice(0, 4));
                                params.set('from', `${y}-01-01`);
                                params.set('to', `${y}-12-31`);
                            }
                            router.push(`/search?${params.toString()}`);
                        }}
                    />
                ) : (
                    <div className="space-y-3">
                        <p className="text-[13px] text-foreground/80 leading-relaxed">
                            Compare last month against the one before, in plain language.
                        </p>
                        <div className="space-y-2">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">You'll see</p>
                            <ul className="space-y-2">
                                {[
                                    { icon: Tags, label: 'Where you spent more or less', sub: 'by category' },
                                    { icon: Store, label: 'Which places you visited most', sub: 'and how much they cost' },
                                    { icon: Wallet, label: 'Cash vs card mix', sub: 'and how it changed' },
                                    { icon: Repeat, label: 'How often you spent', sub: 'and your average ticket size' },
                                    { icon: Lightbulb, label: 'One concrete thing to try', sub: 'tied to your numbers' },
                                ].map(({ icon: Icon, label, sub }) => (
                                    <li key={label} className="flex items-start gap-2.5">
                                        <div className="w-6 h-6 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0 mt-0.5">
                                            <Icon className="w-3 h-3 text-primary" />
                                        </div>
                                        <div className="text-[12px] leading-snug">
                                            <span className="text-foreground/90 font-medium">{label}</span>
                                            <span className="text-muted-foreground"> — {sub}</span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                <button
                    onClick={() => generateRecap(recap ? recapMonth || priorMonthKey : priorMonthKey, !!recap)}
                    disabled={recapLoading}
                    className="w-full h-11 text-[13px] font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.99] shadow-[0_6px_22px_-6px_rgba(168,85,247,0.7)] ring-1 ring-inset ring-white/15 transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {recapLoading ? (
                        <>
                            <span className="w-3.5 h-3.5 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                            Analyzing your spending…
                        </>
                    ) : recap ? (
                        <>
                            <Repeat className="w-3.5 h-3.5" />
                            Regenerate
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-3.5 h-3.5" />
                            Generate Recap
                        </>
                    )}
                </button>
            </div>
        </HolographicCard>
    );
}
