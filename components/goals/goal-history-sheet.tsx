'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { format, parseISO, startOfMonth, subMonths } from 'date-fns';
import { Trash2, TrendingUp, Coins, ListChecks } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { resolveGoalIcon, resolveGoalColor } from '@/lib/goal-styles';
import { monthlyVelocity } from '@/lib/goal-utils';
import { GoalService } from '@/lib/services/goal-service';
import type { SavingsGoal, SavingsDeposit } from '@/types/goal';

type Props = {
    goal: SavingsGoal | null;
    userId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    formatCurrency: (amount: number, currencyOverride?: string) => string;
    onChanged?: () => void;
};

export function GoalHistorySheet({ goal, userId, open, onOpenChange, formatCurrency, onChanged }: Props) {
    const [deposits, setDeposits] = useState<SavingsDeposit[]>([]);
    const [loading, setLoading] = useState(false);
    const [removingId, setRemovingId] = useState<string | null>(null);

    const tokens = resolveGoalColor(goal?.color);
    const Icon = resolveGoalIcon(goal?.icon);

    useEffect(() => {
        if (!open || !goal || !userId) return;
        let cancelled = false;
        setLoading(true);
        GoalService.getAllDepositsForGoal(userId, goal.id)
            .then(d => { if (!cancelled) setDeposits(d); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [open, goal, userId]);

    const stats = useMemo(() => {
        const total = deposits.reduce((acc, d) => acc + Number(d.amount), 0);
        const velocity = monthlyVelocity(deposits, 90);
        return { total, count: deposits.length, velocity };
    }, [deposits]);

    const monthlyChartData = useMemo(() => {
        const months: { key: string; label: string; total: number }[] = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = startOfMonth(subMonths(now, i));
            months.push({ key: format(d, 'yyyy-MM'), label: format(d, 'MMM'), total: 0 });
        }
        const lookup = new Map(months.map(m => [m.key, m]));
        for (const dep of deposits) {
            const key = format(parseISO(dep.created_at), 'yyyy-MM');
            const bucket = lookup.get(key);
            if (bucket) bucket.total += Number(dep.amount);
        }
        return months;
    }, [deposits]);

    const handleRemove = async (deposit: SavingsDeposit) => {
        if (!userId) return;
        setRemovingId(deposit.id);
        try {
            await GoalService.removeDeposit(userId, deposit.id);
            setDeposits(prev => prev.filter(d => d.id !== deposit.id));
            onChanged?.();
        } catch {
            // toast handled in service
        } finally {
            setRemovingId(null);
        }
    };

    if (!goal) return null;

    const hasChartData = monthlyChartData.some(m => m.total > 0);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md rounded-3xl border-white/10 bg-card/95 backdrop-blur-xl p-5 max-h-[85vh] flex flex-col">
                <DialogHeader className="gap-1">
                    <DialogTitle className="flex items-center gap-2">
                        <span className={cn('w-8 h-8 rounded-xl border flex items-center justify-center', tokens.bg, tokens.border)}>
                            <Icon className={cn('w-4 h-4', tokens.text)} aria-hidden="true" />
                        </span>
                        <span className="truncate">{goal.name}</span>
                    </DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-3 gap-2 pt-3">
                    <StatTile
                        icon={<Coins className={cn('w-3.5 h-3.5', tokens.text)} />}
                        label="Total"
                        value={formatCurrency(stats.total, goal.currency)}
                    />
                    <StatTile
                        icon={<ListChecks className={cn('w-3.5 h-3.5', tokens.text)} />}
                        label="Deposits"
                        value={`${stats.count}`}
                    />
                    <StatTile
                        icon={<TrendingUp className={cn('w-3.5 h-3.5', tokens.text)} />}
                        label="Per month"
                        value={stats.velocity > 0 ? formatCurrency(stats.velocity, goal.currency) : '—'}
                    />
                </div>

                {hasChartData && (
                    <div className="mt-3 rounded-2xl bg-secondary/10 border border-white/5 p-3">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Last 6 months</p>
                        <div className="h-20">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={monthlyChartData} margin={{ top: 4, bottom: 0, left: 0, right: 0 }}>
                                    <Tooltip
                                        cursor={{ stroke: 'rgba(255,255,255,0.1)' }}
                                        contentStyle={{
                                            background: 'rgba(20,20,30,0.95)',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: 12,
                                            fontSize: 11,
                                        }}
                                        labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
                                        formatter={(v: number) => formatCurrency(v, goal.currency)}
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="total"
                                        stroke="currentColor"
                                        className={tokens.text}
                                        strokeWidth={2}
                                        dot={{ r: 2, className: tokens.text }}
                                        activeDot={{ r: 4 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                            {monthlyChartData.map(m => <span key={m.key}>{m.label}</span>)}
                        </div>
                    </div>
                )}

                <div className="mt-3 flex-1 min-h-0 overflow-y-auto -mx-1 px-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2 px-1">Contributions</p>
                    {loading ? (
                        <div className="space-y-2">
                            <div className="h-10 rounded-xl bg-secondary/10 animate-pulse" />
                            <div className="h-10 rounded-xl bg-secondary/10 animate-pulse" />
                        </div>
                    ) : deposits.length === 0 ? (
                        <div className="text-center py-8 text-xs text-muted-foreground">
                            No deposits yet — add your first contribution.
                        </div>
                    ) : (
                        <ul className="space-y-1.5">
                            {deposits.map(dep => (
                                <li
                                    key={dep.id}
                                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-secondary/10 border border-white/5"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className={cn('text-sm font-bold', tokens.text)}>
                                            {formatCurrency(Number(dep.amount), dep.currency)}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">
                                            {format(parseISO(dep.created_at), 'MMM d, yyyy · h:mm a')}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleRemove(dep)}
                                        disabled={removingId === dep.id}
                                        aria-label="Delete deposit"
                                        className="shrink-0 w-8 h-8 rounded-full bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 flex items-center justify-center transition-colors disabled:opacity-50"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="rounded-2xl bg-secondary/10 border border-white/5 p-2.5">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                {icon}
                <span className="truncate">{label}</span>
            </div>
            <p className="text-sm font-bold mt-0.5 truncate">{value}</p>
        </div>
    );
}
