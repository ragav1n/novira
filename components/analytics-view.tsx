'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import dynamic from 'next/dynamic';
import { ChartLine, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { TransactionService } from '@/lib/services/transaction-service';
import { getIconForCategory } from '@/lib/categories';
import { format, startOfMonth, endOfMonth, startOfWeek, startOfYear, subMonths, subYears, subDays, parseISO } from 'date-fns';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { useBucketsList, useBucketSpending } from '@/components/providers/buckets-provider';
import { useAccounts } from '@/components/providers/accounts-provider';
import { useWorkspaceTheme } from '@/hooks/useWorkspaceTheme';
import { resolveWorkspaceHex } from '@/lib/utils/workspace-theme-hex';
import { useTransactionInvalidationListener } from '@/hooks/useTransactionInvalidationListener';
import { useRefreshRequest } from '@/hooks/useRefreshRequest';
import { useAnalyticsData, type DateRange } from '@/hooks/useAnalyticsData';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Transaction } from '@/types/transaction';
import { supabase } from '@/lib/supabase';
import { toast, ImpactStyle } from '@/utils/haptics';
import { AnalyticsSkeleton } from '@/components/analytics/analytics-skeleton';
import { MonthlyRecapCard } from '@/components/analytics/monthly-recap-card';
import { AnalyticsHero } from '@/components/analytics/analytics-hero';
import { SectionLabel } from '@/components/analytics/section-label';
const SpendingTrendCard = dynamic(
    () => import('@/components/analytics/spending-trend-card').then(m => m.SpendingTrendCard),
    { ssr: false, loading: () => <div className="h-[260px] w-full animate-pulse rounded-xl bg-card/40" /> }
);
import { WeekdayChartCard } from '@/components/analytics/weekday-chart-card';
import { TopMerchantsCard } from '@/components/analytics/top-merchants-card';
import { LargestTransactionsCard } from '@/components/analytics/largest-transactions-card';
const CategoryBreakdownCard = dynamic(
    () => import('@/components/analytics/category-breakdown-card').then(m => m.CategoryBreakdownCard),
    { ssr: false, loading: () => <div className="h-[220px] w-full animate-pulse rounded-xl bg-card/40" /> }
);
const PaymentBreakdownCard = dynamic(
    () => import('@/components/analytics/payment-breakdown-card').then(m => m.PaymentBreakdownCard),
    { ssr: false, loading: () => <div className="h-[220px] w-full animate-pulse rounded-xl bg-card/40" /> }
);
import { RecurringSplitCard } from '@/components/analytics/recurring-split-card';
import { TagsFilterCard } from '@/components/analytics/tags-filter-card';
import { CalendarHeatmapCard } from '@/components/analytics/calendar-heatmap-card';
import { LocationInsightsCard } from '@/components/analytics/location-insights-card';
import { InsightsChatCard } from '@/components/analytics/insights-chat-card';
import { LazyMount } from '@/components/analytics/lazy-mount';
import { WhatIfCard } from '@/components/analytics/what-if-card';
import { ViewHeader } from '@/components/ui/view-header';
import { EmptyState } from '@/components/ui/empty-state';

function BucketIcon({ icon, className }: { icon?: string; className?: string }) {
    const el = getIconForCategory(icon || 'Tag') as React.ReactElement<{ className?: string }>;
    return React.cloneElement(el, { className });
}

// Charts and aggregations get expensive past this many rows, so the ALL range
// caps here and shows a footnote. Also drives the fetch limit so the cap is
// actually reachable instead of being masked by the server's default page size.
const ALL_VIEW_LIMIT = 5000;

export function AnalyticsView() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [priorTransactions, setPriorTransactions] = useState<Transaction[]>([]);
    const [priorStart, setPriorStart] = useState<Date | null>(null);
    const [rangeStart, setRangeStart] = useState<Date | null>(null);
    const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
    const [allViewTruncated, setAllViewTruncated] = useState(false);
    const [dateRange, setDateRange] = useState<DateRange>('1M');
    const [selectedBucketId, setSelectedBucketId] = useState<string | 'all'>('all');
    const [customStart, setCustomStart] = useState<string>('');
    const [customEnd, setCustomEnd] = useState<string>('');
    const [activeTags, setActiveTags] = useState<string[]>([]);
    const { formatCurrency, currency, convertAmount, userId, activeWorkspaceId, ratesLastUpdated, firstDayOfWeek, monthlyBudget, convertedWorkspaceBudgets } = useUserPreferences();
    const { activeAccountId } = useAccounts();
    const { workspaceType, theme: themeConfig } = useWorkspaceTheme('cyan');
    const themeHex = useMemo(() => resolveWorkspaceHex(workspaceType, 'cyan'), [workspaceType]);

    const { buckets } = useBucketsList();
    const { bucketSpending } = useBucketSpending();
    // Bumped on each workspace/user change so in-flight fetches from a previous
    // workspace can't land their results on top of the new one.
    const fetchGenRef = useRef(0);

    const toggleTag = useCallback((tag: string) => {
        setActiveTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
        toast.haptic(ImpactStyle.Light);
    }, []);
    const clearTags = useCallback(() => setActiveTags([]), []);

    const fetchData = useCallback(async (opts: { silent?: boolean } = {}) => {
        const myGen = fetchGenRef.current;
        if (!opts.silent) setLoading(true);
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
                if (!customStart && !customEnd) { if (!opts.silent) setLoading(false); return; }
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
                accountId: activeAccountId,
            };

            const [current, prior] = await Promise.all([
                TransactionService.getTransactions({
                    ...baseQuery,
                    startDate: startDate ? format(startDate, 'yyyy-MM-dd') : undefined,
                    endDate: endDate ? format(endDate, 'yyyy-MM-dd') : undefined,
                    // Fetch one past the cap so the truncation check below can tell
                    // "exactly at the cap" from "there's more".
                    limit: ALL_VIEW_LIMIT + 1,
                }),
                priorStart && priorEnd
                    ? TransactionService.getTransactions({
                        ...baseQuery,
                        startDate: format(priorStart, 'yyyy-MM-dd'),
                        endDate: format(priorEnd, 'yyyy-MM-dd'),
                    })
                    : Promise.resolve([] as Transaction[]),
            ]);

            if (fetchGenRef.current !== myGen) return;
            // Income transactions belong to a separate "earning" model and shouldn't
            // appear in spending analytics (category breakdown, top merchants, trend).
            // Transfers are two rows (outflow +amount, inflow -amount) moving money
            // between the user's own accounts. computeShare drops the negative leg, so
            // leaving them in would add each transfer's full amount to spending.
            const isSpending = (t: Transaction) => !t.is_income && !t.is_settlement && !t.is_transfer;
            const filteredCurrent = (current || []).filter(isSpending);
            const filteredPrior = (prior || []).filter(isSpending);

            // ALL-view safety: at high transaction counts charts and aggregations get
            // expensive. Cap the view at the latest 5000 and surface a footnote.
            let nextCurrent = filteredCurrent;
            let truncated = false;
            if (dateRange === 'ALL' && nextCurrent.length > ALL_VIEW_LIMIT) {
                nextCurrent = [...nextCurrent]
                    .sort((a, b) => (a.date < b.date ? 1 : -1))
                    .slice(0, ALL_VIEW_LIMIT);
                truncated = true;
            }
            setAllViewTruncated(truncated);
            setTransactions(nextCurrent);

            // For the heatmap and other range-aware widgets, surface the resolved window.
            if (dateRange === 'ALL') {
                if (nextCurrent.length > 0) {
                    const minDate = nextCurrent.reduce((m, t) => t.date < m ? t.date : m, nextCurrent[0].date).slice(0, 10);
                    const maxDate = nextCurrent.reduce((m, t) => t.date > m ? t.date : m, nextCurrent[0].date).slice(0, 10);
                    setRangeStart(parseISO(minDate));
                    setRangeEnd(parseISO(maxDate));
                } else {
                    setRangeStart(null);
                    setRangeEnd(null);
                }
            } else {
                setRangeStart(startDate);
                // endDate is exclusive in the fetch (custom range adds +1 day); for display roll back one.
                if (endDate) {
                    const eDisp = new Date(endDate);
                    eDisp.setDate(eDisp.getDate() - 1);
                    setRangeEnd(eDisp);
                } else {
                    setRangeEnd(now);
                }
            }
            setPriorTransactions(filteredPrior);
            setPriorStart(priorStart);
        } catch (err) {
            if (fetchGenRef.current !== myGen) return;
            console.error('Error fetching analytics:', err);
            setError(err instanceof Error ? err.message : 'Failed to load analytics data');
            toast.error('Failed to load analytics data');
        } finally {
            if (fetchGenRef.current === myGen && !opts.silent) setLoading(false);
        }
    }, [userId, activeWorkspaceId, activeAccountId, dateRange, selectedBucketId, customStart, customEnd]);

    useEffect(() => {
        if (userId) {
            fetchGenRef.current++;
            fetchData();
        }
    }, [fetchData, userId, currency]);

    useTransactionInvalidationListener(() => fetchData({ silent: true }));

    useRefreshRequest(() => fetchData({ silent: true }));

    // Real-time subscription for transactions. Silent refetch so the chart
    // doesn't flash a skeleton when a new tx lands in another tab.
    const analyticsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const debouncedFetchData = useCallback(() => {
        if (analyticsDebounceRef.current) clearTimeout(analyticsDebounceRef.current);
        analyticsDebounceRef.current = setTimeout(() => fetchData({ silent: true }), 300);
    }, [fetchData]);

    useEffect(() => {
        if (!userId) return;

        const txFilter = activeWorkspaceId
            ? `group_id=eq.${activeWorkspaceId}`
            : `user_id=eq.${userId}`;

        const channel = supabase
            .channel(`analytics-updates-${userId}-${activeWorkspaceId || 'personal'}-${crypto.randomUUID()}`)
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
        recurringTotal,
        discretionaryTotal,
        recurringTopCategories,
        discretionaryTopCategories,
        recurringTopItems,
        discretionaryTopItems,
        tagBreakdown,
        categoryAnomalies,
        dailyTotals,
        locationClusters,
        geoTxCount,
        recentSpent7d,
    } = useAnalyticsData({
        transactions,
        priorTransactions,
        priorStart,
        dateRange,
        currency,
        userId,
        convertAmount,
        activeTags,
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

    const focusedBucket = selectedBucketId !== 'all'
        ? buckets.find(b => b.id === selectedBucketId)
        : null;

    const heroMonthlyBudget = selectedBucketId === 'all' && activeTags.length === 0
        ? (activeWorkspaceId
            ? (convertedWorkspaceBudgets[activeWorkspaceId] || 0)
            : monthlyBudget)
        : 0;

    return (
        <div className="relative min-h-[100dvh]">
            <div className={cn(
                'p-5 space-y-6 max-w-md lg:max-w-4xl mx-auto relative',
                // No dim or blur while loading: AnalyticsSkeleton renders *inside* this
                // wrapper, so the old `opacity-50 blur-[2px]` was blurring its own
                // placeholder. A dim is only meaningful over real, stale content, and there
                // is none here. `blur-[2px]` over every Recharts SVG also forced a full-page
                // offscreen raster on each range/tag toggle, animated across 300ms by
                // `transition-all`. Pointer-events stay suppressed so the range picker can't
                // be driven mid-fetch.
                loading && 'pointer-events-none'
            )}>
                {/* Sticky Header — slim: back / title / period badge + total chip when scrolled */}
                <div className="sticky top-0 z-20 -mx-5 px-5 py-2 bg-background/85 backdrop-blur-xl border-b border-white/5">
                    <ViewHeader
                        title="Analytics"
                        onBack
                        right={
                            <>
                            {!loading && totalSpentInRange > 0 && (
                                <span className={cn(
                                    'text-caption font-bold tabular-nums px-2 py-0.5 rounded-md border',
                                    themeConfig.bgLight,
                                    themeConfig.borderMedium,
                                    themeConfig.text,
                                )}>
                                    {formatCurrency(Math.round(totalSpentInRange))}
                                </span>
                            )}
                            <span className="text-eyebrow uppercase px-2 py-0.5 rounded-md bg-secondary/30 text-muted-foreground">
                                {dateRange === 'ALL' ? 'All' : dateRange}
                            </span>
                            </>
                        }
                    />
                </div>

                {/* Filters Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 px-1">
                    <Select value={selectedBucketId} onValueChange={(val) => {
                        setSelectedBucketId(val);
                        toast.haptic(ImpactStyle.Light);
                    }}>
                        <SelectTrigger className={cn(
                            'w-full px-3 h-10 text-xs rounded-xl font-bold border transition-colors',
                            selectedBucketId === 'all'
                                ? 'bg-secondary/20 border-white/5 text-foreground/80'
                                : cn(themeConfig.bgLight, themeConfig.borderMedium, themeConfig.text),
                        )}>
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
                                                <BucketIcon icon={b.icon} className="w-full h-full" />
                                            </div>
                                            <span className="flex-1 truncate">{b.name}</span>
                                            {Number(b.budget) > 0 && (
                                                <span className={cn(
                                                    'ml-2 text-caption font-bold tabular-nums shrink-0',
                                                    remaining < 0 ? 'text-rose-400' : 'text-muted-foreground/70'
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
                        <SelectTrigger className="w-full px-3 h-10 text-xs bg-secondary/20 border-white/5 rounded-xl font-bold">
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
                                { label: 'This Week', from: () => format(startOfWeek(new Date(), { weekStartsOn: firstDayOfWeek }), 'yyyy-MM-dd'), to: () => format(new Date(), 'yyyy-MM-dd') },
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
                                    className="relative tap-target h-7 px-3 rounded-full text-eyebrow uppercase bg-secondary/30 hover:bg-secondary/50 border border-white/5 transition-colors"
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className="text-eyebrow uppercase text-white/40 mb-1 block">From</label>
                                <input
                                    type="date"
                                    value={customStart}
                                    max={customEnd || undefined}
                                    onChange={(e) => setCustomStart(e.target.value)}
                                    className="w-full h-10 px-3 rounded-xl bg-secondary/20 border border-white/5 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-primary/50 [color-scheme:dark]"
                                />
                            </div>
                            <div className="flex-1">
                                <label className="text-eyebrow uppercase text-white/40 mb-1 block">To</label>
                                <input
                                    type="date"
                                    value={customEnd}
                                    min={customStart || undefined}
                                    onChange={(e) => setCustomEnd(e.target.value)}
                                    className="w-full h-10 px-3 rounded-xl bg-secondary/20 border border-white/5 text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-primary/50 [color-scheme:dark]"
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
                            <p className="text-sm font-bold text-destructive">Couldn&apos;t load analytics</p>
                            <p className="text-xs text-muted-foreground">{error}</p>
                            <Button
                                onClick={() => fetchData()}
                                size="sm" className="px-4 text-xs font-bold"
                            >
                                Retry
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        {/* Hero — headline total, MoM, sparkline, pacing chip */}
                        <AnalyticsHero
                            dateRange={dateRange}
                            rangeStart={rangeStart}
                            rangeEnd={rangeEnd}
                            totalSpentInRange={totalSpentInRange}
                            dailyTotals={dailyTotals}
                            priorTotal={priorTotal}
                            priorMTDTotal={priorMTDTotal}
                            recentSpent7d={recentSpent7d}
                            monthlyBudget={heroMonthlyBudget}
                            avgPerDay={avgPerDay}
                            txCount={txCount}
                            busiestLabel={busiestLabel}
                            formatCurrency={formatCurrency}
                            themeConfig={themeConfig}
                            themeHex={themeHex}
                        />

                        {/* Bucket Progress Highlight — only when bucket selected */}
                        {focusedBucket && (() => {
                            const bucketCurr = (focusedBucket.currency || currency).toUpperCase();
                            const budgetInBase = convertAmount(Number(focusedBucket.budget || 0), bucketCurr);
                            const remaining = budgetInBase - totalSpentInRange;
                            return (
                                <Card className={cn(themeConfig.bgLight, themeConfig.borderMedium, themeConfig.shadowGlow)}>
                                    <CardContent className="p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                'w-10 h-10 rounded-xl flex items-center justify-center border',
                                                themeConfig.bgMedium,
                                                themeConfig.text,
                                                themeConfig.borderMedium,
                                            )}>
                                                <BucketIcon icon={focusedBucket.icon} className="w-full h-full" />
                                            </div>
                                            <div>
                                                <h4 className={cn('text-sm font-bold', themeConfig.text)}>{focusedBucket.name}</h4>
                                                <p className={cn('text-meta font-bold uppercase tracking-widest', themeConfig.textOpacity)}>Targeted View</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={cn('text-meta font-bold uppercase tracking-widest', themeConfig.textOpacity)}>Budget Remaining</p>
                                            <p className={cn('text-sm font-bold', themeConfig.text)}>
                                                {formatCurrency(remaining)}
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })()}

                        <MonthlyRecapCard formatCurrency={formatCurrency} />

                        {transactions.length === 0 ? (
                            <Card className="bg-card/40 border-white/5 shadow-none py-0">
                                <EmptyState
                                    size="page"
                                    iconVariant="tile"
                                    icon={ChartLine}
                                    title="No transactions in this range"
                                    description="Try a wider period from the picker above, or add an expense to start seeing trends."
                                    action={{ label: 'Add expense', icon: Plus, onClick: () => router.push('/add') }}
                                />
                            </Card>
                        ) : (
                            <>
                                {/* ── OVERVIEW ───────────────────────────────────────── */}
                                <SectionLabel label="Overview" />

                                <SpendingTrendCard
                                    userId={userId}
                                    dateRange={dateRange}
                                    selectedBucketId={selectedBucketId}
                                    categoryTrendData={categoryTrendData}
                                    activeCategories={activeCategories}
                                    totalSpentInRange={totalSpentInRange}
                                    recentSpent7d={recentSpent7d}
                                    priorTotal={priorTotal}
                                    formatCurrency={formatCurrency}
                                    convertAmount={convertAmount}
                                    themeConfig={themeConfig}
                                    themeHex={themeHex}
                                />

                                <RecurringSplitCard
                                    recurringTotal={recurringTotal}
                                    discretionaryTotal={discretionaryTotal}
                                    recurringTopCategories={recurringTopCategories}
                                    discretionaryTopCategories={discretionaryTopCategories}
                                    recurringTopItems={recurringTopItems}
                                    discretionaryTopItems={discretionaryTopItems}
                                    formatCurrency={formatCurrency}
                                />

                                {/* ── BREAKDOWN ──────────────────────────────────────── */}
                                <SectionLabel label="Breakdown" />

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <LazyMount placeholderHeight={260}>
                                        <CategoryBreakdownCard
                                            title={
                                                focusedBucket
                                                    ? `Categories within ${focusedBucket.name}`
                                                    : 'Spending by Category'
                                            }
                                            categoryBreakdown={categoryBreakdown}
                                            categorizedBreakdown={categorizedBreakdown}
                                            formatCurrency={formatCurrency}
                                            analyticsDateRange={analyticsDateRange}
                                            anomalies={categoryAnomalies}
                                        />
                                    </LazyMount>

                                    <LazyMount placeholderHeight={260}>
                                        <PaymentBreakdownCard
                                            paymentBreakdown={paymentBreakdown}
                                            categorizedPayment={categorizedPayment}
                                            formatCurrency={formatCurrency}
                                        />
                                    </LazyMount>
                                </div>

                                <TagsFilterCard
                                    tagBreakdown={tagBreakdown}
                                    activeTags={activeTags}
                                    onToggle={toggleTag}
                                    onClear={clearTags}
                                    formatCurrency={formatCurrency}
                                    themeConfig={themeConfig}
                                />

                                {/* ── PATTERNS ───────────────────────────────────────── */}
                                <SectionLabel label="Patterns" />

                                {dateRange !== '1M' && dateRange !== 'LM' && (
                                    <LazyMount placeholderHeight={220}>
                                        <CalendarHeatmapCard
                                            dailyTotals={dailyTotals}
                                            rangeStart={rangeStart}
                                            rangeEnd={rangeEnd}
                                            formatCurrency={formatCurrency}
                                            themeConfig={themeConfig}
                                            themeHex={themeHex}
                                        />
                                    </LazyMount>
                                )}

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <LazyMount placeholderHeight={200}>
                                        <WeekdayChartCard
                                            weekdayTotals={weekdayTotals}
                                            totalSpentInRange={totalSpentInRange}
                                            formatCurrency={formatCurrency}
                                            themeHex={themeHex}
                                        />
                                    </LazyMount>

                                    <LazyMount placeholderHeight={200}>
                                        <TopMerchantsCard
                                            topMerchants={topMerchants}
                                            newMerchantsCount={newMerchantsCount}
                                            formatCurrency={formatCurrency}
                                        />
                                    </LazyMount>
                                </div>

                                {locationClusters.length > 0 ? (
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        <LazyMount placeholderHeight={180}>
                                            <LargestTransactionsCard
                                                top3Largest={top3Largest}
                                                formatCurrency={formatCurrency}
                                            />
                                        </LazyMount>
                                        <LazyMount placeholderHeight={260}>
                                            <LocationInsightsCard
                                                locationClusters={locationClusters}
                                                geoTxCount={geoTxCount}
                                                formatCurrency={formatCurrency}
                                                themeConfig={themeConfig}
                                                themeHex={themeHex}
                                            />
                                        </LazyMount>
                                    </div>
                                ) : (
                                    <LazyMount placeholderHeight={180}>
                                        <LargestTransactionsCard
                                            top3Largest={top3Largest}
                                            formatCurrency={formatCurrency}
                                        />
                                    </LazyMount>
                                )}

                                {/* ── EXPLORE ────────────────────────────────────────── */}
                                <SectionLabel label="Explore" />

                                <LazyMount placeholderHeight={140}>
                                    <WhatIfCard
                                        transactions={transactions}
                                        userId={userId}
                                        currency={currency}
                                        convertAmount={convertAmount}
                                        formatCurrency={formatCurrency}
                                    />
                                </LazyMount>

                                <LazyMount placeholderHeight={120}>
                                    <InsightsChatCard
                                        dateRange={dateRange}
                                        customStart={customStart}
                                        customEnd={customEnd}
                                        bucketId={selectedBucketId}
                                    />
                                </LazyMount>

                                {/* Currency conversion staleness footnote */}
                                {usedConversion && ratesLastUpdated && (Date.now() - ratesLastUpdated) > 24 * 60 * 60 * 1000 && (
                                    <p className="text-caption text-muted-foreground/60 text-center px-2">
                                        Some amounts converted using exchange rates last refreshed {format(new Date(ratesLastUpdated), 'd MMM, h:mm a')}.
                                    </p>
                                )}

                                {allViewTruncated && (
                                    <p className="text-caption text-muted-foreground/60 text-center px-2">
                                        Showing your most recent 5,000 transactions. Pick a narrower range for more detail.
                                    </p>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
