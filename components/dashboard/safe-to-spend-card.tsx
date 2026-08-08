'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Wallet, AlertTriangle, CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Currency } from '@/components/providers/user-preferences-provider';
import type { SafeToSpendOutput } from '@/lib/utils/run-rate';

interface SafeToSpendCardProps {
    safeToSpend: SafeToSpendOutput;
    formatCurrency: (val: number, cur: Currency) => string;
    bucketCurrency: Currency;
    isCoupleWorkspace: boolean;
    isHomeWorkspace: boolean;
}

export const SafeToSpendCard = React.memo(function SafeToSpendCard({
    safeToSpend,
    formatCurrency,
    bucketCurrency,
    isCoupleWorkspace,
    isHomeWorkspace,
}: SafeToSpendCardProps) {
    const { dailyAllowance, daysRemaining, committedUpcoming, billsExceedBudget, afterCommitments } = safeToSpend;

    // afterCommitments < 0 has two distinct causes: the budget was already
    // overspent on actual transactions (remaining <= 0), or upcoming bills tip
    // an otherwise-positive remaining into the red. Only the latter is about bills.
    const remaining = afterCommitments + committedUpcoming;
    const overspentAlready = remaining < 0;

    const accent = isCoupleWorkspace ? 'rose' : isHomeWorkspace ? 'amber' : 'primary';
    const ringClass = billsExceedBudget
        ? 'bg-rose-500/10 border-rose-500/20'
        : accent === 'rose'
            ? 'bg-rose-500/10 border-rose-500/20'
            : accent === 'amber'
                ? 'bg-amber-500/10 border-amber-500/20'
                : 'bg-emerald-500/10 border-emerald-500/20';
    const iconClass = billsExceedBudget
        ? 'text-rose-400'
        : accent === 'rose'
            ? 'text-rose-400'
            : accent === 'amber'
                ? 'text-amber-500'
                : 'text-emerald-400';
    const glowClass = billsExceedBudget
        ? 'bg-rose-500'
        : accent === 'rose'
            ? 'bg-rose-500'
            : accent === 'amber'
                ? 'bg-amber-500'
                : 'bg-emerald-500';

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            // Matches its three siblings on this screen (cashflow-forecast,
            // weekday-spending, upcoming-recurring): rounded-3xl + bg-card/40 +
            // backdrop-blur-md. It used to be the only card in the column at 16px
            // with no blur, which read as a different component family.
            className={cn('p-4 rounded-3xl border bg-card/40 backdrop-blur-md relative overflow-hidden', ringClass)}
        >
            <div className={cn('absolute top-0 right-0 w-24 h-24 rounded-full blur-[40px] opacity-20', glowClass)} />

            <div className="relative z-10">
                <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                        {billsExceedBudget ? (
                            <AlertTriangle className={cn('w-4 h-4', iconClass)} />
                        ) : (
                            <Wallet className={cn('w-4 h-4', iconClass)} />
                        )}
                        <h3 className="text-sm font-bold">Safe to spend</h3>
                    </div>
                    <span className="text-meta font-bold text-muted-foreground bg-secondary/30 px-2 py-0.5 rounded-full whitespace-nowrap tabular-nums">
                        {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left
                    </span>
                </div>

                {billsExceedBudget ? (
                    <>
                        <p className="text-2xl font-bold tabular-nums tracking-tight text-rose-300">
                            {formatCurrency(0, bucketCurrency)}<span className="text-base font-semibold text-rose-300/70">/day</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">
                            {overspentAlready ? (
                                <>
                                    You&apos;re over budget by{' '}
                                    <span className="text-rose-300 font-bold">{formatCurrency(Math.abs(remaining), bucketCurrency)}</span> this month.
                                </>
                            ) : (
                                <>
                                    Upcoming bills exceed your remaining budget by{' '}
                                    <span className="text-rose-300 font-bold">{formatCurrency(Math.abs(afterCommitments), bucketCurrency)}</span>.
                                </>
                            )}
                        </p>
                    </>
                ) : (
                    <>
                        <p className="text-2xl font-bold tabular-nums tracking-tight">
                            {formatCurrency(dailyAllowance, bucketCurrency)}<span className="text-base font-semibold text-muted-foreground">/day</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">
                            For the next {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}
                            {committedUpcoming > 0 && (
                                <>
                                    , after setting aside{' '}
                                    <span className="inline-flex items-center gap-1 text-foreground font-bold">
                                        <CalendarClock className="w-3 h-3" aria-hidden="true" />
                                        {formatCurrency(committedUpcoming, bucketCurrency)}
                                    </span>{' '}
                                    in upcoming bills
                                </>
                            )}
                            .
                        </p>
                    </>
                )}
            </div>
        </motion.div>
    );
});
SafeToSpendCard.displayName = 'SafeToSpendCard';
