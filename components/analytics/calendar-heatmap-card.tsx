'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from 'lucide-react';
import { format, parseISO, eachDayOfInterval, startOfWeek, endOfWeek } from 'date-fns';
import { cn } from '@/lib/utils';

interface Props {
    dailyTotals: Record<string, number>;
    rangeStart: Date | null;
    rangeEnd: Date | null;
    formatCurrency: (amount: number) => string;
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function CalendarHeatmapCard({ dailyTotals, rangeStart, rangeEnd, formatCurrency }: Props) {
    const router = useRouter();

    const { days, quantiles, weeks, totalDays, totalSpend, peakDay } = useMemo(() => {
        if (!rangeStart || !rangeEnd || rangeEnd < rangeStart) {
            return { days: [], quantiles: [0, 0, 0, 0] as number[], weeks: 0, totalDays: 0, totalSpend: 0, peakDay: null as { date: string; amount: number } | null };
        }
        const all = eachDayOfInterval({ start: rangeStart, end: rangeEnd });
        const enriched = all.map(d => {
            const key = format(d, 'yyyy-MM-dd');
            return { date: key, dt: d, amount: dailyTotals[key] || 0 };
        });

        const nonZero = enriched.filter(d => d.amount > 0).map(d => d.amount).sort((a, b) => a - b);
        // 5 colour buckets: 0 (zero), then 4 quantile slices over non-zero values.
        const q = (frac: number): number => {
            if (nonZero.length === 0) return 0;
            const idx = Math.max(0, Math.min(nonZero.length - 1, Math.floor(nonZero.length * frac) - 1));
            return nonZero[idx];
        };
        const quantiles = [q(0.25), q(0.5), q(0.75), q(1)];

        // Calendar grid is week-major (one column per week, padded to start on Monday).
        const gridStart = startOfWeek(rangeStart, { weekStartsOn: 1 });
        const gridEnd = endOfWeek(rangeEnd, { weekStartsOn: 1 });
        const gridDays = eachDayOfInterval({ start: gridStart, end: gridEnd });
        const totalSpend = enriched.reduce((s, d) => s + d.amount, 0);
        const peak = enriched.reduce<{ date: string; amount: number } | null>((best, d) => {
            if (d.amount === 0) return best;
            if (!best || d.amount > best.amount) return { date: d.date, amount: d.amount };
            return best;
        }, null);

        return {
            days: gridDays.map(d => {
                const key = format(d, 'yyyy-MM-dd');
                const inRange = d >= rangeStart && d <= rangeEnd;
                return { date: key, dt: d, amount: inRange ? (dailyTotals[key] || 0) : -1 };
            }),
            quantiles,
            weeks: Math.ceil(gridDays.length / 7),
            totalDays: enriched.length,
            totalSpend,
            peakDay: peak,
        };
    }, [dailyTotals, rangeStart, rangeEnd]);

    if (!rangeStart || !rangeEnd || days.length === 0) return null;

    const colorFor = (amount: number) => {
        if (amount < 0) return 'bg-transparent border-transparent';
        if (amount === 0) return 'bg-secondary/15 border-white/5';
        if (amount <= quantiles[0]) return 'bg-cyan-500/20 border-cyan-500/30';
        if (amount <= quantiles[1]) return 'bg-cyan-500/35 border-cyan-500/45';
        if (amount <= quantiles[2]) return 'bg-cyan-500/55 border-cyan-500/65';
        return 'bg-cyan-400/85 border-cyan-300';
    };

    const onCellClick = (date: string, amount: number) => {
        if (amount <= 0) return;
        router.push(`/search?from=${date}&to=${date}`);
    };

    return (
        <Card className="bg-card/40 backdrop-blur-md border-white/5 shadow-none">
            <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-[13px] uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        Daily Heatmap
                    </h3>
                    {peakDay && (
                        <span
                            className="text-[10px] font-bold tabular-nums px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/25 text-cyan-200"
                            title={`Peak day: ${format(parseISO(peakDay.date), 'EEE, d MMM')}`}
                        >
                            Peak {formatCurrency(Math.round(peakDay.amount))}
                        </span>
                    )}
                </div>

                <div className="flex gap-1.5">
                    <div className="flex flex-col gap-1 pt-[1px] shrink-0">
                        {DAY_LABELS.map((d, i) => (
                            <div key={i} className="h-3 text-[8px] font-bold text-muted-foreground/50 leading-3 w-2.5 text-right">
                                {i % 2 === 1 ? d : ''}
                            </div>
                        ))}
                    </div>
                    <div
                        className="grid gap-1 flex-1 overflow-x-auto"
                        style={{ gridTemplateColumns: `repeat(${weeks}, minmax(10px, 1fr))`, gridTemplateRows: 'repeat(7, 1fr)', gridAutoFlow: 'column' }}
                    >
                        {days.map(({ date, dt, amount }) => {
                            const tooltip = amount > 0
                                ? `${format(dt, 'EEE, d MMM')} · ${formatCurrency(Math.round(amount))}`
                                : amount === 0
                                    ? `${format(dt, 'EEE, d MMM')} · No spending`
                                    : '';
                            return (
                                <button
                                    key={date}
                                    onClick={() => onCellClick(date, amount)}
                                    title={tooltip}
                                    aria-label={tooltip || 'outside range'}
                                    disabled={amount <= 0}
                                    className={cn(
                                        'h-3 rounded-[3px] border transition-transform',
                                        amount > 0 && 'hover:scale-125 cursor-pointer',
                                        colorFor(amount)
                                    )}
                                />
                            );
                        })}
                    </div>
                </div>

                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 pt-1 border-t border-white/5">
                    <span>{totalDays} days · {formatCurrency(Math.round(totalSpend))}</span>
                    <div className="flex items-center gap-1">
                        <span>Less</span>
                        <span className="w-2.5 h-2.5 rounded-[3px] bg-secondary/15 border border-white/5" />
                        <span className="w-2.5 h-2.5 rounded-[3px] bg-cyan-500/20 border border-cyan-500/30" />
                        <span className="w-2.5 h-2.5 rounded-[3px] bg-cyan-500/35 border border-cyan-500/45" />
                        <span className="w-2.5 h-2.5 rounded-[3px] bg-cyan-500/55 border border-cyan-500/65" />
                        <span className="w-2.5 h-2.5 rounded-[3px] bg-cyan-400/85 border border-cyan-300" />
                        <span>More</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
