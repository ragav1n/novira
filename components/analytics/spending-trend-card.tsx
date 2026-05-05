'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { endOfMonth, format, isAfter, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { CATEGORY_COLORS, getCategoryLabel } from '@/lib/categories';
import { supabase } from '@/lib/supabase';
import { AnalyticsTooltip } from '@/components/analytics/analytics-tooltip';
import type { DateRange } from '@/hooks/useAnalyticsData';

type RecurringLite = {
    id: string;
    amount: number;
    currency: string;
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    next_occurrence: string;
};

interface CategoryTrendBucket {
    month: string;
    rawDate?: Date;
    prior_total?: number;
    forecast_total?: number;
    [k: string]: unknown;
}

interface Props {
    userId: string | null;
    dateRange: DateRange;
    selectedBucketId: string | 'all';
    categoryTrendData: CategoryTrendBucket[];
    activeCategories: string[];
    totalSpentInRange: number;
    avgPerDay: number;
    txCount: number;
    busiestLabel: string | null;
    priorTotal: number;
    priorMTDTotal: number;
    formatCurrency: (amount: number) => string;
    convertAmount: (amount: number, fromCurrency: string) => number;
}

export function SpendingTrendCard({
    userId,
    dateRange,
    selectedBucketId,
    categoryTrendData,
    activeCategories,
    totalSpentInRange,
    avgPerDay,
    txCount,
    busiestLabel,
    priorTotal,
    priorMTDTotal,
    formatCurrency,
    convertAmount,
}: Props) {
    const monthsBackKind: 'days' | 'months' = (dateRange === '1M' || dateRange === 'LM') ? 'days' : 'months';

    const [recurringForecast, setRecurringForecast] = useState<RecurringLite[]>([]);
    useEffect(() => {
        if (!userId) return;
        let cancelled = false;
        (async () => {
            try {
                const { data } = await supabase
                    .from('recurring_templates')
                    .select('id, amount, currency, frequency, next_occurrence')
                    .eq('user_id', userId)
                    .eq('is_active', true);
                if (!cancelled && data) setRecurringForecast(data as RecurringLite[]);
            } catch (error) {
                console.error('Error fetching recurring templates for forecast:', error);
            }
        })();
        return () => { cancelled = true; };
    }, [userId]);

    const pacingChip = useMemo(() => {
        if (dateRange !== '1M' || totalSpentInRange <= 0) return null;
        const today = new Date();
        const day = today.getDate();
        if (day < 3) return null;
        const daysInMonth = endOfMonth(today).getDate();
        const projected = (totalSpentInRange / day) * daysInMonth;
        return { projected };
    }, [dateRange, totalSpentInRange]);

    const forecastChartData = useMemo(() => {
        if (dateRange !== '1M') return categoryTrendData;
        const today = new Date();
        const dom = today.getDate();
        const monthEnd = endOfMonth(today);
        const dim = monthEnd.getDate();
        if (dom < 3 || dom >= dim) return categoryTrendData;

        const runRate = totalSpentInRange / dom;

        // Recurring spikes only apply to whole-portfolio forecasting; for a bucket-scoped
        // view we'd need to filter recurring_templates by metadata.bucket_id, which the
        // current select doesn't pull. Run-rate alone is the safe answer here.
        const recurringMap = new Map<string, number>();
        if (selectedBucketId === 'all') {
            for (const t of recurringForecast) {
                const occ = parseISO(t.next_occurrence);
                if (isNaN(occ.getTime())) continue;
                const cursor = new Date(occ);
                for (let i = 0; i < 60 && cursor <= monthEnd; i++) {
                    if (isAfter(cursor, today)) {
                        const key = format(cursor, 'MMM d');
                        const amt = convertAmount(Number(t.amount), (t.currency || 'USD').toUpperCase());
                        recurringMap.set(key, (recurringMap.get(key) || 0) + amt);
                    }
                    if (t.frequency === 'daily') cursor.setDate(cursor.getDate() + 1);
                    else if (t.frequency === 'weekly') cursor.setDate(cursor.getDate() + 7);
                    else if (t.frequency === 'monthly') { cursor.setMonth(cursor.getMonth() + 1); break; }
                    else if (t.frequency === 'yearly') break;
                    else break;
                }
            }
        }

        return categoryTrendData.map(b => {
            const date = b.rawDate as Date;
            if (!date || date <= today) return b;
            const spike = recurringMap.get(b.month) || 0;
            return { ...b, forecast_total: runRate + spike };
        });
    }, [categoryTrendData, recurringForecast, dateRange, selectedBucketId, totalSpentInRange, convertAmount]);

    const hasForecast = useMemo(
        () => dateRange === '1M' && forecastChartData.some(b => typeof (b as { forecast_total?: number }).forecast_total === 'number'),
        [forecastChartData, dateRange]
    );

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

    return (
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
                        {hasForecast && (
                            <span
                                className="text-[10px] px-2 py-0.5 rounded-md font-bold border bg-cyan-500/15 border-cyan-500/30 text-cyan-300"
                                title="Run-rate plus upcoming recurring charges"
                            >
                                Forecast on
                            </span>
                        )}
                        <span className="text-[10px] bg-secondary/30 px-2 py-0.5 rounded-md text-muted-foreground font-bold">
                            {dateRange === 'ALL' ? 'All Time' : dateRange}
                        </span>
                    </div>
                </div>

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
                            <LineChart data={forecastChartData} margin={{ top: 5, right: 5, bottom: 0, left: 5 }}>
                                <XAxis
                                    dataKey="month"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: 600 }}
                                    interval={dateRange === '1M' || dateRange === 'LM' ? 4 : (dateRange === '1Y' || dateRange === 'ALL' ? 'preserveStartEnd' : 1)}
                                />
                                <Tooltip content={<AnalyticsTooltip formatCurrency={formatCurrency} />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }} />
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
                                {hasForecast && (
                                    <Line
                                        type="monotone"
                                        dataKey="forecast_total"
                                        name="Forecast"
                                        stroke="#06B6D4"
                                        strokeWidth={2}
                                        strokeDasharray="4 3"
                                        dot={false}
                                        connectNulls
                                        animationDuration={1000}
                                        animationEasing="ease-in-out"
                                    />
                                )}
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground text-[11px] font-bold uppercase tracking-widest">
                            No spending in this range
                        </div>
                    )}
                </div>

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
    );
}
