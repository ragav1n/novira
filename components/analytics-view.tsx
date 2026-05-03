'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { ChevronLeft, Sparkles, ChartLine, Tags, Store, Wallet, Repeat, Lightbulb, MapPin } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { ChartConfig, BasePieChart } from "@/components/charts/base-pie-chart";
import { TransactionService } from '@/lib/services/transaction-service';
import { CHART_CONFIG, CATEGORY_COLORS, getIconForCategory, getCategoryLabel } from '@/lib/categories';
import { format, startOfMonth, endOfMonth, startOfWeek, startOfYear, subMonths, subYears, subDays, parseISO } from 'date-fns';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { useBucketsList, useBucketSpending } from '@/components/providers/buckets-provider';
import { useWorkspaceTheme } from '@/hooks/useWorkspaceTheme';
import { useTransactionInvalidationListener } from '@/hooks/useTransactionInvalidationListener';
import { useAnalyticsData, type DateRange } from '@/hooks/useAnalyticsData';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Transaction } from '@/types/transaction';
import { HolographicCard } from '@/components/ui/holographic-card';
import { RecapBody, RecapSkeleton, type RecapData, type RecapAnalyzed } from '@/components/recap/recap-card';
import { supabase } from '@/lib/supabase';
import { toast, ImpactStyle } from '@/utils/haptics';

const PAYMENT_COLORS: Record<string, string> = {
    cash: '#22C55E',
    'debit card': '#3B82F6',
    'credit card': '#A855F7',
    upi: '#F59E0B',
    'bank transfer': '#06B6D4',
    other: '#EC4899',
};

const paymentChartConfig: ChartConfig = {
    cash: { label: "Cash", color: PAYMENT_COLORS.cash },
    'debit card': { label: "Debit Card", color: PAYMENT_COLORS['debit card'] },
    'credit card': { label: "Credit Card", color: PAYMENT_COLORS['credit card'] },
    upi: { label: "UPI", color: PAYMENT_COLORS.upi },
    'bank transfer': { label: "Bank Transfer", color: PAYMENT_COLORS['bank transfer'] },
    other: { label: "Other", color: PAYMENT_COLORS.other },
};

const AnalyticsSkeleton = () => (
    <div className="space-y-6">
        {/* Header Skeleton is handled by the main layout or simple spacing */}
        <div className="flex gap-2 px-1">
            <div className="flex-1 h-10 rounded-xl bg-secondary/10 animate-pulse" />
            <div className="flex-1 h-10 rounded-xl bg-secondary/10 animate-pulse" />
        </div>
        
        {/* Trend Card Skeleton */}
        <Card className="bg-card/40 border-white/5 shadow-none">
            <CardContent className="p-4 space-y-4">
                <div className="flex justify-between">
                    <div className="h-4 w-24 bg-secondary/20 rounded animate-pulse" />
                    <div className="h-4 w-12 bg-secondary/20 rounded animate-pulse" />
                </div>
                <div className="h-[140px] w-full bg-secondary/10 rounded-xl animate-pulse" />
                <div className="pt-2 border-t border-white/5 flex justify-between">
                    <div className="h-4 w-16 bg-secondary/20 rounded animate-pulse" />
                    <div className="h-5 w-24 bg-secondary/20 rounded animate-pulse" />
                </div>
            </CardContent>
        </Card>

        {/* Breakdown Card Skeleton */}
        <div className="space-y-2">
            <div className="h-3 w-32 bg-secondary/20 rounded animate-pulse ml-1" />
            <Card className="bg-card/40 border-none shadow-none overflow-hidden">
                <CardContent className="p-4 flex flex-col sm:flex-row items-center gap-6">
                    <div className="w-36 h-36 rounded-full border-8 border-secondary/10 animate-pulse shrink-0" />
                    <div className="w-full space-y-3">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="space-y-2">
                                <div className="flex justify-between">
                                    <div className="h-3 w-20 bg-secondary/20 rounded animate-pulse" />
                                    <div className="h-3 w-16 bg-secondary/20 rounded animate-pulse" />
                                </div>
                                <div className="h-1 w-full bg-secondary/10 rounded-full" />
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
);

export function AnalyticsView() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [priorTransactions, setPriorTransactions] = useState<Transaction[]>([]);
    const [priorStart, setPriorStart] = useState<Date | null>(null);
    const [dateRange, setDateRange] = useState<DateRange>('1M');
    const [selectedBucketId, setSelectedBucketId] = useState<string | 'all'>('all');
    const [customStart, setCustomStart] = useState<string>('');
    const [customEnd, setCustomEnd] = useState<string>('');
    const [recapLoading, setRecapLoading] = useState(false);
    const [recap, setRecap] = useState<RecapData | null>(null);
    const [recapMeta, setRecapMeta] = useState<RecapAnalyzed | null>(null);
    const [recapMonth, setRecapMonth] = useState<string | null>(null);
    const [availableMonths, setAvailableMonths] = useState<string[]>([]);
    const { formatCurrency, currency, convertAmount, userId, activeWorkspaceId, ratesLastUpdated } = useUserPreferences();
    const { activeWorkspace, theme: themeConfig } = useWorkspaceTheme('cyan');

    // getIconForCategory is now imported from lib/categories.ts
    const getBucketIcon = (iconName?: string) => {
        const iconElement = getIconForCategory(iconName || 'Tag');
        return React.cloneElement(iconElement as React.ReactElement<{ className?: string }>, { className: "w-full h-full" });
    };

    const { buckets } = useBucketsList();
    const { bucketSpending } = useBucketSpending();

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            if (!userId) return;

            const now = new Date();
            let startDate: Date | null = null;
            let endDate: Date | null = null;
            let priorStart: Date | null = null;
            let priorEnd: Date | null = null;

            if (dateRange === '1M') {
                startDate = startOfMonth(now);
                priorStart = startOfMonth(subMonths(now, 1));
                priorEnd = startOfMonth(now);
            } else if (dateRange === 'LM') {
                startDate = startOfMonth(subMonths(now, 1));
                endDate = startOfMonth(now);
                priorStart = startOfMonth(subMonths(now, 2));
                priorEnd = startOfMonth(subMonths(now, 1));
            } else if (dateRange === '3M') {
                startDate = startOfMonth(subMonths(now, 2));
                priorStart = startOfMonth(subMonths(now, 5));
                priorEnd = startOfMonth(subMonths(now, 2));
            } else if (dateRange === '6M') {
                startDate = startOfMonth(subMonths(now, 5));
                priorStart = startOfMonth(subMonths(now, 11));
                priorEnd = startOfMonth(subMonths(now, 5));
            } else if (dateRange === '1Y') {
                startDate = startOfMonth(subYears(now, 1));
                priorStart = startOfMonth(subYears(now, 2));
                priorEnd = startOfMonth(subYears(now, 1));
            } else if (dateRange === 'CUSTOM') {
                if (customStart) startDate = parseISO(customStart);
                if (customEnd) {
                    const e = parseISO(customEnd);
                    e.setDate(e.getDate() + 1);
                    endDate = e;
                }
                if (!customStart && !customEnd) { setLoading(false); return; }
                if (startDate && endDate) {
                    const len = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000));
                    priorEnd = new Date(startDate);
                    priorStart = new Date(startDate);
                    priorStart.setDate(priorStart.getDate() - len);
                }
            }
            // dateRange === 'ALL' → no prior

            const baseQuery = {
                userId,
                workspaceId: activeWorkspaceId,
                bucketId: selectedBucketId === 'all' ? undefined : selectedBucketId,
            };

            const [current, prior] = await Promise.all([
                TransactionService.getTransactions({
                    ...baseQuery,
                    startDate: startDate ? format(startDate, 'yyyy-MM-dd') : undefined,
                    endDate: endDate ? format(endDate, 'yyyy-MM-dd') : undefined,
                }),
                priorStart && priorEnd
                    ? TransactionService.getTransactions({
                        ...baseQuery,
                        startDate: format(priorStart, 'yyyy-MM-dd'),
                        endDate: format(priorEnd, 'yyyy-MM-dd'),
                    })
                    : Promise.resolve([] as Transaction[]),
            ]);

            if (current) setTransactions(current);
            setPriorTransactions(prior || []);
            setPriorStart(priorStart);
        } catch (err) {
            console.error("Error fetching analytics:", err);
            setError(err instanceof Error ? err.message : 'Failed to load analytics data');
            toast.error('Failed to load analytics data');
        } finally {
            setLoading(false);
        }
    }, [userId, activeWorkspaceId, dateRange, selectedBucketId, customStart, customEnd]);

    useEffect(() => {
        if (userId) {
            fetchData();
        }
    }, [fetchData, userId, currency]);

    useTransactionInvalidationListener(fetchData);

    // Real-time subscription for transactions
    const analyticsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const debouncedFetchData = useCallback(() => {
        if (analyticsDebounceRef.current) clearTimeout(analyticsDebounceRef.current);
        analyticsDebounceRef.current = setTimeout(() => fetchData(), 300);
    }, [fetchData]);

    useEffect(() => {
        if (!userId) return;

        const txFilter = activeWorkspaceId && activeWorkspaceId !== 'personal'
            ? `group_id=eq.${activeWorkspaceId}`
            : `user_id=eq.${userId}`;

        const channel = supabase
            .channel(`analytics-updates-${userId}-${activeWorkspaceId || 'personal'}`)
            .on('postgres_changes', {
                event: '*', schema: 'public', table: 'transactions', filter: txFilter
            }, () => { debouncedFetchData(); })
            .on('postgres_changes', {
                event: '*', schema: 'public', table: 'splits', filter: `user_id=eq.${userId}`
            }, () => { debouncedFetchData(); })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            if (analyticsDebounceRef.current) {
                clearTimeout(analyticsDebounceRef.current);
                analyticsDebounceRef.current = null;
            }
        };
    }, [userId, activeWorkspaceId, debouncedFetchData]);

    const {
        categoryTrendData,
        categoryBreakdown,
        paymentBreakdown,
        totalSpentInRange,
        activeCategories,
        topMerchants,
        top3Largest,
        weekdayTotals,
        txCount,
        avgPerDay,
        busiestLabel,
        priorTotal,
        priorMTDTotal,
        newMerchantsCount,
        usedConversion,
    } = useAnalyticsData({
        transactions,
        priorTransactions,
        priorStart,
        dateRange,
        currency,
        userId,
        convertAmount,
    });

    const categorizedBreakdown = categoryBreakdown as Array<{
        name: string;
        rawKey: string;
        amount: number;
        value: number;
        fill: string;
    }>;

    const categorizedPayment = paymentBreakdown as Array<{
        name: string;
        amount: number;
        value: number;
        fill: string;
    }>;

    // Whether the trend chart buckets by day (short ranges) or by month (long ranges).
    // Drives the stat row labels ("Top Day" vs "Top Month").
    const monthsBackKind: 'days' | 'months' = (dateRange === '1M' || dateRange === 'LM') ? 'days' : 'months';

    // Simple end-of-month projection for the 1M view. Skipped in bucket-focused mode
    // (no monthly-budget analogue) and in the first 2 days of the month (too noisy).
    const pacingChip = useMemo(() => {
        if (dateRange !== '1M' || selectedBucketId !== 'all' || totalSpentInRange <= 0) return null;
        const today = new Date();
        const day = today.getDate();
        if (day < 3) return null;
        const daysInMonth = endOfMonth(today).getDate();
        const projected = (totalSpentInRange / day) * daysInMonth;
        return { projected };
    }, [dateRange, selectedBucketId, totalSpentInRange]);

    // MoM/period-over-period delta. For 1M we compare MTD-vs-same-MTD (honest mid-month).
    // For other ranges we compare full-period totals since both are complete windows.
    // Resolves the active analytics window to from/to YYYY-MM-DD strings for /search URLs.
    const analyticsDateRange = useCallback((): { from: string; to: string } | null => {
        const now = new Date();
        const fmt = (d: Date) => format(d, 'yyyy-MM-dd');
        if (dateRange === '1M') return { from: fmt(startOfMonth(now)), to: fmt(now) };
        if (dateRange === 'LM') return { from: fmt(startOfMonth(subMonths(now, 1))), to: fmt(endOfMonth(subMonths(now, 1))) };
        if (dateRange === '3M') return { from: fmt(startOfMonth(subMonths(now, 2))), to: fmt(now) };
        if (dateRange === '6M') return { from: fmt(startOfMonth(subMonths(now, 5))), to: fmt(now) };
        if (dateRange === '1Y') return { from: fmt(startOfMonth(subYears(now, 1))), to: fmt(now) };
        if (dateRange === 'CUSTOM' && customStart && customEnd) return { from: customStart, to: customEnd };
        return null;
    }, [dateRange, customStart, customEnd]);

    const momDelta = useMemo(() => {
        if (dateRange === 'ALL') return null;
        const baseline = dateRange === '1M' ? priorMTDTotal : priorTotal;
        if (baseline <= 0) return null;
        const diff = totalSpentInRange - baseline;
        const pct = (diff / baseline) * 100;
        return {
            pct,
            absDelta: diff,
            direction: diff > 0 ? 'up' as const : diff < 0 ? 'down' as const : 'flat' as const,
        };
    }, [dateRange, priorMTDTotal, priorTotal, totalSpentInRange]);

    const priorMonthKey = useMemo(() => {
        const now = new Date();
        const target = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`;
    }, []);

    const recapAbortRef = useRef<AbortController | null>(null);

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

    // Prefetch months list and last available recap on mount
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
                // Default to the most recent stored recap, if any
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

    type TooltipEntry = {
        name?: string | number;
        value?: number | string;
        stroke?: string;
        color?: string;
        fill?: string;
    };
    type AnalyticsTooltipProps = {
        active?: boolean;
        payload?: TooltipEntry[];
        label?: string | number;
    };
    const AnalyticsTooltip = ({ active, payload, label }: AnalyticsTooltipProps) => {
        if (!active || !payload || !payload.length) return null;
        const visible = payload.filter(p => Number(p.value) > 0.5);
        if (!visible.length) return null;
        return (
            <div className="bg-card/95 backdrop-blur-xl border border-white/10 p-3 rounded-2xl shadow-2xl z-50">
                <p className="text-[11px] font-bold uppercase tracking-wider mb-2 text-muted-foreground">{label}</p>
                <div className="space-y-1.5">
                    {visible.map((entry, index) => (
                        <div key={index} className="flex items-center justify-between gap-4 text-xs">
                            <div className="flex items-center gap-2">
                                <div
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ backgroundColor: entry.stroke || entry.color || entry.fill }}
                                />
                                <span className="text-foreground/80 font-medium capitalize">{entry.name}</span>
                            </div>
                            <span className="font-mono font-bold">{formatCurrency(Math.round(Number(entry.value)))}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };


    return (
        <motion.div 
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="relative min-h-[100dvh]"
        >


            <div className={cn(
                "p-5 space-y-6 max-w-md lg:max-w-5xl mx-auto relative transition-all duration-300",
                loading ? "opacity-50 blur-[2px] pointer-events-none" : "opacity-100 blur-0"
            )}>
                {/* Sticky Header — pins to top on scroll, exposes period + running total */}
                <div className="sticky top-0 z-20 -mx-5 px-5 py-2 bg-background/80 backdrop-blur-xl border-b border-white/5">
                    <div className="flex items-center justify-between relative min-h-[40px]">
                        <button
                            onClick={() => router.back()}
                            aria-label="Back"
                            className="p-1.5 rounded-full bg-secondary/30 hover:bg-secondary/50 transition-colors shrink-0 z-10"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none gap-2">
                            <h2 className="text-lg font-semibold truncate text-center leading-tight">Analytics</h2>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 z-10">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-secondary/30 text-muted-foreground">
                                {dateRange === 'ALL' ? 'All' : dateRange}
                            </span>
                            {!loading && totalSpentInRange > 0 && (
                                <span className="text-[10px] font-bold tabular-nums px-2 py-0.5 rounded-md bg-primary/15 border border-primary/25 text-foreground/90">
                                    {formatCurrency(Math.round(totalSpentInRange))}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Filters Row */}
                <div className="flex flex-wrap items-center justify-center gap-2 px-1">
                    <Select value={selectedBucketId} onValueChange={(val) => {
                        setSelectedBucketId(val);
                        toast.haptic(ImpactStyle.Light);
                    }}>
                        <SelectTrigger className={`flex-1 min-w-[140px] px-3 h-10 text-[12px] rounded-xl font-bold ${themeConfig.bgLight} ${themeConfig.borderMedium} ${themeConfig.text}`}>
                            <SelectValue placeholder="All Spending" />
                        </SelectTrigger>
                        <SelectContent align="center">
                            <SelectItem value="all">All Spending</SelectItem>
                            {buckets.map(b => {
                                const bCurr = (b.currency || currency).toUpperCase();
                                const budgetBase = convertAmount(Number(b.budget || 0), bCurr);
                                const spentBase = convertAmount(bucketSpending[b.id] || 0, bCurr);
                                const remaining = budgetBase - spentBase;
                                return (
                                    <SelectItem key={b.id} value={b.id}>
                                        <div className="flex items-center gap-2 w-full">
                                            <div className="w-4 h-4 flex items-center justify-center">
                                                {getBucketIcon(b.icon)}
                                            </div>
                                            <span className="flex-1 truncate">{b.name}</span>
                                            {Number(b.budget) > 0 && (
                                                <span className={cn(
                                                    "ml-2 text-[10px] font-bold tabular-nums shrink-0",
                                                    remaining < 0 ? "text-rose-400" : "text-muted-foreground/70"
                                                )}>
                                                    {formatCurrency(remaining)}
                                                </span>
                                            )}
                                        </div>
                                    </SelectItem>
                                );
                            })}
                        </SelectContent>
                    </Select>
                    <Select value={dateRange} onValueChange={(val: DateRange) => {
                        setDateRange(val);
                        toast.haptic(ImpactStyle.Medium);
                    }}>
                        <SelectTrigger className="flex-1 min-w-[140px] px-3 h-10 text-[12px] bg-secondary/20 border-white/5 rounded-xl font-bold">
                            <SelectValue placeholder="Period" />
                        </SelectTrigger>
                        <SelectContent align="center">
                            <SelectItem value="1M">Current Month</SelectItem>
                            <SelectItem value="LM">Last Month</SelectItem>
                            <SelectItem value="3M">Last 3 Months</SelectItem>
                            <SelectItem value="6M">Last 6 Months</SelectItem>
                            <SelectItem value="1Y">Last Year</SelectItem>
                            <SelectItem value="ALL">All Time</SelectItem>
                            <SelectItem value="CUSTOM">Custom Range</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Custom date range inputs */}
                {dateRange === 'CUSTOM' && (
                    <div className="px-1 space-y-2">
                        <div className="flex flex-wrap gap-1.5">
                            {[
                                { label: 'This Week', from: () => format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'), to: () => format(new Date(), 'yyyy-MM-dd') },
                                { label: 'Last 7 Days', from: () => format(subDays(new Date(), 6), 'yyyy-MM-dd'), to: () => format(new Date(), 'yyyy-MM-dd') },
                                { label: 'YTD', from: () => format(startOfYear(new Date()), 'yyyy-MM-dd'), to: () => format(new Date(), 'yyyy-MM-dd') },
                            ].map(p => (
                                <button
                                    key={p.label}
                                    onClick={() => {
                                        setCustomStart(p.from());
                                        setCustomEnd(p.to());
                                        toast.haptic(ImpactStyle.Light);
                                    }}
                                    className="h-7 px-3 rounded-full text-[10px] font-bold uppercase tracking-wider bg-secondary/30 hover:bg-secondary/50 border border-white/5 transition-colors"
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1 block">From</label>
                                <input
                                    type="date"
                                    value={customStart}
                                    max={customEnd || undefined}
                                    onChange={(e) => setCustomStart(e.target.value)}
                                    className="w-full h-10 px-3 rounded-xl bg-secondary/20 border border-white/5 text-[12px] font-bold text-white focus:outline-none focus:ring-1 focus:ring-primary/50 [color-scheme:dark]"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-white/40 mb-1 block">To</label>
                                <input
                                    type="date"
                                    value={customEnd}
                                    min={customStart || undefined}
                                    onChange={(e) => setCustomEnd(e.target.value)}
                                    className="w-full h-10 px-3 rounded-xl bg-secondary/20 border border-white/5 text-[12px] font-bold text-white focus:outline-none focus:ring-1 focus:ring-primary/50 [color-scheme:dark]"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {loading ? (
                    <AnalyticsSkeleton />
                ) : error ? (
                    <Card className="bg-card/40 border-destructive/30 shadow-none">
                        <CardContent className="p-5 space-y-3 text-center">
                            <p className="text-sm font-bold text-destructive">Couldn't load analytics</p>
                            <p className="text-[12px] text-muted-foreground">{error}</p>
                            <button
                                onClick={() => fetchData()}
                                className="h-9 px-4 text-[12px] font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
                            >
                                Retry
                            </button>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                {/* Bucket Progress Highlight */}
                {selectedBucketId !== 'all' && buckets.find(b => b.id === selectedBucketId) && (() => {
                    const focusedBucket = buckets.find(b => b.id === selectedBucketId)!;
                    const bucketCurr = (focusedBucket.currency || currency).toUpperCase();
                    const budgetInBase = convertAmount(Number(focusedBucket.budget || 0), bucketCurr);
                    const remaining = budgetInBase - totalSpentInRange;
                    return (
                    <Card className={`${themeConfig.bgLight} ${themeConfig.borderMedium} ${themeConfig.shadowGlow}`}>
                        <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${themeConfig.bgMedium} ${themeConfig.text} ${themeConfig.borderMedium}`}>
                                    {getBucketIcon(focusedBucket.icon)}
                                </div>
                                <div>
                                    <h4 className={`text-sm font-bold ${themeConfig.text}`}>{focusedBucket.name}</h4>
                                    <p className={`text-[11px] font-bold uppercase tracking-widest ${themeConfig.textOpacity}`}>Targeted View</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className={`text-[11px] font-bold uppercase tracking-widest ${themeConfig.textOpacity}`}>Budget Remaining</p>
                                <p className={`text-sm font-bold ${themeConfig.text}`}>
                                    {formatCurrency(remaining)}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                    );
                })()}

                {/* Monthly AI Recap — Holographic Card */}
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

                {transactions.length === 0 ? (
                    <Card className="bg-card/40 border-white/5 shadow-none">
                        <CardContent className="p-8 flex flex-col items-center justify-center text-center space-y-2">
                            <div className="w-12 h-12 rounded-2xl bg-secondary/30 flex items-center justify-center mb-1">
                                <ChartLine className="w-5 h-5 text-muted-foreground/70" />
                            </div>
                            <p className="text-sm font-bold">No transactions in this range</p>
                            <p className="text-[12px] text-muted-foreground max-w-[260px]">
                                Try a wider period from the picker above, or add an expense to start seeing trends.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                <>
                {/* Monthly Spending Trend */}
                <Card className="bg-card/40 backdrop-blur-md border-white/5 shadow-none">
                    <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between items-center gap-2">
                            <h3 className="font-bold text-[13px] uppercase tracking-wider text-muted-foreground/80">Spending Trend</h3>
                            <div className="flex items-center gap-1.5">
                                {pacingChip && (
                                    <span
                                        className="text-[10px] px-2 py-0.5 rounded-md font-bold border bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                                        title="Estimated end-of-month total at current pace"
                                    >
                                        On pace · {formatCurrency(pacingChip.projected)}
                                    </span>
                                )}
                                <span className="text-[10px] bg-secondary/30 px-2 py-0.5 rounded-md text-muted-foreground font-bold">
                                    {dateRange === 'ALL' ? 'All Time' : dateRange}
                                </span>
                            </div>
                        </div>

                        {/* Compact stat row */}
                        <div className="grid grid-cols-3 gap-2">
                            <div className="rounded-xl bg-secondary/10 border border-white/5 px-3 py-2">
                                <p className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground/70">Avg / {monthsBackKind === 'days' ? 'Day' : 'Month'}</p>
                                <p className="text-[13px] font-bold mt-0.5 tabular-nums">{formatCurrency(avgPerDay)}</p>
                            </div>
                            <div className="rounded-xl bg-secondary/10 border border-white/5 px-3 py-2">
                                <p className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground/70">Txns</p>
                                <p className="text-[13px] font-bold mt-0.5 tabular-nums">{txCount}</p>
                            </div>
                            <div className="rounded-xl bg-secondary/10 border border-white/5 px-3 py-2">
                                <p className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground/70">{monthsBackKind === 'days' ? 'Top Day' : 'Top Month'}</p>
                                <p className="text-[13px] font-bold mt-0.5 truncate">{busiestLabel || '—'}</p>
                            </div>
                        </div>

                        <div className="h-[140px] w-full">
                            {activeCategories.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={categoryTrendData} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
                                        <XAxis
                                            dataKey="month"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: 600 }}
                                            interval={dateRange === '1M' || dateRange === 'LM' ? 4 : (dateRange === '1Y' || dateRange === 'ALL' ? 'preserveStartEnd' : 1)}
                                        />
                                        <Tooltip content={<AnalyticsTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }} />
                                        {dateRange !== 'ALL' && priorTotal > 0 && (
                                            <Line
                                                type="monotone"
                                                dataKey="prior_total"
                                                name="Prior period"
                                                stroke="rgba(255,255,255,0.35)"
                                                strokeWidth={1.5}
                                                strokeDasharray="3 4"
                                                dot={false}
                                                connectNulls
                                                animationDuration={1000}
                                                animationEasing="ease-in-out"
                                                isAnimationActive
                                            />
                                        )}
                                        {activeCategories.map((cat, index) => (
                                            <Line
                                                key={cat}
                                                type="monotone"
                                                dataKey={cat}
                                                name={getCategoryLabel(cat)}
                                                stroke={CATEGORY_COLORS[cat] || CATEGORY_COLORS.others}
                                                strokeWidth={2.5}
                                                dot={false}
                                                connectNulls
                                                animationDuration={1200 + (index * 150)}
                                                animationEasing="ease-in-out"
                                            />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-full text-muted-foreground text-[11px] font-bold uppercase tracking-widest">
                                    No spending in this range
                                </div>
                            )}
                        </div>

                        {/* Active-category legend */}
                        {activeCategories.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {activeCategories.slice(0, 6).map(cat => (
                                    <span key={cat} className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary/20 border border-white/5">
                                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[cat] || CATEGORY_COLORS.others }} />
                                        <span className="text-muted-foreground/90">{getCategoryLabel(cat)}</span>
                                    </span>
                                ))}
                                {activeCategories.length > 6 && (
                                    <span className="flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary/20 border border-white/5 text-muted-foreground/70">
                                        +{activeCategories.length - 6} more
                                    </span>
                                )}
                            </div>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-white/5">
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] text-muted-foreground uppercase tracking-widest font-bold">Total Spent</span>
                                {momDelta && (
                                    <span
                                        className={cn(
                                            "text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-md border",
                                            momDelta.direction === 'up'
                                                ? "bg-rose-500/10 border-rose-500/25 text-rose-300"
                                                : momDelta.direction === 'down'
                                                ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
                                                : "bg-secondary/20 border-white/5 text-muted-foreground"
                                        )}
                                        title={dateRange === '1M' ? 'Same period last month' : 'Previous period'}
                                    >
                                        {momDelta.direction === 'up' ? '▲' : momDelta.direction === 'down' ? '▼' : '·'} {Math.abs(momDelta.pct).toFixed(0)}%
                                    </span>
                                )}
                            </div>
                            <span className="text-base font-bold">{formatCurrency(totalSpentInRange)}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Day-of-Week Spending */}
                {totalSpentInRange > 0 && (() => {
                    const maxWd = Math.max(...weekdayTotals.map(w => w.total));
                    if (maxWd <= 0) return null;
                    const peak = weekdayTotals.reduce((a, b) => (a.total >= b.total ? a : b));
                    return (
                        <Card className="bg-card/40 border-white/5 shadow-none backdrop-blur-md">
                            <CardContent className="p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="font-bold text-[13px] uppercase tracking-wider text-muted-foreground/80">By Weekday</h3>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                                        Peak · {peak.label}
                                    </span>
                                </div>
                                <div className="grid grid-cols-7 gap-2 h-[110px] items-end">
                                    {weekdayTotals.map((w, i) => {
                                        const ratio = w.total / maxWd;
                                        const isPeak = w.total === peak.total && peak.total > 0;
                                        return (
                                            <div key={w.label} className="flex flex-col items-center gap-1.5 h-full justify-end">
                                                <span className="text-[9px] font-bold tabular-nums text-muted-foreground/60">
                                                    {w.total > 0 ? formatCurrency(Math.round(w.total)) : ''}
                                                </span>
                                                <motion.div
                                                    initial={{ scaleY: 0, opacity: 0 }}
                                                    animate={{ scaleY: ratio, opacity: 1 }}
                                                    transition={{
                                                        delay: i * 0.05,
                                                        duration: 0.6,
                                                        ease: [0.22, 1, 0.36, 1],
                                                    }}
                                                    style={{
                                                        transformOrigin: 'bottom',
                                                        backgroundColor: isPeak ? '#A855F7' : 'rgba(168,85,247,0.3)',
                                                    }}
                                                    className="w-full rounded-md min-h-[6px] h-[60px]"
                                                />
                                                <span className={cn(
                                                    "text-[9px] font-bold uppercase tracking-wider",
                                                    isPeak ? "text-foreground" : "text-muted-foreground/60"
                                                )}>
                                                    {w.label}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })()}

                {/* Top Places */}
                {topMerchants.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80">
                                Top Places
                            </span>
                            {newMerchantsCount > 0 && (
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300">
                                    {newMerchantsCount} new
                                </span>
                            )}
                        </div>
                        <Card className="bg-card/40 border-none shadow-none backdrop-blur-md overflow-hidden">
                            <CardContent className="p-4 space-y-2.5">
                                {topMerchants.map((m, i) => (
                                    <button
                                        key={m.name}
                                        onClick={() => {
                                            const params = new URLSearchParams({ q: m.name });
                                            router.push(`/search?${params.toString()}`);
                                        }}
                                        className="w-full flex items-center gap-3 text-left rounded-lg -mx-1 px-1 py-1 hover:bg-white/5 transition-colors"
                                    >
                                        <div className="w-6 h-6 rounded-lg bg-secondary/20 border border-white/5 flex items-center justify-center shrink-0">
                                            <span className="text-[10px] font-bold text-muted-foreground/70 tabular-nums">{i + 1}</span>
                                        </div>
                                        <MapPin className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[12px] font-bold truncate">{m.name}</p>
                                            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60">
                                                {m.count} {m.count === 1 ? 'visit' : 'visits'}
                                            </p>
                                        </div>
                                        <span className="text-[12px] font-bold tabular-nums">{formatCurrency(m.amount)}</span>
                                    </button>
                                ))}
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Top 3 Largest */}
                {top3Largest.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80">
                                Largest Transactions
                            </span>
                        </div>
                        <Card className="bg-card/40 border-none shadow-none backdrop-blur-md overflow-hidden">
                            <CardContent className="p-4 space-y-2.5">
                                {top3Largest.map((tx) => {
                                    const dotColor = CATEGORY_COLORS[tx.category.toLowerCase()] || CATEGORY_COLORS.others;
                                    return (
                                        <div key={tx.id} className="flex items-center gap-3">
                                            <div
                                                className="w-2 h-2 rounded-full shrink-0"
                                                style={{ backgroundColor: dotColor }}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[12px] font-bold truncate">{tx.description}</p>
                                                <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60 truncate">
                                                    {format(parseISO(tx.date.slice(0, 10)), 'd MMM')}
                                                    {tx.place_name ? ` · ${tx.place_name}` : ''}
                                                </p>
                                            </div>
                                            <span className="text-[12px] font-bold tabular-nums">{formatCurrency(tx.amount)}</span>
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Category Breakdown including Pie Chart */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80">
                            {selectedBucketId !== 'all' && buckets.find(b => b.id === selectedBucketId)
                                ? `Categories within ${buckets.find(b => b.id === selectedBucketId)!.name}`
                                : 'Spending by Category'}
                        </span>
                    </div>
                    <Card className="bg-card/40 border-none shadow-none backdrop-blur-md overflow-hidden">
                        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-start gap-6">
                            <div className="w-36 h-36 relative flex-shrink-0">
                                {categoryBreakdown.length > 0 ? (
                                    <BasePieChart
                                        data={categoryBreakdown}
                                        config={CHART_CONFIG}
                                        innerRadius={46}
                                        outerRadius={68}
                                        hideLabel={true}
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full text-muted-foreground text-[10px] font-bold uppercase">
                                        No Data
                                    </div>
                                )}
                            </div>

                            <div className="w-full flex-1 space-y-3">
                                {categorizedBreakdown.slice(0, 5).map((cat) => (
                                    <button
                                        key={cat.name}
                                        onClick={() => {
                                            const params = new URLSearchParams({ category: cat.rawKey });
                                            const range = analyticsDateRange();
                                            if (range) {
                                                params.set('from', range.from);
                                                params.set('to', range.to);
                                            }
                                            router.push(`/search?${params.toString()}`);
                                        }}
                                        className="w-full text-left space-y-1.5 rounded-lg -mx-1 px-1 py-1 hover:bg-white/5 transition-colors"
                                    >
                                        <div className="flex justify-between text-[11px] font-bold">
                                            <span className="flex items-center gap-2 text-muted-foreground/80">
                                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.fill }} />
                                                {cat.name}
                                            </span>
                                            <span className="text-foreground">{formatCurrency(cat.amount)}</span>
                                        </div>
                                        <div className="h-1 w-full bg-secondary/20 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-700"
                                                style={{ width: `${cat.value}%`, backgroundColor: cat.fill }}
                                            />
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Payment Methods Breakdown */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80">
                            Spending by Payment Method
                        </span>
                    </div>
                    <Card className="bg-card/40 border-none shadow-none backdrop-blur-md overflow-hidden">
                        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-start gap-6">
                            <div className="w-32 h-32 relative flex-shrink-0">
                                {paymentBreakdown.length > 0 ? (
                                    <BasePieChart
                                        data={paymentBreakdown}
                                        config={paymentChartConfig}
                                        innerRadius={40}
                                        outerRadius={60}
                                        hideLabel={true}
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full text-muted-foreground text-[10px] font-bold uppercase">
                                        No Data
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3 flex-1 w-full">
                                {categorizedPayment.map((pay) => (
                                    <div key={pay.name} className="flex flex-col p-3 rounded-2xl bg-secondary/10 border border-white/5">
                                        <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground/80 uppercase tracking-widest font-bold">
                                            <div className="w-1 h-1 rounded-full shadow-glow" style={{ backgroundColor: pay.fill }} />
                                            {pay.name}
                                        </span>
                                        <span className="text-sm font-bold mt-1">{formatCurrency(pay.amount)}</span>
                                        <div className="h-1 w-full bg-secondary/20 rounded-full mt-2 overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-1000"
                                                style={{ width: `${pay.value}%`, backgroundColor: pay.fill }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Currency conversion staleness footnote */}
                {usedConversion && ratesLastUpdated && (Date.now() - ratesLastUpdated) > 24 * 60 * 60 * 1000 && (
                    <p className="text-[10px] text-muted-foreground/60 text-center px-2">
                        Some amounts converted using exchange rates last refreshed {format(new Date(ratesLastUpdated), 'd MMM, h:mm a')}.
                    </p>
                )}
                </>
                )}
                </>
                )}
            </div>
        </motion.div>
    );
};
