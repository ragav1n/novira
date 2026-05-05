'use client';

import { motion, AnimatePresence } from 'framer-motion';

import React, { useCallback, useEffect, useMemo, useState, useDeferredValue } from 'react';
import { useUserPreferences, CURRENCY_SYMBOLS, type Currency } from '@/components/providers/user-preferences-provider';
import { useWorkspaceTheme } from '@/hooks/useWorkspaceTheme';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import {
    Target, Plus, ArrowLeft, Calendar, PiggyBank, Search, X, ArrowUpDown, Check,
    ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { toast } from '@/utils/haptics';
import { CurrencyDropdown } from '@/components/ui/currency-dropdown';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { GoalService } from '@/lib/services/goal-service';
import {
    daysUntilDeadline, currentMilestone,
} from '@/lib/goal-utils';
import type { SavingsGoal, SavingsDeposit, GoalIcon, GoalColor } from '@/types/goal';
import { GoalCard } from '@/components/goals/goal-card';
import { GoalHistorySheet } from '@/components/goals/goal-history-sheet';
import { IconColorPicker } from '@/components/goals/icon-color-picker';
import { resolveGoalColor, resolveGoalIcon } from '@/lib/goal-styles';

type SortBy = 'deadline' | 'progress' | 'remaining' | 'name' | 'recent';
type FilterKey = 'all' | 'in-progress' | 'due-soon' | 'overdue';

const SORT_LABELS: Record<SortBy, string> = {
    deadline: 'Deadline (soonest)',
    progress: 'Progress (highest)',
    remaining: 'Amount remaining',
    name: 'Name (A → Z)',
    recent: 'Recently created',
};

const FILTER_LABELS: Record<FilterKey, string> = {
    'all': 'All',
    'in-progress': 'In progress',
    'due-soon': 'Due soon',
    'overdue': 'Overdue',
};

export function GoalsView() {
    const { userId, formatCurrency, currency, activeWorkspaceId, convertAmount } = useUserPreferences();
    const router = useRouter();
    const { theme: themeConfig } = useWorkspaceTheme('emerald');

    const [goals, setGoals] = useState<SavingsGoal[]>([]);
    const [deposits, setDeposits] = useState<SavingsDeposit[]>([]);
    const [loading, setLoading] = useState(true);

    const [search, setSearch] = useState('');
    const deferredSearch = useDeferredValue(search);
    const [sortBy, setSortBy] = useState<SortBy>('deadline');
    const [filterKey, setFilterKey] = useState<FilterKey>('all');
    const [showAchieved, setShowAchieved] = useState(false);

    const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
    const [goalModalMode, setGoalModalMode] = useState<'add'|'edit'>('add');
    const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
    const [goalName, setGoalName] = useState('');
    const [goalTarget, setGoalTarget] = useState('');
    const [goalCurrency, setGoalCurrency] = useState<Currency>(currency);
    const [goalDeadline, setGoalDeadline] = useState<Date | undefined>(undefined);
    const [goalIcon, setGoalIcon] = useState<GoalIcon>('target');
    const [goalColor, setGoalColor] = useState<GoalColor>('emerald');

    const [isAddDepositOpen, setIsAddDepositOpen] = useState(false);
    const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
    const [depositAmount, setDepositAmount] = useState('');
    const [goalPendingDelete, setGoalPendingDelete] = useState<SavingsGoal | null>(null);

    const [historyGoal, setHistoryGoal] = useState<SavingsGoal | null>(null);
    const [historyOpen, setHistoryOpen] = useState(false);

    const loadGoals = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        let query = supabase
            .from('savings_goals')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(200);

        if (activeWorkspaceId && activeWorkspaceId !== 'personal') {
            query = query.eq('group_id', activeWorkspaceId);
        } else if (activeWorkspaceId === 'personal') {
            query = query.is('group_id', null);
        }

        const { data, error } = await query;

        if (!error && data) {
            setGoals(data as SavingsGoal[]);
        }
        setLoading(false);
    }, [userId, activeWorkspaceId]);

    useEffect(() => {
        loadGoals();
    }, [loadGoals]);

    // Batch-fetch the last 90 days of deposits for all goals once whenever the
    // goal set changes — avoids N+1 per-card queries while still giving each
    // card enough history to compute monthly velocity.
    useEffect(() => {
        if (!userId || goals.length === 0) {
            setDeposits([]);
            return;
        }
        let cancelled = false;
        GoalService.getDepositsForGoals(userId, goals.map(g => g.id), 90)
            .then(d => { if (!cancelled) setDeposits(d); });
        return () => { cancelled = true; };
    }, [userId, goals]);

    useEffect(() => {
        if (!userId) return;

        const goalsChannel = supabase
            .channel(`goals-changes-${userId}-${activeWorkspaceId || 'personal'}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'savings_goals', filter: `user_id=eq.${userId}` },
                () => { loadGoals(); }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'savings_deposits', filter: `user_id=eq.${userId}` },
                () => { loadGoals(); }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(goalsChannel);
        };
    }, [userId, activeWorkspaceId, loadGoals]);

    const depositsByGoal = useMemo(() => {
        const map = new Map<string, SavingsDeposit[]>();
        for (const d of deposits) {
            const arr = map.get(d.goal_id) ?? [];
            arr.push(d);
            map.set(d.goal_id, arr);
        }
        return map;
    }, [deposits]);

    const lastDepositByGoal = useMemo(() => {
        const map = new Map<string, number>();
        for (const d of deposits) {
            if (!map.has(d.goal_id)) map.set(d.goal_id, Number(d.amount));
        }
        return map;
    }, [deposits]);

    const openAddModal = () => {
        setGoalModalMode('add');
        setEditingGoalId(null);
        setGoalName('');
        setGoalTarget('');
        setGoalCurrency(currency);
        setGoalDeadline(undefined);
        setGoalIcon('target');
        setGoalColor('emerald');
        setIsGoalModalOpen(true);
    };

    const openEditModal = (goal: SavingsGoal) => {
        setGoalModalMode('edit');
        setEditingGoalId(goal.id);
        setGoalName(goal.name);
        setGoalTarget(goal.target_amount.toString());
        setGoalCurrency(goal.currency as Currency);
        setGoalDeadline(goal.deadline ? parseISO(goal.deadline) : undefined);
        setGoalIcon((goal.icon as GoalIcon) || 'target');
        setGoalColor((goal.color as GoalColor) || 'emerald');
        setIsGoalModalOpen(true);
    };

    const handleSaveGoal = async () => {
        if (!goalName || !goalTarget || !userId) return;
        if (isNaN(parseFloat(goalTarget)) || parseFloat(goalTarget) <= 0) return;

        if (goalModalMode === 'add') {
            const { error } = await supabase
                .from('savings_goals')
                .insert({
                    user_id: userId,
                    name: goalName,
                    target_amount: parseFloat(goalTarget),
                    currency: goalCurrency,
                    deadline: goalDeadline ? format(goalDeadline, 'yyyy-MM-dd') : null,
                    icon: goalIcon,
                    color: goalColor,
                    group_id: activeWorkspaceId && activeWorkspaceId !== 'personal' ? activeWorkspaceId : null,
                });

            if (error) {
                toast.error('Failed to create goal');
                console.error(error);
            } else {
                toast.success('Goal created successfully!');
                setIsGoalModalOpen(false);
                loadGoals();
            }
        } else if (goalModalMode === 'edit' && editingGoalId) {
            const { error } = await supabase
                .from('savings_goals')
                .update({
                    name: goalName,
                    target_amount: parseFloat(goalTarget),
                    currency: goalCurrency,
                    deadline: goalDeadline ? format(goalDeadline, 'yyyy-MM-dd') : null,
                    icon: goalIcon,
                    color: goalColor,
                })
                .eq('id', editingGoalId);

            if (error) {
                toast.error('Failed to update goal');
                console.error(error);
            } else {
                toast.success('Goal updated successfully!');
                setIsGoalModalOpen(false);
                loadGoals();
            }
        }
    };

    const handleDeleteGoal = async (id: string) => {
        setGoals(prev => prev.filter(g => g.id !== id));

        const { error } = await supabase
            .from('savings_goals')
            .delete()
            .eq('id', id);

        if (error) {
            toast.error('Failed to delete goal');
            loadGoals();
        } else {
            toast.success('Goal deleted');
        }
    };

    const handleAddDeposit = async () => {
        if (!selectedGoalId || !depositAmount || !userId) return;

        const amount = parseFloat(depositAmount);
        if (isNaN(amount) || amount <= 0) return;
        const goal = goals.find(g => g.id === selectedGoalId);
        if (!goal) return;

        const previousAmount = Number(goal.current_amount);
        const newAmount = previousAmount + amount;
        const target = Number(goal.target_amount);
        const prevPct = target > 0 ? (previousAmount / target) * 100 : 0;
        const newPct = target > 0 ? (newAmount / target) * 100 : 0;
        const prevMilestone = currentMilestone(prevPct);
        const newMilestone = currentMilestone(newPct);
        const lastNotified = goal.last_threshold_notified ?? 0;

        setGoals(prev => prev.map(g => g.id === selectedGoalId
            ? { ...g, current_amount: newAmount }
            : g
        ));
        setIsAddDepositOpen(false);
        setDepositAmount('');
        setSelectedGoalId(null);

        const { data, error: rpcError } = await supabase.rpc('add_savings_deposit_atomic', {
            p_goal_id: selectedGoalId,
            p_user_id: userId,
            p_amount: amount,
            p_currency: goal.currency
        });

        if (rpcError || (data && !data.success)) {
            setGoals(prev => prev.map(g => g.id === selectedGoalId
                ? { ...g, current_amount: previousAmount }
                : g
            ));
            toast.error('Failed to add deposit: ' + (rpcError?.message || data?.error));
            return;
        }

        toast.success('Deposit added successfully!');

        // Milestone celebration: fire once per threshold per goal lifetime.
        if (newMilestone > prevMilestone && newMilestone > lastNotified) {
            const message = newMilestone === 100
                ? `🎉 ${goal.name} fully funded!`
                : `🎉 ${newMilestone}% there on ${goal.name}!`;
            toast.success(message);
            await supabase
                .from('savings_goals')
                .update({ last_threshold_notified: newMilestone })
                .eq('id', selectedGoalId);
        }

        loadGoals();
    };

    const totalSaved = useMemo(() => {
        return goals.reduce((acc, goal) => {
            const amountInBase = convertAmount(Number(goal.current_amount), goal.currency, currency);
            return acc + amountInBase;
        }, 0);
    }, [goals, convertAmount, currency]);

    const filteredSortedGoals = useMemo(() => {
        const q = deferredSearch.trim().toLowerCase();
        let list = goals.slice();
        if (q) list = list.filter(g => g.name.toLowerCase().includes(q));

        if (filterKey === 'in-progress') {
            list = list.filter(g => Number(g.current_amount) < Number(g.target_amount));
        } else if (filterKey === 'due-soon') {
            list = list.filter(g => {
                if (Number(g.current_amount) >= Number(g.target_amount)) return false;
                const days = daysUntilDeadline(g.deadline);
                return days !== null && days >= 0 && days <= 30;
            });
        } else if (filterKey === 'overdue') {
            list = list.filter(g => {
                if (Number(g.current_amount) >= Number(g.target_amount)) return false;
                const days = daysUntilDeadline(g.deadline);
                return days !== null && days < 0;
            });
        }

        return list.sort((a, b) => {
            switch (sortBy) {
                case 'progress': {
                    const ap = Number(a.target_amount) > 0 ? Number(a.current_amount) / Number(a.target_amount) : 0;
                    const bp = Number(b.target_amount) > 0 ? Number(b.current_amount) / Number(b.target_amount) : 0;
                    return bp - ap;
                }
                case 'remaining': {
                    const ar = Math.max(0, Number(a.target_amount) - Number(a.current_amount));
                    const br = Math.max(0, Number(b.target_amount) - Number(b.current_amount));
                    return br - ar;
                }
                case 'name':
                    return a.name.localeCompare(b.name);
                case 'recent':
                    return (b.created_at || '').localeCompare(a.created_at || '');
                case 'deadline':
                default: {
                    const ad = a.deadline ? parseISO(a.deadline).getTime() : Number.POSITIVE_INFINITY;
                    const bd = b.deadline ? parseISO(b.deadline).getTime() : Number.POSITIVE_INFINITY;
                    return ad - bd;
                }
            }
        });
    }, [goals, deferredSearch, filterKey, sortBy]);

    const { activeGoals, achievedGoals } = useMemo(() => {
        const active: SavingsGoal[] = [];
        const achieved: SavingsGoal[] = [];
        for (const g of filteredSortedGoals) {
            if (Number(g.current_amount) >= Number(g.target_amount)) achieved.push(g);
            else active.push(g);
        }
        return { activeGoals: active, achievedGoals: achieved };
    }, [filteredSortedGoals]);

    const selectedGoalForDeposit = selectedGoalId ? goals.find(g => g.id === selectedGoalId) ?? null : null;
    const presets = useMemo(() => {
        if (!selectedGoalForDeposit) return [];
        const remaining = Math.max(0, Number(selectedGoalForDeposit.target_amount) - Number(selectedGoalForDeposit.current_amount));
        const last = lastDepositByGoal.get(selectedGoalForDeposit.id);
        const items: { label: string; value: number }[] = [];
        if (remaining > 0) {
            items.push({ label: '¼', value: remaining / 4 });
            items.push({ label: '½', value: remaining / 2 });
            items.push({ label: 'Full', value: remaining });
        }
        if (last && last > 0) items.push({ label: `Last ${formatCurrency(last, selectedGoalForDeposit.currency)}`, value: last });
        return items;
    }, [selectedGoalForDeposit, lastDepositByGoal, formatCurrency]);

    const openHistory = (goal: SavingsGoal) => {
        setHistoryGoal(goal);
        setHistoryOpen(true);
    };

    const openDeposit = (goal: SavingsGoal) => {
        setSelectedGoalId(goal.id);
        setIsAddDepositOpen(true);
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 220, damping: 28, mass: 0.9 }}
            className="relative min-h-screen w-full"
        >
            <div
                aria-hidden="true"
                className={cn(
                    'pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full blur-[120px] opacity-30',
                    themeConfig.bgSolid
                )}
            />
            <div className="p-5 max-w-md lg:max-w-4xl mx-auto pb-32 lg:pb-8 relative z-10 space-y-6">
                <div className="flex items-center justify-between relative min-h-[40px] mb-2">
                    <button
                        onClick={() => router.back()}
                        aria-label="Go back"
                        className="w-10 h-10 rounded-full bg-secondary/30 hover:bg-secondary/50 flex items-center justify-center transition-colors border border-white/5 shrink-0 z-10"
                    >
                        <ArrowLeft className="w-5 h-5" aria-hidden="true" />
                    </button>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <h1 className="text-lg font-semibold flex items-center gap-2">
                            <Target className={`w-5 h-5 ${themeConfig.textLight}`} />
                            Savings Goals
                        </h1>
                    </div>

                    <button
                        onClick={openAddModal}
                        aria-label="Add savings goal"
                        className={`w-10 h-10 rounded-full flex items-center justify-center border transition-colors shrink-0 z-10 pointer-events-auto ${themeConfig.bg} ${themeConfig.hoverBg} ${themeConfig.border}`}
                    >
                        <Plus className={`w-5 h-5 ${themeConfig.textLight}`} aria-hidden="true" />
                    </button>
                </div>

                <Card className={cn('bg-gradient-to-br backdrop-blur-md overflow-hidden relative', themeConfig.gradient, themeConfig.border)}>
                    <div className="absolute -top-2 -right-2 p-6 opacity-[0.07] pointer-events-none">
                        <PiggyBank className={cn('w-32 h-32', themeConfig.text)} />
                    </div>
                    <CardContent className="p-5 relative z-10">
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                            Total Savings
                        </p>
                        <h2 className={cn('text-3xl font-bold mt-1', themeConfig.text)}>
                            {formatCurrency(totalSaved)}
                        </h2>
                        <p className="text-xs text-muted-foreground mt-1">
                            {goals.length} {goals.length === 1 ? 'goal' : 'goals'}
                            {achievedGoals.length > 0 && <span className="opacity-70"> · {achievedGoals.length} achieved</span>}
                        </p>
                    </CardContent>
                </Card>

                {goals.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                                <Input
                                    id="goals-search"
                                    name="goals-search"
                                    autoComplete="off"
                                    placeholder="Search goals"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className={`pl-9 pr-9 bg-secondary/10 border-white/10 h-10 rounded-xl ${themeConfig.ring}`}
                                />
                                {search && (
                                    <button
                                        type="button"
                                        onClick={() => setSearch('')}
                                        aria-label="Clear search"
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <button
                                        type="button"
                                        className={cn(
                                            'h-10 px-3 rounded-xl bg-secondary/10 border border-white/10 inline-flex items-center gap-1.5 text-xs font-bold shrink-0',
                                            themeConfig.text
                                        )}
                                        aria-label="Sort goals"
                                    >
                                        <ArrowUpDown className="w-3.5 h-3.5" aria-hidden="true" />
                                        <span className="hidden sm:inline">{SORT_LABELS[sortBy]}</span>
                                    </button>
                                </PopoverTrigger>
                                <PopoverContent align="end" className="w-56 p-1 bg-card/95 backdrop-blur-xl border-white/10">
                                    {(Object.keys(SORT_LABELS) as SortBy[]).map(opt => (
                                        <button
                                            key={opt}
                                            type="button"
                                            onClick={() => setSortBy(opt)}
                                            className={cn(
                                                'w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-secondary/30 transition-colors',
                                                sortBy === opt && 'bg-secondary/30'
                                            )}
                                        >
                                            <span>{SORT_LABELS[opt]}</span>
                                            {sortBy === opt && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                                        </button>
                                    ))}
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                            {(Object.keys(FILTER_LABELS) as FilterKey[]).map(key => (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => setFilterKey(key)}
                                    className={cn(
                                        'shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors',
                                        filterKey === key
                                            ? cn(themeConfig.bgMedium, themeConfig.borderMedium, themeConfig.text)
                                            : 'bg-secondary/20 border-white/10 text-muted-foreground hover:text-foreground'
                                    )}
                                >
                                    {FILTER_LABELS[key]}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="space-y-4">
                    {loading ? (
                        <>
                            <div className="h-32 w-full rounded-3xl bg-secondary/10 animate-pulse" />
                            <div className="h-32 w-full rounded-3xl bg-secondary/10 animate-pulse" />
                        </>
                    ) : goals.length === 0 ? (
                        <div className="text-center py-16 px-4 border border-dashed border-white/10 rounded-3xl bg-card/20 backdrop-blur-sm">
                            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border ${themeConfig.bgLight} ${themeConfig.border}`}>
                                <Target className={`w-8 h-8 opacity-80 ${themeConfig.textLight}`} />
                            </div>
                            <h3 className="text-lg font-bold mb-2">No savings goals yet</h3>
                            <p className="text-sm text-muted-foreground mb-6 max-w-[250px] mx-auto">
                                Set a target for a vacation, emergency fund, or a new gadget and track your progress.
                            </p>
                            <Button
                                onClick={openAddModal}
                                className={`text-white font-bold rounded-xl transition-all ${themeConfig.bgSolid} ${themeConfig.hoverBtnBg} ${themeConfig.shadowStrong}`}
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Create your first goal
                            </Button>
                        </div>
                    ) : activeGoals.length === 0 && achievedGoals.length === 0 ? (
                        <div className="text-center py-12 text-sm text-muted-foreground">
                            No goals match the current filters.
                        </div>
                    ) : (
                        <>
                            <AnimatePresence initial={false} mode="popLayout">
                                {activeGoals.map((goal, i) => (
                                    <motion.div
                                        key={goal.id}
                                        layout
                                        initial={{ opacity: 0, y: 8, scale: 0.98 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                                        transition={{ type: 'spring', stiffness: 260, damping: 26, delay: Math.min(i * 0.04, 0.24) }}
                                    >
                                        <GoalCard
                                            goal={goal}
                                            deposits={depositsByGoal.get(goal.id) ?? []}
                                            formatCurrency={formatCurrency}
                                            onAddDeposit={openDeposit}
                                            onEdit={openEditModal}
                                            onDelete={setGoalPendingDelete}
                                            onOpenHistory={openHistory}
                                        />
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                            {activeGoals.length === 0 && achievedGoals.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.05 }}
                                    className={cn(
                                        'text-center py-10 px-4 border border-dashed rounded-3xl bg-card/20 backdrop-blur-sm',
                                        themeConfig.border
                                    )}
                                >
                                    <div className={cn('inline-flex w-12 h-12 rounded-full items-center justify-center mb-3 border', themeConfig.bgLight, themeConfig.border)}>
                                        <PiggyBank className={cn('w-6 h-6', themeConfig.textLight)} aria-hidden="true" />
                                    </div>
                                    <p className="text-sm font-bold">Every goal is funded 🎉</p>
                                    <p className="text-xs text-muted-foreground mt-1 max-w-[260px] mx-auto">
                                        Time to dream up the next one. Tap + above to start.
                                    </p>
                                </motion.div>
                            )}
                            {achievedGoals.length > 0 && (
                                <Collapsible open={showAchieved} onOpenChange={setShowAchieved}>
                                    <CollapsibleTrigger asChild>
                                        <button
                                            type="button"
                                            className="w-full flex items-center justify-between gap-2 px-4 py-3 rounded-2xl bg-secondary/10 border border-white/5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            <span>Achieved ({achievedGoals.length})</span>
                                            <ChevronDown className={cn('w-4 h-4 transition-transform', showAchieved && 'rotate-180')} aria-hidden="true" />
                                        </button>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="space-y-4 pt-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
                                        {achievedGoals.map((goal, i) => (
                                            <motion.div
                                                key={goal.id}
                                                initial={{ opacity: 0, y: 6 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: Math.min(i * 0.04, 0.2) }}
                                            >
                                                <GoalCard
                                                    goal={goal}
                                                    deposits={depositsByGoal.get(goal.id) ?? []}
                                                    formatCurrency={formatCurrency}
                                                    onAddDeposit={openDeposit}
                                                    onEdit={openEditModal}
                                                    onDelete={setGoalPendingDelete}
                                                    onOpenHistory={openHistory}
                                                />
                                            </motion.div>
                                        ))}
                                    </CollapsibleContent>
                                </Collapsible>
                            )}
                        </>
                    )}
                </div>
            </div>

            <Dialog open={isGoalModalOpen} onOpenChange={setIsGoalModalOpen}>
                <DialogContent className="max-w-md rounded-3xl border-white/10 bg-card/95 backdrop-blur-xl p-0 max-h-[90vh] overflow-hidden flex flex-col gap-0">
                    {(() => {
                        const previewTokens = resolveGoalColor(goalColor);
                        const PreviewIcon = resolveGoalIcon(goalIcon);
                        const targetNum = parseFloat(goalTarget);
                        return (
                            <div className={cn('relative overflow-hidden p-5 bg-gradient-to-br', previewTokens.gradient)}>
                                <span aria-hidden="true" className={cn('pointer-events-none absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-30', previewTokens.swatch)} />
                                <DialogHeader className="gap-1 relative z-10">
                                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                                        {goalModalMode === 'add' ? 'New goal' : 'Editing'}
                                    </p>
                                    <DialogTitle className="flex items-center gap-2.5 text-xl">
                                        <span className={cn('w-9 h-9 rounded-xl border flex items-center justify-center', previewTokens.bg, previewTokens.border)}>
                                            <PreviewIcon className={cn('w-5 h-5', previewTokens.text)} aria-hidden="true" />
                                        </span>
                                        <span className="truncate">{goalName.trim() || 'Untitled goal'}</span>
                                    </DialogTitle>
                                    {!isNaN(targetNum) && targetNum > 0 && (
                                        <p className="text-xs text-muted-foreground relative z-10 mt-0.5">
                                            Target <span className={cn('font-bold', previewTokens.text)}>{formatCurrency(targetNum, goalCurrency)}</span>
                                            {goalDeadline && <span> · by {format(goalDeadline, 'MMM d, yyyy')}</span>}
                                        </p>
                                    )}
                                </DialogHeader>
                            </div>
                        );
                    })()}
                    <div className="px-5 py-4 space-y-4 overflow-y-auto">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Goal Name</Label>
                            <Input
                                autoFocus
                                placeholder="e.g. Dream Vacation"
                                value={goalName}
                                onChange={(e) => setGoalName(e.target.value)}
                                className={cn('bg-secondary/20 border-white/10 h-10 text-sm', themeConfig.ring)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Target Amount</Label>
                            <div className="flex gap-2">
                                <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="1000.00"
                                    value={goalTarget}
                                    onChange={(e) => setGoalTarget(e.target.value)}
                                    className={cn('bg-secondary/20 border-white/10 h-10 flex-1 text-base font-bold', themeConfig.ring)}
                                />
                                <div className="w-[120px]">
                                    <CurrencyDropdown value={goalCurrency} onValueChange={(val) => setGoalCurrency(val as Currency)} compact={true} />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Appearance</Label>
                            <div className="rounded-2xl bg-secondary/10 border border-white/5 p-3">
                                <IconColorPicker
                                    icon={goalIcon}
                                    color={goalColor}
                                    onIconChange={setGoalIcon}
                                    onColorChange={setGoalColor}
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5 flex flex-col">
                            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Target Date (Optional)</Label>
                            <div className="flex gap-2">
                                <Popover modal={true}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant={'outline'}
                                            className={cn(
                                                'flex-1 justify-start text-left font-normal h-10 bg-secondary/20 border-white/10 hover:bg-secondary/30 text-sm',
                                                !goalDeadline && 'text-muted-foreground'
                                            )}
                                        >
                                            <Calendar className="mr-2 h-4 w-4" />
                                            {goalDeadline ? format(goalDeadline, 'MMM d, yyyy') : <span>Pick a date</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0 bg-card/95 backdrop-blur-xl border-white/10" align="start">
                                        <CalendarComponent
                                            mode="single"
                                            selected={goalDeadline}
                                            onSelect={setGoalDeadline}
                                            initialFocus
                                            fromDate={new Date()}
                                            toDate={new Date(2035, 11, 31)}
                                        />
                                    </PopoverContent>
                                </Popover>
                                {goalDeadline && (
                                    <button
                                        type="button"
                                        onClick={() => setGoalDeadline(undefined)}
                                        aria-label="Clear target date"
                                        className="h-10 w-10 rounded-xl bg-secondary/20 border border-white/10 hover:bg-secondary/30 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="px-5 py-4 border-t border-white/5 flex gap-2 sm:gap-2">
                        <Button variant="ghost" className="flex-1 h-10 rounded-xl" onClick={() => setIsGoalModalOpen(false)}>Cancel</Button>
                        <Button
                            className={cn('flex-[1.5] h-10 rounded-xl font-bold text-white transition-all',
                                themeConfig.bgSolid, themeConfig.hoverBtnBg, themeConfig.shadowStrong)}
                            onClick={handleSaveGoal}
                            disabled={!goalName || !goalTarget}
                        >
                            {goalModalMode === 'add' ? 'Create Goal' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!goalPendingDelete} onOpenChange={(open) => !open && setGoalPendingDelete(null)}>
                <AlertDialogContent className="bg-card/95 backdrop-blur-xl border-white/10 rounded-3xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this goal?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {goalPendingDelete ? `"${goalPendingDelete.name}" and all its deposit history will be permanently removed. This cannot be undone.` : ''}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setGoalPendingDelete(null)}>Keep</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30"
                            onClick={() => { if (goalPendingDelete) { handleDeleteGoal(goalPendingDelete.id); setGoalPendingDelete(null); } }}
                        >
                            Delete Goal
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={isAddDepositOpen} onOpenChange={setIsAddDepositOpen}>
                <DialogContent className="max-w-md rounded-3xl border-white/10 bg-card/95 backdrop-blur-xl p-0 overflow-hidden gap-0">
                    {(() => {
                        const depositTokens = selectedGoalForDeposit ? resolveGoalColor(selectedGoalForDeposit.color) : resolveGoalColor(null);
                        const DepositIcon = selectedGoalForDeposit ? resolveGoalIcon(selectedGoalForDeposit.icon) : resolveGoalIcon(null);
                        const remaining = selectedGoalForDeposit
                            ? Math.max(0, Number(selectedGoalForDeposit.target_amount) - Number(selectedGoalForDeposit.current_amount))
                            : 0;
                        return (
                            <>
                                <div className={cn('relative overflow-hidden p-5 bg-gradient-to-br', depositTokens.gradient)}>
                                    <span aria-hidden="true" className={cn('pointer-events-none absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-30', depositTokens.swatch)} />
                                    <DialogHeader className="gap-1 relative z-10">
                                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Contribute</p>
                                        <DialogTitle className="flex items-center gap-2.5 text-xl">
                                            <span className={cn('w-9 h-9 rounded-xl border flex items-center justify-center', depositTokens.bg, depositTokens.border)}>
                                                <DepositIcon className={cn('w-5 h-5', depositTokens.text)} aria-hidden="true" />
                                            </span>
                                            <span className="truncate">{selectedGoalForDeposit?.name ?? 'Add Funds'}</span>
                                        </DialogTitle>
                                        {selectedGoalForDeposit && remaining > 0 && (
                                            <p className="text-xs text-muted-foreground mt-0.5 relative z-10">
                                                <span className={cn('font-bold', depositTokens.text)}>{formatCurrency(remaining, selectedGoalForDeposit.currency)}</span> left to reach the goal
                                            </p>
                                        )}
                                    </DialogHeader>
                                </div>
                                <div className="px-5 py-4 space-y-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Deposit Amount</Label>
                                        <div className="relative">
                                            <Input
                                                autoFocus
                                                type="number"
                                                step="0.01"
                                                placeholder="0.00"
                                                value={depositAmount}
                                                onChange={(e) => setDepositAmount(e.target.value)}
                                                className={cn('bg-secondary/20 border-white/10 h-14 text-2xl font-bold pl-10', themeConfig.ring)}
                                            />
                                            <span className={cn('absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold', depositTokens.text)}>
                                                {selectedGoalForDeposit ? CURRENCY_SYMBOLS[selectedGoalForDeposit.currency as Currency] || '$' : '$'}
                                            </span>
                                        </div>
                                    </div>
                                    {presets.length > 0 && (
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Quick presets</Label>
                                            <div className="flex flex-wrap gap-1.5">
                                                {presets.map((p, i) => (
                                                    <button
                                                        key={`${p.label}-${i}`}
                                                        type="button"
                                                        onClick={() => setDepositAmount(p.value.toFixed(2))}
                                                        className={cn(
                                                            'px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all',
                                                            depositTokens.bgLight, depositTokens.border, depositTokens.textLight, 'hover:opacity-80'
                                                        )}
                                                    >
                                                        {p.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <DialogFooter className="px-5 py-4 border-t border-white/5 flex gap-2 sm:gap-2">
                                    <Button variant="ghost" className="flex-1 h-10 rounded-xl" onClick={() => { setIsAddDepositOpen(false); setDepositAmount(''); }}>Cancel</Button>
                                    <Button
                                        className={cn('flex-[1.5] h-10 rounded-xl font-bold text-white transition-all',
                                            themeConfig.bgSolid, themeConfig.hoverBtnBg, themeConfig.shadowStrong)}
                                        onClick={handleAddDeposit}
                                        disabled={!depositAmount}
                                    >
                                        Add Funds
                                    </Button>
                                </DialogFooter>
                            </>
                        );
                    })()}
                </DialogContent>
            </Dialog>

            <GoalHistorySheet
                goal={historyGoal}
                userId={userId}
                open={historyOpen}
                onOpenChange={setHistoryOpen}
                formatCurrency={formatCurrency}
                onChanged={loadGoals}
            />
        </motion.div>
    );
}
