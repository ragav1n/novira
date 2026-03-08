'use client';

import { motion } from 'framer-motion';

import React, { useEffect, useState } from 'react';
import { useUserPreferences, CURRENCY_SYMBOLS, type Currency } from '@/components/providers/user-preferences-provider';
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
    const { userId, formatCurrency, currency } = useUserPreferences();
    const router = useRouter();
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
        const { data, error } = await supabase
            .from('savings_goals')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (!error && data) {
            setGoals(data);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadGoals();
    }, [userId]);

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

        if (goalModalMode === 'add') {
            const { error } = await supabase
                .from('savings_goals')
                .insert({
                    user_id: userId,
                    name: goalName,
                    target_amount: parseFloat(goalTarget),
                    currency: goalCurrency,
                    deadline: goalDeadline ? format(goalDeadline, 'yyyy-MM-dd') : null
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
        const goal = goals.find(g => g.id === selectedGoalId);
        if (!goal) return;

        // Start transaction (simplified via client: insert deposit, update goal)
        const { error: depositError } = await supabase
            .from('savings_deposits')
            .insert({
                goal_id: selectedGoalId,
                user_id: userId,
                amount: amount,
                currency: goal.currency
            });

        if (depositError) {
            toast.error('Failed to add deposit');
            return;
        }

        const { error: updateError } = await supabase
            .from('savings_goals')
            .update({ current_amount: Number(goal.current_amount) + amount })
            .eq('id', selectedGoalId);

        if (updateError) {
            toast.error('Failed to update goal');
        } else {
            toast.success('Deposit added successfully!');
            setIsAddDepositOpen(false);
            setDepositAmount('');
            setSelectedGoalId(null);
            loadGoals();
        }
    };



    const totalSaved = goals.reduce((acc, goal) => acc + Number(goal.current_amount), 0); // Need proper conversion here eventually
    
    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 0.8 }}
            className={cn(
                "p-5 space-y-6 max-w-md mx-auto relative min-h-screen pb-32 transition-all duration-300",
                loading ? "opacity-40 blur-[1px] pointer-events-none" : "opacity-100 blur-0"
            )}
        >
            {/* Background Glows */}
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
                <div className="absolute top-[20%] -right-[10%] w-[60%] h-[60%] rounded-full blur-[110px] bg-emerald-500 opacity-20" />
                <div className="absolute bottom-[20%] -left-[10%] w-[50%] h-[50%] rounded-full blur-[90px] bg-emerald-400 opacity-10" />
            </div>

            <div className="relative z-10 space-y-6">
                <div className="flex items-center justify-between relative min-h-[40px] mb-2">
                    <button 
                        onClick={() => router.back()} 
                        className="w-10 h-10 rounded-full bg-secondary/30 hover:bg-secondary/50 flex items-center justify-center transition-colors border border-white/5 shrink-0 z-10"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <h1 className="text-lg font-semibold flex items-center gap-2">
                            <Target className="w-5 h-5 text-emerald-400" /> 
                            Savings Goals
                        </h1>
                    </div>
                    <button
                        onClick={openAddModal}
                        className="w-10 h-10 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 flex items-center justify-center border border-emerald-500/20 transition-colors shrink-0 z-10 pointer-events-auto"
                    >
                        <Plus className="w-5 h-5 text-emerald-400" />
                    </button>
                </div>

                {/* Total Saved Card */}
                <Card className="bg-gradient-to-br from-emerald-600/20 to-teal-800/20 border-emerald-500/20 backdrop-blur-md overflow-hidden relative">
                     <div className="absolute top-0 right-0 p-6 opacity-10">
                        <PiggyBank className="w-24 h-24 text-emerald-500" />
                    </div>
                    <CardContent className="p-6 relative z-10">
                        <p className="text-sm text-emerald-100/80 font-medium mb-1">Total Savings</p>
                        <h2 className="text-4xl font-bold text-emerald-400">{formatCurrency(totalSaved)}</h2>
                    </CardContent>
                </Card>

                <div className="space-y-4">
                    {goals.length === 0 ? (
                        <div className="text-center py-16 px-4 border border-dashed border-white/10 rounded-3xl bg-card/20 backdrop-blur-sm">
                            <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                                <Target className="w-8 h-8 text-emerald-400 opacity-80" />
                            </div>
                            <h3 className="text-lg font-bold mb-2">No savings goals yet</h3>
                            <p className="text-sm text-muted-foreground mb-6 max-w-[250px] mx-auto">
                                Set a target for a vacation, emergency fund, or a new gadget and track your progress.
                            </p>
                            <Button 
                                onClick={openAddModal}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all"
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
                                        ? "border-emerald-500/30 bg-emerald-500/10 shadow-[0_0_30px_rgba(16,185,129,0.1)]" 
                                        : "bg-card/40"
                                )}>
                                     {isCompleted && (
                                         <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[10px] uppercase tracking-wider font-bold px-3 py-1 rounded-full flex items-center gap-1 z-10 shadow-lg shadow-emerald-500/20">
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
                                                            ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30" 
                                                            : "bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400"
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
                                                <span className="text-emerald-400">{formatCurrency(currentAmount, goal.currency)}</span>
                                                <span className="text-muted-foreground">of {formatCurrency(targetAmount, goal.currency)}</span>
                                            </div>
                                            <Progress 
                                                value={progress} 
                                                className="h-2.5 bg-black/30" 
                                                indicatorClassName={isCompleted ? "bg-emerald-400" : "bg-emerald-500"} 
                                            />
                                            <div className="flex justify-between text-[11px]">
                                                <span className="text-muted-foreground">{progress.toFixed(1)}% funded</span>
                                                <span className="text-emerald-500/80 font-bold">
                                                    {isCompleted ? 'Goal Reached! 🎉' : `${formatCurrency(targetAmount - currentAmount, goal.currency)} to go`}
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
                <DialogContent className="max-w-md rounded-3xl border-white/10 bg-card/95 backdrop-blur-xl">
                    <DialogHeader>
                        <DialogTitle>{goalModalMode === 'add' ? 'Create Savings Goal' : 'Edit Savings Goal'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label>Goal Name</Label>
                            <Input 
                                placeholder="e.g. Dream Vacation" 
                                value={goalName}
                                onChange={(e) => setGoalName(e.target.value)}
                                className="bg-secondary/20 border-white/10 h-12"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Target Amount</Label>
                            <div className="flex gap-2">
                                <Input 
                                    type="number" 
                                    step="0.01"
                                    placeholder="1000.00" 
                                    value={goalTarget}
                                    onChange={(e) => setGoalTarget(e.target.value)}
                                    className="bg-secondary/20 border-white/10 h-12 flex-1 text-lg font-bold"
                                />
                                <div className="w-[140px]">
                                    <CurrencyDropdown value={goalCurrency} onValueChange={(val) => setGoalCurrency(val as Currency)} compact={true} />
                                </div>
                            </div>
                        </div>
                        <div className="space-y-2 flex flex-col">
                            <Label>Target Date (Optional)</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full justify-start text-left font-normal h-12 bg-secondary/20 border-white/10 hover:bg-secondary/30",
                                            !goalDeadline && "text-muted-foreground"
                                        )}
                                    >
                                        <Calendar className="mr-2 h-4 w-4" />
                                        {goalDeadline ? format(goalDeadline, "PPP") : <span>Pick a date</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 bg-card/95 backdrop-blur-xl border-white/10" align="start">
                                    <CalendarComponent
                                        mode="single"
                                        selected={goalDeadline}
                                        onSelect={setGoalDeadline}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                    <DialogFooter className="mt-6 flex gap-2">
                        <Button variant="ghost" className="flex-1" onClick={() => setIsGoalModalOpen(false)}>Cancel</Button>
                        <Button 
                            className="flex-1 bg-emerald-500 hover:bg-emerald-600 font-bold text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all"
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
                <DialogContent className="max-w-md rounded-3xl border-white/10 bg-card/95 backdrop-blur-xl">
                    <DialogHeader>
                        <DialogTitle>Add to Savings</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label>Deposit Amount</Label>
                            <div className="relative">
                                <Input 
                                    type="number" 
                                    step="0.01"
                                    placeholder="0.00" 
                                    value={depositAmount}
                                    onChange={(e) => setDepositAmount(e.target.value)}
                                    className="bg-secondary/20 border-white/10 h-16 text-3xl font-bold pl-12"
                                />
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-emerald-500">
                                    {selectedGoalId ? CURRENCY_SYMBOLS[goals.find(g => g.id === selectedGoalId)?.currency as Currency] || '$' : '$'}
                                </span>
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="mt-6 flex gap-2">
                        <Button variant="ghost" className="flex-1" onClick={() => { setIsAddDepositOpen(false); setDepositAmount(''); }}>Cancel</Button>
                        <Button 
                            className="flex-1 bg-emerald-500 hover:bg-emerald-600 font-bold text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all"
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
