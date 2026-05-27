'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { endOfMonth, format, isAfter, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { CATEGORY_COLORS, getCategoryLabel } from '@/lib/categories';
import { supabase } from '@/lib/supabase';
import { AnalyticsTooltip } from '@/components/analytics/analytics-tooltip';
import type { DateRange } from '@/hooks/useAnalyticsData';
import { computeWeightedRunRate } from '@/lib/utils/run-rate';
import type { WorkspaceTheme } from '@/hooks/useWorkspaceTheme';

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
    recentSpent7d: number;
    priorTotal: number;
    formatCurrency: (amount: number) => string;
    convertAmount: (amount: number, fromCurrency: string) => number;
    themeConfig: WorkspaceTheme;
    themeHex: { base: string; light: string };
}

function SpendingTrendCardInner({
    userId,
    dateRange,
    selectedBucketId,
    categoryTrendData,
    activeCategories,
    totalSpentInRange,
    recentSpent7d,
    priorTotal,
    formatCurrency,
    convertAmount,
    themeConfig,
    themeHex,
}: Props) {
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

    const forecastChartData = useMemo(() => {
        if (dateRange !== '1M') return categoryTrendData;
        const today = new Date();
        const dom = today.getDate();
        const monthEnd = endOfMonth(today);
        const dim = monthEnd.getDate();
        if (dom < 3 || dom >= dim) return categoryTrendData;

        const runRate = computeWeightedRunRate({
            totalSpent: totalSpentInRange,
            recentSpent: recentSpent7d,
            daysIntoMonth: dom,
            daysInMonth: dim,
            budget: 0,
        }).dailyAverage;

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
    }, [categoryTrendData, recurringForecast, dateRange, selectedBucketId, totalSpentInRange, recentSpent7d, convertAmount]);

    const hasForecast = useMemo(
        () => dateRange === '1M' && forecastChartData.some(b => typeof (b as { forecast_total?: number }).forecast_total === 'number'),
        [forecastChartData, dateRange]
    );

    return (
        <Card className="bg-card/40 backdrop-blur-md border-white/5 shadow-none overflow-hidden">
            <CardContent className="p-4 space-y-3">
                <div className="flex justify-between items-center gap-2">
                    <h3 className="font-bold text-[13px] uppercase tracking-wider text-muted-foreground/80">Spending Trend</h3>
                    {hasForecast && (
                        <span
                            className={cn(
                                'text-[10px] px-2 py-0.5 rounded-md font-bold border',
                                themeConfig.bgLight,
                                themeConfig.borderMedium,
                                themeConfig.text,
                            )}
                            title="Run-rate plus upcoming recurring charges"
                        >
                            Forecast on
                        </span>
                    )}
                </div>

                <div
                    className="h-[160px] w-full rounded-xl relative"
                    style={{
                        backgroundImage: `radial-gradient(ellipse 80% 60% at 50% 100%, ${themeHex.base}14 0%, transparent 70%)`,
                    }}
                >
                    {activeCategories.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={forecastChartData} margin={{ top: 8, right: 6, bottom: 0, left: 6 }}>
                                <XAxis
                                    dataKey="month"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 600 }}
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
                                        stroke={themeHex.base}
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
                        {dateRange !== 'ALL' && priorTotal > 0 && (
                            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary/10 border border-white/5 text-muted-foreground/70">
                                <span className="inline-block w-3 border-t border-dashed border-white/40" />
                                Prior
                            </span>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export const SpendingTrendCard = memo(SpendingTrendCardInner);
