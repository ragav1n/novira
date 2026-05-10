'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Currency } from '@/components/providers/user-preferences-provider';

interface WeekdaySpendingCardProps {
    totals: number[];
    maxValue: number;
    todayIndex: number;
    formatCurrency: (val: number, cur: Currency) => string;
    displayCurrency: Currency;
    isCoupleWorkspace: boolean;
    isHomeWorkspace: boolean;
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
const BAR_HEIGHT_PX = 64;
const MIN_BAR_PX = 2;

export const WeekdaySpendingCard = React.memo(function WeekdaySpendingCard({
    totals,
    maxValue,
    todayIndex,
    formatCurrency,
    displayCurrency,
    isCoupleWorkspace,
    isHomeWorkspace,
}: WeekdaySpendingCardProps) {
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

    const accent = isCoupleWorkspace ? 'rose' : isHomeWorkspace ? 'yellow' : 'primary';
    const ringClass =
        accent === 'rose' ? 'bg-rose-500/10 border-rose-500/20' :
        accent === 'yellow' ? 'bg-yellow-500/10 border-yellow-500/20' :
        'bg-primary/10 border-primary/20';
    const iconClass =
        accent === 'rose' ? 'text-rose-400' :
        accent === 'yellow' ? 'text-yellow-500' :
        'text-primary';
    const baseBarClass =
        accent === 'rose' ? 'bg-rose-500/40' :
        accent === 'yellow' ? 'bg-yellow-500/40' :
        'bg-primary/40';
    const todayBarClass =
        accent === 'rose' ? 'bg-rose-400 ring-2 ring-rose-300/40' :
        accent === 'yellow' ? 'bg-yellow-400 ring-2 ring-yellow-300/40' :
        'bg-primary ring-2 ring-primary/40';
    const selectedBarClass =
        accent === 'rose' ? 'bg-rose-500 ring-2 ring-rose-300/60' :
        accent === 'yellow' ? 'bg-yellow-500 ring-2 ring-yellow-300/60' :
        'bg-primary ring-2 ring-primary/60';

    const peakIndex = totals.indexOf(maxValue);
    // Default the inline summary to today's value so the card always reads as
    // a real number, not a static label.
    const displayIdx = selectedIdx ?? todayIndex;
    const displayValue = totals[displayIdx];

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn('p-4 rounded-3xl border backdrop-blur-md relative overflow-hidden', ringClass)}
        >
            <div className="flex items-start justify-between mb-3 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <CalendarDays className={cn('w-4 h-4 shrink-0', iconClass)} />
                    <h3 className="text-sm font-bold truncate">Weekday Pattern</h3>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-secondary/30 px-2 py-0.5 rounded-full whitespace-nowrap">
                    Peak {DAY_NAMES[peakIndex]}
                </span>
            </div>

            <div className="flex items-baseline justify-between gap-2 mb-2 min-h-[20px]">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={displayIdx}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.18 }}
                        className="flex items-baseline gap-1.5 min-w-0"
                    >
                        <span className="text-sm font-bold text-foreground">
                            {DAY_NAMES[displayIdx]}
                            {displayIdx === todayIndex && selectedIdx === null && (
                                <span className="ml-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">today</span>
                            )}
                        </span>
                        <span className="text-sm font-bold tabular-nums text-foreground">
                            {formatCurrency(displayValue, displayCurrency)}
                        </span>
                    </motion.div>
                </AnimatePresence>
                {selectedIdx !== null && (
                    <button
                        type="button"
                        onClick={() => setSelectedIdx(null)}
                        className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Clear
                    </button>
                )}
            </div>

            <div className="flex items-end justify-between gap-1.5" style={{ height: `${BAR_HEIGHT_PX}px` }}>
                {totals.map((value, i) => {
                    const ratio = maxValue > 0 ? value / maxValue : 0;
                    const heightPx = Math.max(MIN_BAR_PX, Math.round(ratio * BAR_HEIGHT_PX));
                    const isToday = i === todayIndex;
                    const isSelected = selectedIdx === i;
                    const barColorClass = isSelected
                        ? selectedBarClass
                        : isToday
                            ? todayBarClass
                            : baseBarClass;
                    return (
                        <button
                            key={i}
                            type="button"
                            onClick={() => setSelectedIdx(prev => (prev === i ? null : i))}
                            aria-label={`${DAY_NAMES[i]}: ${formatCurrency(value, displayCurrency)}`}
                            aria-pressed={isSelected}
                            title={`${DAY_NAMES[i]}: ${formatCurrency(value, displayCurrency)}`}
                            className="flex-1 flex flex-col justify-end items-stretch h-full focus:outline-none group cursor-pointer"
                        >
                            <div
                                className={cn(
                                    'rounded-md transition-all duration-300 group-active:scale-[0.96] group-hover:opacity-90',
                                    barColorClass
                                )}
                                style={{ height: `${heightPx}px` }}
                            />
                        </button>
                    );
                })}
            </div>

            <div className="flex items-end justify-between gap-1.5 mt-2">
                {DAY_LABELS.map((label, i) => (
                    <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedIdx(prev => (prev === i ? null : i))}
                        aria-label={`${DAY_NAMES[i]}: ${formatCurrency(totals[i], displayCurrency)}`}
                        className={cn(
                            'flex-1 text-center text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer hover:text-foreground',
                            i === selectedIdx
                                ? 'text-foreground'
                                : i === todayIndex
                                    ? 'text-foreground/80'
                                    : 'text-muted-foreground/70'
                        )}
                    >
                        {label}
                    </button>
                ))}
            </div>
        </motion.div>
    );
});
WeekdaySpendingCard.displayName = 'WeekdaySpendingCard';
