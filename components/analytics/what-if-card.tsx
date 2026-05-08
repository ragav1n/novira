'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Sparkles, ChevronDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { CATEGORY_COLORS, getCategoryLabel, getIconForCategory } from '@/lib/categories';
import { supabase } from '@/lib/supabase';
import type { Transaction } from '@/types/transaction';
import type { SavingsGoal } from '@/types/goal';

interface Props {
    transactions: Transaction[];
    userId: string | null;
    currency: string;
    convertAmount: (amount: number, fromCurrency: string, toCurrency?: string) => number;
    formatCurrency: (amount: number, currencyCode?: string) => string;
}

export function WhatIfCard({
    transactions,
    userId,
    currency,
    convertAmount,
    formatCurrency,
}: Props) {
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [cutPct, setCutPct] = useState<number>(20);
    const [open, setOpen] = useState(false);
    const [goals, setGoals] = useState<SavingsGoal[]>([]);

    useEffect(() => {
        if (!userId) {
            setGoals([]);
            return;
        }
        let cancelled = false;
        (async () => {
            const { data } = await supabase
                .from('savings_goals')
                .select('id, user_id, name, target_amount, current_amount, currency, deadline, icon, color, group_id, created_at')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(20);
            if (!cancelled && data) setGoals(data as SavingsGoal[]);
        })();
        return () => { cancelled = true; };
    }, [userId]);

    const categoryTotals = useMemo(() => {
        const map = new Map<string, number>();
        if (!transactions.length) return map;
        const now = new Date();
        const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
        const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

        let monthlyTxs = transactions.filter((t) => t.date >= startMonth && t.date <= endMonth);
        if (monthlyTxs.length === 0) {
            const sixtyAgo = new Date();
            sixtyAgo.setDate(sixtyAgo.getDate() - 60);
            const sixtyAgoStr = sixtyAgo.toISOString().slice(0, 10);
            monthlyTxs = transactions.filter((t) => t.date >= sixtyAgoStr);
        }

        for (const tx of monthlyTxs) {
            if (tx.exclude_from_allowance) continue;
            if (tx.is_income) continue;
            if (tx.is_settlement) continue;
            const txCurr = (tx.currency || 'USD').toUpperCase();
            const amt = txCurr === currency.toUpperCase()
                ? Number(tx.amount)
                : convertAmount(Number(tx.amount), txCurr, currency);
            const cat = (tx.category || 'others').toLowerCase();
            map.set(cat, (map.get(cat) ?? 0) + amt);
        }

        return map;
    }, [transactions, currency, convertAmount]);

    const sortedCategories = useMemo(() => {
        return [...categoryTotals.entries()]
            .filter(([, v]) => v > 0)
            .sort((a, b) => b[1] - a[1]);
    }, [categoryTotals]);

    useEffect(() => {
        if (!selectedCategory && sortedCategories.length > 0) {
            setSelectedCategory(sortedCategories[0][0]);
        }
    }, [sortedCategories, selectedCategory]);

    const monthlyForCategory = selectedCategory ? (categoryTotals.get(selectedCategory) ?? 0) : 0;
    const monthlySavings = monthlyForCategory * (cutPct / 100);
    const annualSavings = monthlySavings * 12;
    const sixMonthSavings = monthlySavings * 6;

    const goalImpact = useMemo(() => {
        if (monthlySavings <= 0 || goals.length === 0) return null;
        const inProgress = goals
            .filter((g) => g.target_amount > g.current_amount)
            .map((g) => {
                const remaining = g.target_amount - g.current_amount;
                const goalCurr = (g.currency || currency).toUpperCase();
                const monthlyInTarget = goalCurr === currency.toUpperCase()
                    ? monthlySavings
                    : convertAmount(monthlySavings, currency, goalCurr);
                const months = monthlyInTarget > 0 ? remaining / monthlyInTarget : Infinity;
                return { goal: g, months };
            })
            .filter((x) => isFinite(x.months))
            .sort((a, b) => a.months - b.months);
        return inProgress.slice(0, 2);
    }, [monthlySavings, goals, currency, convertAmount]);

    if (sortedCategories.length === 0) return null;

    return (
        <Card className="bg-gradient-to-br from-violet-500/10 to-cyan-500/5 border-violet-500/20 backdrop-blur-md">
            <CardContent className="p-4 space-y-3">
                <button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    className="w-full flex items-center gap-2 text-left"
                    aria-expanded={open}
                >
                    <Sparkles className="w-4 h-4 text-violet-400" aria-hidden="true" />
                    <h3 className="text-sm font-semibold flex-1">What if you cut a category?</h3>
                    <ChevronDown
                        className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                    />
                </button>

                {!open && (
                    <p className="text-[11px] text-muted-foreground">
                        Simulate the impact of trimming a category on your savings and goals.
                    </p>
                )}

                {open && (
                    <div className="space-y-4 pt-1">
                        <div className="space-y-2">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                Category
                            </label>
                            <Select
                                value={selectedCategory ?? ''}
                                onValueChange={(v) => setSelectedCategory(v)}
                            >
                                <SelectTrigger className="bg-card/40 border-white/10 h-10">
                                    <SelectValue placeholder="Pick a category" />
                                </SelectTrigger>
                                <SelectContent>
                                    {sortedCategories.map(([cat, amt]) => (
                                        <SelectItem key={cat} value={cat}>
                                            <span className="flex items-center gap-2">
                                                <span
                                                    className="w-3 h-3 inline-flex items-center justify-center"
                                                    style={{ color: CATEGORY_COLORS[cat] || CATEGORY_COLORS.others }}
                                                >
                                                    {getIconForCategory(cat, 'w-3 h-3')}
                                                </span>
                                                <span className="capitalize">{getCategoryLabel(cat)}</span>
                                                <span className="text-muted-foreground text-xs">
                                                    {formatCurrency(amt)}/mo
                                                </span>
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Reduce by
                                </label>
                                <span className="text-sm font-bold text-violet-300">{cutPct}%</span>
                            </div>
                            <Slider
                                value={[cutPct]}
                                onValueChange={(v) => setCutPct(v[0])}
                                min={0}
                                max={100}
                                step={5}
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-1">
                            <div className="rounded-xl bg-card/40 border border-white/5 p-3 text-center">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                                    Per month
                                </p>
                                <p className="text-sm font-bold text-violet-300 mt-1">
                                    {formatCurrency(monthlySavings)}
                                </p>
                            </div>
                            <div className="rounded-xl bg-card/40 border border-white/5 p-3 text-center">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                                    6 months
                                </p>
                                <p className="text-sm font-bold text-violet-300 mt-1">
                                    {formatCurrency(sixMonthSavings)}
                                </p>
                            </div>
                            <div className="rounded-xl bg-card/40 border border-white/5 p-3 text-center">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                                    Per year
                                </p>
                                <p className="text-sm font-bold text-violet-300 mt-1">
                                    {formatCurrency(annualSavings)}
                                </p>
                            </div>
                        </div>

                        {monthlySavings > 0 && goalImpact && goalImpact.length > 0 && (
                            <div className="space-y-2 pt-1">
                                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                                    Goal impact
                                </p>
                                {goalImpact.map(({ goal, months }) => (
                                    <div
                                        key={goal.id}
                                        className="flex items-center gap-3 rounded-xl bg-card/40 border border-white/5 p-3"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold truncate">{goal.name}</p>
                                            <p className="text-[11px] text-muted-foreground">
                                                Reach in {months < 1 ? '<1' : Math.ceil(months)} {months < 1 || Math.ceil(months) === 1 ? 'month' : 'months'} at this rate
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {monthlySavings <= 0 && (
                            <p className="text-[11px] text-muted-foreground text-center">
                                Pick a category with spending and slide the cut to see the impact.
                            </p>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
