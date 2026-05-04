'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChartLine } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { TransactionService } from '@/lib/services/transaction-service';
import { getIconForCategory } from '@/lib/categories';
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
import { Transaction } from '@/types/transaction';
import { supabase } from '@/lib/supabase';
import { toast, ImpactStyle } from '@/utils/haptics';
import { AnalyticsSkeleton } from '@/components/analytics/analytics-skeleton';
import { MonthlyRecapCard } from '@/components/analytics/monthly-recap-card';
import { SpendingTrendCard } from '@/components/analytics/spending-trend-card';
import { WeekdayChartCard } from '@/components/analytics/weekday-chart-card';
import { TopMerchantsCard } from '@/components/analytics/top-merchants-card';
import { LargestTransactionsCard } from '@/components/analytics/largest-transactions-card';
import { CategoryBreakdownCard } from '@/components/analytics/category-breakdown-card';
import { PaymentBreakdownCard } from '@/components/analytics/payment-breakdown-card';

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

                <MonthlyRecapCard currency={currency} formatCurrency={formatCurrency} />

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
                <SpendingTrendCard
                    userId={userId}
                    dateRange={dateRange}
                    selectedBucketId={selectedBucketId}
                    categoryTrendData={categoryTrendData}
                    activeCategories={activeCategories}
                    totalSpentInRange={totalSpentInRange}
                    avgPerDay={avgPerDay}
                    txCount={txCount}
                    busiestLabel={busiestLabel}
                    priorTotal={priorTotal}
                    priorMTDTotal={priorMTDTotal}
                    formatCurrency={formatCurrency}
                    convertAmount={convertAmount}
                />

                <WeekdayChartCard
                    weekdayTotals={weekdayTotals}
                    totalSpentInRange={totalSpentInRange}
                    formatCurrency={formatCurrency}
                />

                <TopMerchantsCard
                    topMerchants={topMerchants}
                    newMerchantsCount={newMerchantsCount}
                    formatCurrency={formatCurrency}
                />

                <LargestTransactionsCard
                    top3Largest={top3Largest}
                    formatCurrency={formatCurrency}
                />

                <CategoryBreakdownCard
                    title={
                        selectedBucketId !== 'all' && buckets.find(b => b.id === selectedBucketId)
                            ? `Categories within ${buckets.find(b => b.id === selectedBucketId)!.name}`
                            : 'Spending by Category'
                    }
                    categoryBreakdown={categoryBreakdown}
                    categorizedBreakdown={categorizedBreakdown}
                    formatCurrency={formatCurrency}
                    analyticsDateRange={analyticsDateRange}
                />

                <PaymentBreakdownCard
                    paymentBreakdown={paymentBreakdown}
                    categorizedPayment={categorizedPayment}
                    formatCurrency={formatCurrency}
                />

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
