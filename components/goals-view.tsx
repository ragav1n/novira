'use client';

import { motion } from 'framer-motion';

import React, { useEffect, useState, useMemo } from 'react';
import { useUserPreferences, CURRENCY_SYMBOLS, type Currency } from '@/components/providers/user-preferences-provider';
import { useWorkspaceTheme } from '@/hooks/useWorkspaceTheme';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Target, Plus, Search, HelpCircle, ArrowLeft, TrendingUp, Calendar, PiggyBank, MoreVertical, Edit2, Trash2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from '@/utils/haptics';
import { Progress } from '@/components/ui/progress';
import { CurrencyDropdown } from '@/components/ui/currency-dropdown';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';

interface SavingsGoal {
    id: string;
    name: string;
    target_amount: number;
    current_amount: number;
    currency: string;
    deadline: string | null;
    icon: string | null;
    color: string | null;
}

export function GoalsView() {
    const { userId, formatCurrency, currency, activeWorkspaceId, convertAmount } = useUserPreferences();
    const router = useRouter();
    const { theme: themeConfig } = useWorkspaceTheme('emerald');

    const [goals, setGoals] = useState<SavingsGoal[]>([]);
    const [loading, setLoading] = useState(true);

    const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
    const [goalModalMode, setGoalModalMode] = useState<'add'|'edit'>('add');
    const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
    const [goalName, setGoalName] = useState('');
    const [goalTarget, setGoalTarget] = useState('');
    const [goalCurrency, setGoalCurrency] = useState<Currency>(currency);
    const [goalDeadline, setGoalDeadline] = useState<Date | undefined>(undefined);

    const [isAddDepositOpen, setIsAddDepositOpen] = useState(false);
    const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
    const [depositAmount, setDepositAmount] = useState('');

        const loadGoals = async () => {
        if (!userId) return;
        setLoading(true);
        let query = supabase
            .from('savings_goals')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (activeWorkspaceId && activeWorkspaceId !== 'personal') {
            query = query.eq('group_id', activeWorkspaceId);
        } else if (activeWorkspaceId === 'personal') {
            query = query.is('group_id', null);
        }

        const { data, error } = await query;

        if (!error && data) {
            setGoals(data);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadGoals();
    }, [userId, activeWorkspaceId]);

    // Real-time subscription for goals and deposits
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
    }, [userId, activeWorkspaceId]);

    const openAddModal = () => {
        setGoalModalMode('add');
        setEditingGoalId(null);
        setGoalName('');
        setGoalTarget('');
        setGoalCurrency(currency);
        setGoalDeadline(undefined);
        setIsGoalModalOpen(true);
    };

    const openEditModal = (goal: SavingsGoal) => {
        setGoalModalMode('edit');
        setEditingGoalId(goal.id);
        setGoalName(goal.name);
        setGoalTarget(goal.target_amount.toString());
        setGoalCurrency(goal.currency as Currency);
        setGoalDeadline(goal.deadline ? parseISO(goal.deadline) : undefined);
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
                    group_id: activeWorkspaceId && activeWorkspaceId !== 'personal' ? activeWorkspaceId : null
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
                    deadline: goalDeadline ? format(goalDeadline, 'yyyy-MM-dd') : null
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
        if (!confirm('Are you sure you want to delete this goal? This cannot be undone.')) return;
        
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

        const { data, error: rpcError } = await supabase.rpc('add_savings_deposit_atomic', {
            p_goal_id: selectedGoalId,
            p_user_id: userId,
            p_amount: amount,
            p_currency: goal.currency
        });

        if (rpcError || (data && !data.success)) {
            toast.error('Failed to add deposit: ' + (rpcError?.message || data?.error));
            return;
        }

        toast.success('Deposit added successfully!');
        setIsAddDepositOpen(false);
        setDepositAmount('');
        setSelectedGoalId(null);
        loadGoals();
    };



    const totalSaved = useMemo(() => {
        return goals.reduce((acc, goal) => {
            const amountInBase = convertAmount(Number(goal.current_amount), goal.currency, currency);
            return acc + amountInBase;
        }, 0);
    }, [goals, convertAmount, currency]);
    
    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 0.8 }}
            className="relative min-h-screen w-full"
        >


            <div className="p-5 max-w-md lg:max-w-2xl mx-auto pb-32 lg:pb-8 relative z-10 space-y-6">
                <div className="flex items-center justify-between relative min-h-[40px] mb-2">
                    <button 
                        onClick={() => router.back()} 
                        className="w-10 h-10 rounded-full bg-secondary/30 hover:bg-secondary/50 flex items-center justify-center transition-colors border border-white/5 shrink-0 z-10"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <h1 className="text-lg font-semibold flex items-center gap-2">
                            <Target className={`w-5 h-5 ${themeConfig.textLight}`} /> 
                            Savings Goals
                        </h1>
                    </div>
                    
                    <button
                        onClick={openAddModal}
                        className={`w-10 h-10 rounded-full flex items-center justify-center border transition-colors shrink-0 z-10 pointer-events-auto ${themeConfig.bg} ${themeConfig.hoverBg} ${themeConfig.border}`}
                    >
                        <Plus className={`w-5 h-5 ${themeConfig.textLight}`} />
                    </button>
                </div>

                {/* Total Saved Card */}
                <Card className={`bg-gradient-to-br backdrop-blur-md overflow-hidden relative ${themeConfig.gradient} ${themeConfig.border}`}>
                     <div className="absolute top-0 right-0 p-6 opacity-10">
                        <PiggyBank className={`w-24 h-24 ${themeConfig.text}`} />
                    </div>
                    <CardContent className="p-6 relative z-10">
                        <p className={`text-sm font-medium mb-1 ${themeConfig.textOpacity}`}>Total Savings</p>
                        <h2 className={`text-4xl font-bold ${themeConfig.textLight}`}>{formatCurrency(totalSaved)}</h2>
                    </CardContent>
                </Card>

                <div className="space-y-4">
                    {goals.length === 0 ? (
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
                    ) : (
                        goals.map(goal => {
                            const currentAmount = Number(goal.current_amount);
                            const targetAmount = Number(goal.target_amount);
                            const progress = targetAmount > 0 ? Math.min((currentAmount / targetAmount) * 100, 100) : 0;
                            const isCompleted = currentAmount >= targetAmount;

                            return (
                                <Card key={goal.id} className={cn(
                                    "border-white/5 backdrop-blur-xl relative overflow-hidden group transition-all",
                                    isCompleted 
                                        ? `${themeConfig.borderGlow} ${themeConfig.bgLight} shadow-[0_0_30px_rgba(16,185,129,0.1)]` // Keeping the shadow fixed is fine or can use shadowGlow, but 0.1 opacity is very specific. We'll use shadowGlow. actually, let me use template literal.
                                        : "bg-card/40"
                                )}>
                                     {isCompleted && (
                                         <div className={`absolute top-3 left-1/2 -translate-x-1/2 text-white text-[10px] uppercase tracking-wider font-bold px-3 py-1 rounded-full flex items-center gap-1 z-10 shadow-lg ${themeConfig.bgSolid} ${themeConfig.shadowGlow}`}>
                                             <CheckCircle2 className="w-3 h-3" />
                                             Goal Achieved
                                         </div>
                                     )}
                                    <CardContent className="p-5">
                                        <div className="flex justify-between items-start mb-4 relative z-20">
                                            <div className="min-w-0 flex-1 pr-4 mt-1">
                                                <h3 className="text-lg font-bold truncate">{goal.name}</h3>
                                                {goal.deadline && (
                                                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                                        <Calendar className="w-3 h-3" />
                                                        Target: {format(parseISO(goal.deadline), 'MMM d, yyyy')}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button 
                                                    onClick={() => {
                                                        setSelectedGoalId(goal.id);
                                                        setIsAddDepositOpen(true);
                                                    }}
                                                    className={cn(
                                                        "shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors shadow-sm",
                                                        isCompleted 
                                                            ? `${themeConfig.bg} border ${themeConfig.border} ${themeConfig.textLight} ${themeConfig.hoverBg}` 
                                                            : `${themeConfig.bgLight} ${themeConfig.hoverBg} border ${themeConfig.border} ${themeConfig.textLight}`
                                                    )}
                                                >
                                                    <Plus className="w-4 h-4" />
                                                </button>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <button className="shrink-0 w-8 h-8 rounded-full bg-secondary/30 hover:bg-secondary/50 flex items-center justify-center transition-colors">
                                                            <MoreVertical className="w-4 h-4" />
                                                        </button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-40 rounded-2xl bg-card/95 backdrop-blur-xl border-white/10">
                                                        <DropdownMenuItem onClick={() => openEditModal(goal)} className="gap-2 cursor-pointer">
                                                            <Edit2 className="w-4 h-4" /> Edit Goal
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleDeleteGoal(goal.id)} className="gap-2 cursor-pointer text-rose-400 focus:text-rose-400 focus:bg-rose-500/10">
                                                            <Trash2 className="w-4 h-4" /> Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm font-medium">
                                                <span className={themeConfig.textLight}>{formatCurrency(currentAmount, goal.currency)}</span>
                                                <span className="text-muted-foreground">of {formatCurrency(targetAmount, goal.currency)}</span>
                                            </div>
                                            <Progress 
                                                value={progress} 
                                                className="h-2.5 bg-black/30" 
                                                indicatorClassName={isCompleted ? themeConfig.indicatorFull : themeConfig.indicatorEmpty} 
                                            />
                                            <div className="flex justify-between text-[11px]">
                                                <span className="text-muted-foreground">{progress.toFixed(1)}% funded</span>
                                                <span className={`font-bold ${themeConfig.textOpacity}`}>
                                                    {isCompleted ? 'Goal Reached! 🎉' : `${formatCurrency(Math.max(0, targetAmount - currentAmount), goal.currency)} to go`}
                                                </span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })
                    )}
                </div>
            </div>

            {/* Goal Modal (Add / Edit) */}
            <Dialog open={isGoalModalOpen} onOpenChange={setIsGoalModalOpen}>
                <DialogContent className="max-w-md rounded-3xl border-white/10 bg-card/95 backdrop-blur-xl p-5">
                    <DialogHeader className="gap-1">
                        <DialogTitle>{goalModalMode === 'add' ? 'Create Savings Goal' : 'Edit Savings Goal'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 pt-3">
                        <div className="space-y-1">
                            <Label className="text-xs">Goal Name</Label>
                            <Input 
                                placeholder="e.g. Dream Vacation" 
                                value={goalName}
                                onChange={(e) => setGoalName(e.target.value)}
                                className="bg-secondary/20 border-white/10 h-10 text-sm"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Target Amount</Label>
                            <div className="flex gap-2">
                                <Input 
                                    type="number" 
                                    step="0.01"
                                    placeholder="1000.00" 
                                    value={goalTarget}
                                    onChange={(e) => setGoalTarget(e.target.value)}
                                    className="bg-secondary/20 border-white/10 h-10 flex-1 text-base font-bold"
                                />
                                <div className="w-[120px]">
                                    <CurrencyDropdown value={goalCurrency} onValueChange={(val) => setGoalCurrency(val as Currency)} compact={true} />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-1 flex flex-col">
                            <Label className="text-xs">Target Date (Optional)</Label>
                            <Popover modal={true}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full justify-start text-left font-normal h-10 bg-secondary/20 border-white/10 hover:bg-secondary/30 text-sm",
                                            !goalDeadline && "text-muted-foreground"
                                        )}
                                    >
                                        <Calendar className="mr-2 h-4 w-4" />
                                        {goalDeadline ? format(goalDeadline, "MMM d, yyyy") : <span>Pick a date</span>}
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
                        </div>
                    </div>
                    <DialogFooter className="mt-6 flex gap-2">
                        <Button variant="ghost" className="flex-1" onClick={() => setIsGoalModalOpen(false)}>Cancel</Button>
                        <Button 
                            className={`flex-1 font-bold text-white transition-all ${themeConfig.bgSolid} ${themeConfig.hoverBtnBg} ${themeConfig.shadowStrong}`}
                            onClick={handleSaveGoal}
                            disabled={!goalName || !goalTarget}
                        >
                            {goalModalMode === 'add' ? 'Create Goal' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add Deposit Dialog */}
            <Dialog open={isAddDepositOpen} onOpenChange={setIsAddDepositOpen}>
                <DialogContent className="max-w-md rounded-3xl border-white/10 bg-card/95 backdrop-blur-xl p-5">
                    <DialogHeader className="gap-1">
                        <DialogTitle>Add to Savings</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 pt-3">
                        <div className="space-y-1">
                            <Label className="text-xs">Deposit Amount</Label>
                            <div className="relative">
                                <Input 
                                    type="number" 
                                    step="0.01"
                                    placeholder="0.00" 
                                    value={depositAmount}
                                    onChange={(e) => setDepositAmount(e.target.value)}
                                    className="bg-secondary/20 border-white/10 h-14 text-2xl font-bold pl-10"
                                />
                                <span className={`absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold ${themeConfig.text}`}>
                                    {selectedGoalId ? CURRENCY_SYMBOLS[goals.find(g => g.id === selectedGoalId)?.currency as Currency] || '$' : '$'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="mt-4 flex gap-2">
                        <Button variant="ghost" className="flex-1 h-10 text-xs underline underline-offset-4 hover:bg-transparent" onClick={() => { setIsAddDepositOpen(false); setDepositAmount(''); }}>Cancel</Button>
                        <Button 
                            className={`flex-[1.5] h-10 font-bold text-white transition-all ${themeConfig.bgSolid} ${themeConfig.hoverBtnBg} ${themeConfig.shadowStrong}`}
                            onClick={handleAddDeposit}
                            disabled={!depositAmount}
                        >
                            Add Funds
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </motion.div>
    );
}
