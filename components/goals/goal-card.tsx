'use client';

import React from 'react';
import { format } from 'date-fns';
import { Calendar, CheckCircle2, MoreVertical, Plus, Edit2, Trash2, History, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
    daysUntilDeadline, requiredMonthlyContribution, monthlyVelocity,
    projectedCompletionDate, onTrackStatus,
} from '@/lib/goal-utils';
import { resolveGoalIcon, resolveGoalColor } from '@/lib/goal-styles';
import type { SavingsGoal, SavingsDeposit } from '@/types/goal';

type FormatFn = (amount: number, currencyOverride?: string) => string;

type Props = {
    goal: SavingsGoal;
    deposits: SavingsDeposit[];
    formatCurrency: FormatFn;
    onAddDeposit: (goal: SavingsGoal) => void;
    onEdit: (goal: SavingsGoal) => void;
    onDelete: (goal: SavingsGoal) => void;
    onOpenHistory: (goal: SavingsGoal) => void;
};

const MILESTONE_TICKS = [25, 50, 75];

export function GoalCard({ goal, deposits, formatCurrency, onAddDeposit, onEdit, onDelete, onOpenHistory }: Props) {
    const tokens = resolveGoalColor(goal.color);
    const Icon = resolveGoalIcon(goal.icon);

    const currentAmount = Number(goal.current_amount);
    const targetAmount = Number(goal.target_amount);
    const progress = targetAmount > 0 ? Math.min((currentAmount / targetAmount) * 100, 100) : 0;
    const isCompleted = currentAmount >= targetAmount;

    const daysLeft = daysUntilDeadline(goal.deadline);
    const required = requiredMonthlyContribution(goal);
    const velocity = monthlyVelocity(deposits, 90);
    const status = onTrackStatus(required, velocity, deposits.length > 0);
    const projected = projectedCompletionDate(goal, velocity);

    const remaining = Math.max(0, targetAmount - currentAmount);

    const deadlinePill = (() => {
        if (!goal.deadline || daysLeft === null) return null;
        if (isCompleted) return null;
        if (daysLeft < 0) return { label: `Overdue ${Math.abs(daysLeft)}d`, className: 'bg-rose-500/15 border-rose-500/30 text-rose-300' };
        if (daysLeft === 0) return { label: 'Due today', className: 'bg-amber-500/15 border-amber-500/30 text-amber-300' };
        if (daysLeft <= 30) return { label: `${daysLeft}d left`, className: 'bg-amber-500/15 border-amber-500/30 text-amber-300' };
        return { label: `${daysLeft}d left`, className: 'bg-secondary/30 border-white/10 text-muted-foreground' };
    })();

    const statusPill = (() => {
        if (isCompleted) return null;
        if (status === 'unknown') return null;
        if (status === 'ahead') return { label: 'Ahead', icon: TrendingUp, className: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300' };
        if (status === 'on-track') return { label: 'On track', icon: Minus, className: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300' };
        return { label: 'Behind', icon: TrendingDown, className: 'bg-rose-500/15 border-rose-500/30 text-rose-300' };
    })();

    const StatusIcon = statusPill?.icon;

    const stopBubble = (e: React.MouseEvent) => e.stopPropagation();

    return (
        <Card
            onClick={() => onOpenHistory(goal)}
            className={cn(
                'border-white/5 backdrop-blur-xl relative overflow-hidden group transition-all cursor-pointer',
                'hover:bg-card/60 hover:border-white/10 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20',
                isCompleted ? `${tokens.border} ${tokens.bgLight}` : 'bg-card/40'
            )}
        >
            <span
                aria-hidden="true"
                className={cn(
                    'pointer-events-none absolute -top-12 -right-12 w-40 h-40 rounded-full blur-3xl opacity-20 transition-opacity group-hover:opacity-30',
                    tokens.swatch
                )}
            />
            {isCompleted && (
                <div className={cn(
                    'absolute top-3 left-1/2 -translate-x-1/2 text-white text-[10px] uppercase tracking-wider font-bold px-3 py-1 rounded-full flex items-center gap-1 z-10 shadow-lg',
                    tokens.swatch
                )}>
                    <CheckCircle2 className="w-3 h-3" />
                    Goal Achieved
                </div>
            )}
            <CardContent className="p-5">
                <div className="flex justify-between items-start mb-4 relative z-20">
                    <div className="flex items-start gap-3 min-w-0 flex-1 pr-2">
                        <div className={cn(
                            'shrink-0 w-10 h-10 rounded-xl border flex items-center justify-center mt-0.5',
                            tokens.bg, tokens.border
                        )}>
                            <Icon className={cn('w-5 h-5', tokens.text)} aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="text-lg font-bold truncate">{goal.name}</h3>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                {goal.deadline && (
                                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                        <Calendar className="w-3 h-3" aria-hidden="true" />
                                        {format(new Date(goal.deadline), 'MMM d, yyyy')}
                                    </span>
                                )}
                                {deadlinePill && (
                                    <span className={cn(
                                        'text-[10px] px-1.5 py-0.5 rounded-full border font-bold',
                                        deadlinePill.className
                                    )}>
                                        {deadlinePill.label}
                                    </span>
                                )}
                                {statusPill && StatusIcon && (
                                    <span className={cn(
                                        'text-[10px] px-1.5 py-0.5 rounded-full border font-bold inline-flex items-center gap-1',
                                        statusPill.className
                                    )}>
                                        <StatusIcon className="w-2.5 h-2.5" aria-hidden="true" />
                                        {statusPill.label}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2" onClick={stopBubble}>
                        <button
                            onClick={(e) => { e.stopPropagation(); onAddDeposit(goal); }}
                            aria-label={`Add deposit to ${goal.name}`}
                            className={cn(
                                'shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors border',
                                tokens.bgLight, tokens.border, tokens.text, 'hover:opacity-80'
                            )}
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    aria-label="Goal actions"
                                    onClick={stopBubble}
                                    className="shrink-0 w-8 h-8 rounded-full bg-secondary/30 hover:bg-secondary/50 flex items-center justify-center transition-colors"
                                >
                                    <MoreVertical className="w-4 h-4" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44 rounded-2xl bg-card/95 backdrop-blur-xl border-white/10">
                                <DropdownMenuItem onClick={() => onOpenHistory(goal)} className="gap-2 cursor-pointer">
                                    <History className="w-4 h-4" /> View History
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onEdit(goal)} className="gap-2 cursor-pointer">
                                    <Edit2 className="w-4 h-4" /> Edit Goal
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDelete(goal)} className="gap-2 cursor-pointer text-rose-400 focus:text-rose-400 focus:bg-rose-500/10">
                                    <Trash2 className="w-4 h-4" /> Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between text-sm font-medium">
                        <span className={tokens.text}>{formatCurrency(currentAmount, goal.currency)}</span>
                        <span className="text-muted-foreground">of {formatCurrency(targetAmount, goal.currency)}</span>
                    </div>
                    <div className="relative">
                        <Progress
                            value={progress}
                            className="h-2.5 bg-black/30"
                            indicatorClassName={tokens.indicator}
                        />
                        {!isCompleted && MILESTONE_TICKS.map(t => (
                            <span
                                key={t}
                                aria-hidden="true"
                                className="absolute top-0 bottom-0 w-px bg-white/30"
                                style={{ left: `${t}%` }}
                            />
                        ))}
                    </div>
                    <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">{progress.toFixed(1)}% funded</span>
                        <span className={cn('font-bold', tokens.text)}>
                            {isCompleted ? 'Goal Reached! 🎉' : `${formatCurrency(remaining, goal.currency)} to go`}
                        </span>
                    </div>
                    {!isCompleted && (required !== null || velocity > 0) && (
                        <div className="flex justify-between text-[11px] text-muted-foreground pt-1 border-t border-white/5 mt-1">
                            {required !== null && required > 0 ? (
                                <span>
                                    Need <span className="text-foreground font-bold">{formatCurrency(required, goal.currency)}</span>/mo
                                </span>
                            ) : projected ? (
                                <span>
                                    Est. <span className="text-foreground font-bold">{format(projected, 'MMM yyyy')}</span>
                                </span>
                            ) : <span />}
                            {velocity > 0 && (
                                <span>
                                    Saving <span className="text-foreground font-bold">{formatCurrency(velocity, goal.currency)}</span>/mo
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
