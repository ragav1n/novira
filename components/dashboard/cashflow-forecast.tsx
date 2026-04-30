'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ReferenceLine, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import type { Currency } from '@/components/providers/user-preferences-provider';

interface CashflowForecastProps {
    forecast: {
        series: { day: number; actual: number | null; forecast: number | null; budget: number }[];
        currentDayOfMonth: number;
        daysInMonth: number;
        projectedSpend: number;
        budget: number;
    };
    formatCurrency: (val: number, cur: Currency) => string;
    bucketCurrency: Currency;
    isCoupleWorkspace: boolean;
    isHomeWorkspace: boolean;
}

export const CashflowForecast = React.memo(function CashflowForecast({
    forecast,
    formatCurrency,
    bucketCurrency,
    isCoupleWorkspace,
    isHomeWorkspace
}: CashflowForecastProps) {
    const { series, currentDayOfMonth, daysInMonth, projectedSpend, budget } = forecast;
    const willExceed = budget > 0 && projectedSpend > budget;

    const accent = isCoupleWorkspace ? 'rose' : isHomeWorkspace ? 'amber' : 'primary';
    const accentColors = {
        rose: { actual: '#fb7185', forecast: '#fda4af', glow: 'bg-rose-500' },
        amber: { actual: '#fbbf24', forecast: '#fcd34d', glow: 'bg-amber-500' },
        primary: { actual: '#a855f7', forecast: '#c084fc', glow: 'bg-primary' }
    } as const;
    const colors = accentColors[accent];

    const Tip = ({ active, payload, label }: { active?: boolean; payload?: { value: number | null; name: string; color: string }[]; label?: number }) => {
        if (!active || !payload?.length) return null;
        const dayNum = label as number;
        const isFuture = dayNum > currentDayOfMonth;
        const value = payload.find(p => p.value != null)?.value ?? 0;
        return (
            <div className="bg-card/95 backdrop-blur-xl border border-white/10 px-3 py-2 rounded-xl shadow-2xl text-[11px]">
                <p className="font-bold text-foreground">Day {dayNum}</p>
                <p className="text-muted-foreground mt-0.5">
                    {isFuture ? 'Projected' : 'Actual'}:{' '}
                    <span className="font-bold text-foreground">{formatCurrency(value, bucketCurrency)}</span>
                </p>
            </div>
        );
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-3xl border border-white/5 bg-card/40 backdrop-blur-md relative overflow-hidden"
        >
            <div className={cn('absolute -top-8 -right-8 w-28 h-28 rounded-full blur-3xl opacity-20', colors.glow)} />

            <div className="relative z-10 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-muted-foreground" />
                        <h3 className="text-sm font-bold">Cashflow Forecast</h3>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-secondary/30 px-2 py-0.5 rounded-full">
                        End of {new Date().toLocaleDateString('en', { month: 'short' })}
                    </span>
                </div>

                <div className="h-[120px] w-full -mx-1">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                            <XAxis
                                dataKey="day"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: 600 }}
                                ticks={[1, Math.ceil(daysInMonth / 2), daysInMonth]}
                            />
                            <YAxis hide domain={[0, Math.max(budget * 1.1, projectedSpend * 1.05)]} />
                            <Tooltip content={<Tip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }} />
                            {budget > 0 && (
                                <ReferenceLine
                                    y={budget}
                                    stroke="rgba(255,255,255,0.25)"
                                    strokeDasharray="3 3"
                                    label={{ value: 'Budget', position: 'insideTopRight', fill: 'rgba(255,255,255,0.45)', fontSize: 9, fontWeight: 700 }}
                                />
                            )}
                            <ReferenceLine
                                x={currentDayOfMonth}
                                stroke="rgba(255,255,255,0.15)"
                                strokeWidth={1}
                            />
                            <Line
                                type="monotone"
                                dataKey="actual"
                                stroke={colors.actual}
                                strokeWidth={2.5}
                                dot={false}
                                connectNulls={false}
                                animationDuration={900}
                            />
                            <Line
                                type="monotone"
                                dataKey="forecast"
                                stroke={colors.forecast}
                                strokeWidth={2}
                                strokeDasharray="4 3"
                                dot={false}
                                connectNulls={false}
                                animationDuration={900}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px]">
                    <span className="text-muted-foreground font-medium">
                        Projected: <span className="text-foreground font-bold">{formatCurrency(projectedSpend, bucketCurrency)}</span>
                    </span>
                    {budget > 0 && (
                        <span className={cn('font-bold', willExceed ? 'text-red-400' : 'text-emerald-400')}>
                            {willExceed
                                ? `Over by ${formatCurrency(projectedSpend - budget, bucketCurrency)}`
                                : `Under by ${formatCurrency(budget - projectedSpend, bucketCurrency)}`}
                        </span>
                    )}
                </div>
            </div>
        </motion.div>
    );
});
CashflowForecast.displayName = 'CashflowForecast';
