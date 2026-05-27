'use client';

import { memo, useMemo } from 'react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { endOfMonth, format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { DateRange } from '@/hooks/useAnalyticsData';
import type { WorkspaceTheme } from '@/hooks/useWorkspaceTheme';
import { computeWeightedRunRate } from '@/lib/utils/run-rate';

interface Props {
    dateRange: DateRange;
    rangeStart: Date | null;
    rangeEnd: Date | null;
    totalSpentInRange: number;
    dailyTotals: Record<string, number>;
    priorTotal: number;
    priorMTDTotal: number;
    recentSpent7d: number;
    monthlyBudget: number;
    avgPerDay: number;
    txCount: number;
    busiestLabel: string | null;
    formatCurrency: (amount: number) => string;
    themeConfig: WorkspaceTheme;
    themeHex: { base: string; light: string };
}

const DATE_RANGE_LABEL: Record<DateRange, string> = {
    '1M': 'Current Month',
    'LM': 'Last Month',
    '3M': 'Last 3 Months',
    '6M': 'Last 6 Months',
    '1Y': 'Last Year',
    'ALL': 'All Time',
    'CUSTOM': 'Custom Range',
};

function AnalyticsHeroInner({
    dateRange,
    rangeStart,
    rangeEnd,
    totalSpentInRange,
    dailyTotals,
    priorTotal,
    priorMTDTotal,
    recentSpent7d,
    monthlyBudget,
    avgPerDay,
    txCount,
    busiestLabel,
    formatCurrency,
    themeConfig,
    themeHex,
}: Props) {
    const monthsBackKind: 'days' | 'months' = (dateRange === '1M' || dateRange === 'LM') ? 'days' : 'months';

    const dateLabel = useMemo(() => {
        if (!rangeStart || !rangeEnd) return DATE_RANGE_LABEL[dateRange];
        const sameYear = rangeStart.getFullYear() === rangeEnd.getFullYear();
        const startFmt = sameYear ? 'd MMM' : 'd MMM yyyy';
        return `${format(rangeStart, startFmt)} – ${format(rangeEnd, 'd MMM yyyy')}`;
    }, [rangeStart, rangeEnd, dateRange]);

    const sparkData = useMemo(() => {
        const entries = Object.entries(dailyTotals)
            .map(([date, amount]) => ({ date, amount }))
            .sort((a, b) => a.date.localeCompare(b.date));
        return entries;
    }, [dailyTotals]);

    const momDelta = useMemo(() => {
        if (dateRange === 'ALL') return null;
        const baseline = dateRange === '1M' ? priorMTDTotal : priorTotal;
        if (baseline <= 0) return null;
        const diff = totalSpentInRange - baseline;
        const pct = (diff / baseline) * 100;
        return {
            pct,
            direction: diff > 0 ? 'up' as const : diff < 0 ? 'down' as const : 'flat' as const,
        };
    }, [dateRange, priorMTDTotal, priorTotal, totalSpentInRange]);

    const pacingChip = useMemo(() => {
        if (dateRange !== '1M' || totalSpentInRange <= 0) return null;
        const today = new Date();
        const day = today.getDate();
        if (day < 3) return null;
        const daysInMonth = endOfMonth(today).getDate();
        const rr = computeWeightedRunRate({
            totalSpent: totalSpentInRange,
            recentSpent: recentSpent7d,
            daysIntoMonth: day,
            daysInMonth,
            budget: monthlyBudget,
        });
        return {
            projected: rr.projectedSpend,
            isExceeding: rr.isExceeding,
            percentOfBudget: rr.percentOfBudget,
            overshoot: rr.overshoot,
            hasBudget: monthlyBudget > 0,
        };
    }, [dateRange, totalSpentInRange, recentSpent7d, monthlyBudget]);

    const gradientId = `hero-spark-${themeHex.base.replace('#', '')}`;

    const showDateRange = !!rangeStart && !!rangeEnd && dateLabel !== DATE_RANGE_LABEL[dateRange];

    return (
        <div className="relative overflow-hidden rounded-3xl border border-white/5">
            <div className={cn('absolute inset-0 bg-gradient-to-br', themeConfig.gradient)} />
            <div className="absolute inset-0 bg-gradient-to-t from-background/30 via-transparent to-transparent" />

            <div className="relative p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn('text-[10px] font-bold uppercase tracking-[0.22em]', themeConfig.text)}>
                        {DATE_RANGE_LABEL[dateRange]}
                    </span>
                    {showDateRange && (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                            · {dateLabel}
                        </span>
                    )}
                </div>

                <div className="flex items-end justify-between gap-3 flex-wrap">
                    <div className="flex items-baseline gap-3 flex-wrap">
                        <span
                            className="text-3xl sm:text-4xl font-bold tabular-nums tracking-tight leading-none"
                            style={{ textWrap: 'balance' }}
                        >
                            {formatCurrency(totalSpentInRange)}
                        </span>
                        {momDelta && (
                            <span
                                className={cn(
                                    'text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-md border',
                                    momDelta.direction === 'up'
                                        ? 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                                        : momDelta.direction === 'down'
                                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                                            : 'bg-secondary/30 border-white/10 text-muted-foreground'
                                )}
                                title={dateRange === '1M' ? 'Same period last month' : 'Previous period'}
                            >
                                {momDelta.direction === 'up' ? '▲' : momDelta.direction === 'down' ? '▼' : '·'} {Math.abs(momDelta.pct).toFixed(0)}% vs prior
                            </span>
                        )}
                    </div>
                </div>

                {sparkData.length > 1 && (
                    <div className="h-12 w-full -mx-1">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={sparkData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                                <defs>
                                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor={themeHex.light} stopOpacity={0.55} />
                                        <stop offset="100%" stopColor={themeHex.base} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <Area
                                    type="monotone"
                                    dataKey="amount"
                                    stroke={themeHex.light}
                                    strokeWidth={1.75}
                                    fill={`url(#${gradientId})`}
                                    isAnimationActive
                                    animationDuration={900}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                    <HeroStat
                        label={`Avg / ${monthsBackKind === 'days' ? 'Day' : 'Month'}`}
                        value={formatCurrency(avgPerDay)}
                    />
                    <HeroStat label="Transactions" value={String(txCount)} />
                    <HeroStat
                        label={monthsBackKind === 'days' ? 'Top Day' : 'Top Month'}
                        value={busiestLabel || '—'}
                        muted={!busiestLabel}
                    />
                </div>

                {pacingChip && (
                    <div className="flex items-center gap-2 pt-1">
                        <span
                            className={cn(
                                'text-[10px] px-2.5 py-1 rounded-md font-bold border tabular-nums',
                                pacingChip.isExceeding
                                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-200'
                                    : pacingChip.hasBudget && pacingChip.percentOfBudget !== null && pacingChip.percentOfBudget > 85
                                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-200'
                                        : cn(themeConfig.bgLight, themeConfig.borderMedium, themeConfig.text),
                            )}
                            title={
                                pacingChip.hasBudget
                                    ? `Projected month-end total at current pace${pacingChip.isExceeding ? ' — over budget' : ''}`
                                    : 'Estimated end-of-month total at current pace'
                            }
                        >
                            {pacingChip.isExceeding
                                ? `${formatCurrency(pacingChip.projected)} · +${formatCurrency(pacingChip.overshoot)} over`
                                : pacingChip.hasBudget && pacingChip.percentOfBudget !== null
                                    ? `${formatCurrency(pacingChip.projected)} · ${Math.round(pacingChip.percentOfBudget)}% of budget`
                                    : `On pace · ${formatCurrency(pacingChip.projected)}`}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}

function HeroStat({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
    return (
        <div className="rounded-xl bg-background/40 border border-white/5 px-3 py-2 backdrop-blur-sm">
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/70">
                {label}
            </p>
            <p
                className={cn(
                    'text-[13px] font-bold mt-0.5 tabular-nums truncate',
                    muted && 'text-muted-foreground'
                )}
            >
                {value}
            </p>
        </div>
    );
}

export const AnalyticsHero = memo(AnalyticsHeroInner);
