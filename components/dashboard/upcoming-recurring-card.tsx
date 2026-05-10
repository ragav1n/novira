'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CalendarClock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getIconForCategory, CATEGORY_COLORS } from '@/lib/categories';
import type { Currency } from '@/components/providers/user-preferences-provider';
import type { UpcomingCharge } from '@/hooks/useUpcomingRecurring';

interface UpcomingRecurringCardProps {
    items: UpcomingCharge[];
    formatCurrency: (val: number, cur: Currency) => string;
    convertAmount: (amount: number, fromCurrency: string, toCurrency?: string) => number;
    displayCurrency: Currency;
    isCoupleWorkspace: boolean;
    isHomeWorkspace: boolean;
    remaining?: number;
    isBucketFocused?: boolean;
}

const MAX_VISIBLE = 3;

function dueLabel(daysUntil: number): string {
    if (daysUntil === 0) return 'Today';
    if (daysUntil === 1) return 'Tomorrow';
    return `In ${daysUntil}d`;
}

export const UpcomingRecurringCard = React.memo(function UpcomingRecurringCard({
    items,
    formatCurrency,
    convertAmount,
    displayCurrency,
    isCoupleWorkspace,
    isHomeWorkspace,
    remaining,
    isBucketFocused = false,
}: UpcomingRecurringCardProps) {
    if (items.length === 0) return null;

    const visible = items.slice(0, MAX_VISIBLE);
    const overflow = items.length - visible.length;

    const totalThisMonth = items.reduce((sum, it) => {
        const txCurr = (it.currency || 'USD').toUpperCase();
        if (txCurr === displayCurrency) return sum + it.amount;
        return sum + convertAmount(it.amount, txCurr, displayCurrency);
    }, 0);

    // Budget context: hidden in bucket focus (different semantics) and when
    // remaining is unset/non-positive (would show nonsense like "-300% of remaining").
    const showBudgetContext =
        !isBucketFocused &&
        typeof remaining === 'number' &&
        remaining > 0 &&
        totalThisMonth > 0;
    const exceedsRemaining = showBudgetContext && totalThisMonth > (remaining as number);
    const pctOfRemaining = showBudgetContext
        ? Math.min(999, Math.round((totalThisMonth / (remaining as number)) * 100))
        : 0;

    const accent = isCoupleWorkspace ? 'rose' : isHomeWorkspace ? 'yellow' : 'primary';
    const ringClass =
        accent === 'rose' ? 'bg-rose-500/10 border-rose-500/20' :
        accent === 'yellow' ? 'bg-yellow-500/10 border-yellow-500/20' :
        'bg-primary/10 border-primary/20';
    const iconClass =
        accent === 'rose' ? 'text-rose-400' :
        accent === 'yellow' ? 'text-yellow-500' :
        'text-primary';

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn('p-4 rounded-3xl border backdrop-blur-md relative overflow-hidden', ringClass)}
        >
            <div className="flex items-start justify-between mb-2 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <CalendarClock className={cn('w-4 h-4 shrink-0', iconClass)} />
                    <h3 className="text-sm font-bold truncate">Coming Up This Month</h3>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-secondary/30 px-2 py-0.5 rounded-full whitespace-nowrap">
                    {formatCurrency(totalThisMonth, displayCurrency)}
                </span>
            </div>

            {showBudgetContext && (
                <div
                    className={cn(
                        'flex items-center gap-1.5 text-[11px] font-bold mb-3 px-2 py-1 rounded-lg border',
                        exceedsRemaining
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            : 'bg-secondary/20 text-muted-foreground border-white/5'
                    )}
                >
                    {exceedsRemaining ? (
                        <>
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span>
                                Exceeds remaining {formatCurrency((remaining as number), displayCurrency)} budget
                            </span>
                        </>
                    ) : (
                        <span>
                            {pctOfRemaining}% of remaining {formatCurrency((remaining as number), displayCurrency)}
                        </span>
                    )}
                </div>
            )}

            <div className="space-y-2">
                {visible.map(it => {
                    const cat = (it.category || 'uncategorized').toLowerCase();
                    const color = CATEGORY_COLORS[cat] || CATEGORY_COLORS.uncategorized;
                    const txCurr = (it.currency || 'USD').toUpperCase();
                    return (
                        <div key={it.id} className="flex items-center gap-3">
                            <div
                                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                                style={{ backgroundColor: `${color}20`, color }}
                            >
                                {getIconForCategory(it.category, 'w-4 h-4')}
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold truncate">{it.description}</p>
                                <p className="text-[11px] text-muted-foreground font-medium">
                                    {dueLabel(it.daysUntil)}
                                </p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-sm font-bold whitespace-nowrap">
                                    {formatCurrency(it.amount, txCurr as Currency)}
                                </p>
                            </div>
                        </div>
                    );
                })}
                {overflow > 0 && (
                    <p className="text-[11px] text-muted-foreground font-medium pt-1 text-center">
                        +{overflow} more this month
                    </p>
                )}
            </div>
        </motion.div>
    );
});
UpcomingRecurringCard.displayName = 'UpcomingRecurringCard';
