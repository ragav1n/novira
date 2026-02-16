'use client';

import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { BudgetAlertManager } from '@/components/budget-alert-manager';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Utensils, Car, Zap, ShoppingBag, HeartPulse, Clapperboard, CircleDollarSign, ArrowUpRight, ArrowDownLeft, Users, MoreVertical, Pencil, Trash2, X, History, Clock, HelpCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Pie, PieChart, Cell } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/pie-chart";
import { supabase } from '@/lib/supabase';
import { format, isSameMonth, parseISO } from 'date-fns';
import { WaveLoader } from '@/components/ui/wave-loader';
import { useGroups } from './providers/groups-provider';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Constants
const CATEGORY_COLORS: Record<string, string> = {
    food: '#8A2BE2',      // Electric Purple
    transport: '#FF6B6B', // Coral
    bills: '#4ECDC4',     // Teal
    shopping: '#F9C74F',  // Yellow
    healthcare: '#FF9F1C', // Orange
    entertainment: '#FF1493', // Deep Pink
    others: '#C7F464',    // Lime
    settlement: '#10B981', // Emerald for settlement
    uncategorized: '#6366F1', // Indigo-500 for Uncategorized
};

const chartConfig: ChartConfig = {
    food: { label: "Food & Dining", color: CATEGORY_COLORS.food },
    transport: { label: "Transportation", color: CATEGORY_COLORS.transport },
    bills: { label: "Bills & Utilities", color: CATEGORY_COLORS.bills },
    shopping: { label: "Shopping", color: CATEGORY_COLORS.shopping },
    healthcare: { label: "Healthcare", color: CATEGORY_COLORS.healthcare },
    entertainment: { label: "Entertainment", color: CATEGORY_COLORS.entertainment },
    others: { label: "Others", color: CATEGORY_COLORS.others },
    uncategorized: { label: "Uncategorized", color: CATEGORY_COLORS.uncategorized },
};

type Transaction = {
    id: string;
    description: string;
    amount: number;
    category: string;
    is_settlement?: boolean;
    date: string;
    created_at: string;
    user_id: string;
    currency?: string;
    exchange_rate?: number;
    base_currency?: string;
    converted_amount?: number;
    splits?: {
        user_id: string;
        amount: number;
        is_paid: boolean;
    }[];
    profile?: {
        full_name: string;
    };
};

type SpendingCategory = {
    name: string;
    value: number;
    color: string;
    fill: string;
};
type AuditLog = {
    id: string;
    action: 'INSERT' | 'UPDATE' | 'DELETE';
    old_data: any;
    new_data: any;
    created_at: string;
    changed_by_profile?: {
        full_name: string;
    };
};

export function DashboardView() {
    const router = useRouter();
    const [userName, setUserName] = useState<string>('User');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [userId, setUserId] = useState<string | null>(null);

    const [loading, setLoading] = useState(true);
    const { formatCurrency, currency, convertAmount, monthlyBudget, userId: providerUserId } = useUserPreferences();
    const { balances, groups, friends } = useGroups();

    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);

    const [selectedAuditTx, setSelectedAuditTx] = useState<Transaction | null>(null);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [loadingAudit, setLoadingAudit] = useState(false);

    // Sync provider userId to local state if needed, or just use it directly
    // We kept the local state 'userId' for now to minimize refactor impact, 
    // but we'll sync it.
    // Sync provider userId to local state if needed, or just use it directly
    // We kept the local state 'userId' for now to minimize refactor impact, 
    // but we'll sync it.
    useEffect(() => {
        if (providerUserId) {
            setUserId(providerUserId);
            // Fetch Profile - optimization: could be in provider but keeping here for now
            const fetchProfile = async () => {
                try {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('full_name, avatar_url')
                        .eq('id', providerUserId)
                        .single();

                    if (profile) {
                        setUserName(profile.full_name || 'User');
                        setAvatarUrl(profile.avatar_url);
                    }
                    await loadTransactions(providerUserId);
                } catch (error) {
                    console.error("Error fetching data:", error);
                } finally {
                    setLoading(false);
                }
            };
            fetchProfile();
        } else if (!loading) {
            // If provider finished loading and no user, we might want to redirect or just show empty?
            // But layout handles redirect for protected pages.
            setLoading(false);
        }
    }, [providerUserId]);

    const loadTransactions = async (currentUserId: string) => {
        try {
            const { data: txs } = await supabase
                .from('transactions')
                .select('*, profile:profiles(full_name), splits(*)')
                .order('date', { ascending: false })
                .order('created_at', { ascending: false });

            if (txs) {
                setTransactions(txs);
            }
        } catch (error) {
            console.error("Error loading transactions:", error);
        }
    };

    const handleDeleteTransaction = async (txId: string) => {
        try {
            const { error } = await supabase
                .from('transactions')
                .delete()
                .eq('id', txId);

            if (error) throw error;
            toast.success('Transaction deleted');
            if (userId) loadTransactions(userId);
        } catch (error: any) {
            toast.error('Failed to delete: ' + error.message);
        }
    };

    const handleUpdateTransaction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTransaction) return;

        try {
            const { error } = await supabase
                .from('transactions')
                .update({
                    description: editingTransaction.description,
                    category: editingTransaction.category,
                    amount: editingTransaction.amount, // Allow amount edit if user knows what they are doing (splits might get weird if we don't handle them, but let's allow safe edits first)
                })
                .eq('id', editingTransaction.id);

            if (error) throw error;
            toast.success('Transaction updated');
            setIsEditOpen(false);
            setEditingTransaction(null);
            if (userId) loadTransactions(userId);
        } catch (error: any) {
            toast.error('Failed to update: ' + error.message);
        }
    };

    const loadAuditLogs = async (tx: Transaction) => {
        setSelectedAuditTx(tx);
        setLoadingAudit(true);
        try {
            const { data, error } = await supabase
                .from('transaction_history')
                .select('*, changed_by_profile:profiles(full_name)')
                .eq('transaction_id', tx.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setAuditLogs(data || []);
        } catch (error: any) {
            console.error("Error loading audit logs:", error);
            toast.error("Failed to load history");
        } finally {
            setLoadingAudit(false);
        }
    };

    const isRecentUserTransaction = (tx: Transaction) => {
        if (tx.user_id !== userId) return false;
        // Get all transactions by this user, assuming 'transactions' is already sorted by date desc
        const userTxs = transactions.filter(t => t.user_id === userId);
        // Check if this tx is in the top 3
        return userTxs.slice(0, 3).some(t => t.id === tx.id);
    };

    const calculateUserShare = (tx: Transaction, currentUserId: string | null) => {
        if (!currentUserId) return 0;

        // CASH BASIS LOGIC:
        // 1. If I PAID the transaction (user_id === currentUserId), I spent the FULL amount immediately.
        //    Reimbursements will come later as separate 'Settlement Received' transactions (negative amount).
        if (tx.user_id === currentUserId) {
            return Number(tx.amount);
        }

        // 2. If I am a DEBTOR (in splits) but didn't pay:
        //    - I haven't "spent" money yet in cash items.
        //    - My expense will be recorded when I SETTLE (via 'Settlement Sent' transaction).
        //    - So for the ORIGINAL split transaction, my share is 0.
        return 0;
    };

    // Calculate personal share for budget tracking
    const totalSpent = transactions.reduce((acc, tx) => {
        if (!userId) return acc;

        // Exclude settlements from "Spent"? 
        // NO. With Cash Basis logic:
        // - Payer gets "Settled: Food" (Income/Negative). This reduces Total Spent. Correct.
        // - Debtor gets "Settled: Food" (Expense/Positive). This increases Total Spent. Correct.
        // So we include ALL transactions.

        // Filter for current month using parseISO
        const txDate = parseISO(tx.date);
        if (!isSameMonth(txDate, new Date())) return acc;

        const myShare = calculateUserShare(tx, userId);

        // Conversion Logic:
        if (tx.exchange_rate && tx.base_currency === currency) {
            return acc + (myShare * Number(tx.exchange_rate));
        }

        return acc + convertAmount(myShare, tx.currency || 'USD');
    }, 0);

    const remaining = monthlyBudget - totalSpent;
    const progress = Math.min((totalSpent / monthlyBudget) * 100, 100);

    // Calculate Spending by Category (converted personal share)
    const spendingByCategory = transactions.reduce((acc, tx) => {
        if (!userId) return acc;

        // Include all categories (settlements now inherit category)

        // Filter for current month using parseISO
        const txDate = parseISO(tx.date);
        if (!isSameMonth(txDate, new Date())) return acc;

        const cat = tx.category.toLowerCase();
        const myShare = calculateUserShare(tx, userId);

        if (myShare > 0) {
            if (!acc[cat]) acc[cat] = 0;

            if (tx.exchange_rate && tx.base_currency === currency) {
                acc[cat] += (myShare * Number(tx.exchange_rate));
            } else {
                acc[cat] += convertAmount(myShare, tx.currency || 'USD');
            }
        }
        return acc;
    }, {} as Record<string, number>);

    const spendingData: SpendingCategory[] = Object.entries(spendingByCategory).map(([cat, value]) => ({
        name: cat.charAt(0).toUpperCase() + cat.slice(1),
        value,
        color: CATEGORY_COLORS[cat] || CATEGORY_COLORS.others,
        fill: CATEGORY_COLORS[cat] || CATEGORY_COLORS.others,
    }));

    const getIconForCategory = (category: string) => {
        switch (category.toLowerCase()) {
            case 'food': return <Utensils className="w-5 h-5 text-white" />;
            case 'transport': return <Car className="w-5 h-5 text-white" />;
            case 'bills': return <Zap className="w-5 h-5 text-white" />;
            case 'shopping': return <ShoppingBag className="w-5 h-5 text-white" />;
            case 'healthcare': return <HeartPulse className="w-5 h-5 text-white" />;
            case 'entertainment': return <Clapperboard className="w-5 h-5 text-white" />;
            case 'settlement': return <ArrowUpRight className="w-5 h-5 text-white" />;
            case 'uncategorized': return <HelpCircle className="w-5 h-5 text-white" />;
            default: return <CircleDollarSign className="w-5 h-5 text-white" />;
        }
    };

    if (loading) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center min-h-[50vh]">
                <WaveLoader bars={5} message="Loading dashboard..." />
            </div>
        );
    }

    // Filter transactions to only show relevant ones (where user has a share or paid)
    const displayTransactions = transactions.filter(tx => {
        if (tx.user_id === userId) return true; // I paid
        if (tx.splits && tx.splits.some(s => s.user_id === userId)) return true; // I'm in splits
        return false;
    });

    return (
        <div className="p-5 space-y-6 max-w-md mx-auto relative min-h-full">
            {/* Header */}
            <div className="flex justify-between items-center pt-2">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 relative shrink-0">
                        <img src="/Novira.png" alt="Novira" className="w-full h-full object-contain drop-shadow-[0_0_8px_rgba(138,43,226,0.5)]" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/80">
                            Hello, {userName.split(' ')[0]}! 👋
                        </h1>
                        <p className="text-[11px] text-muted-foreground font-medium">Track your expenses with Novira</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div
                        onClick={() => router.push('/settings')}
                        className="w-10 h-10 rounded-full bg-secondary/20 border border-white/5 overflow-hidden flex items-center justify-center text-xs font-bold text-muted-foreground uppercase shrink-0 cursor-pointer hover:border-primary/50 transition-colors"
                    >
                        {avatarUrl ? (
                            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                            userName.substring(0, 2)
                        )}
                    </div>
                    <button
                        onClick={() => router.push('/add')}
                        className="w-10 h-10 rounded-full bg-primary/20 hover:bg-primary/30 flex items-center justify-center border border-primary/20 transition-colors"
                    >
                        <Plus className="w-5 h-5 text-primary" />
                    </button>
                </div>
            </div>

            <BudgetAlertManager totalSpent={totalSpent} />

            {/* Empty State - No Groups or Friends AND No Transactions (Brand New User) */}
            {(!loading && groups.length === 0 && friends.length === 0 && transactions.length === 0) && (
                <Card className="bg-card/40 border-primary/20 overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <Users className="w-24 h-24" />
                    </div>
                    <CardContent className="p-5 relative z-10">
                        <h3 className="font-bold text-lg mb-1">Welcome to Novira!</h3>
                        <p className="text-xs text-muted-foreground mb-4">Start by creating a group or adding friends to split expenses.</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => router.push('/groups')}
                                className="flex-1 bg-primary text-white text-xs font-bold py-2.5 px-4 rounded-xl hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                Start a Group
                            </button>
                            <button
                                onClick={() => router.push('/groups')}
                                className="flex-1 bg-secondary/20 text-foreground text-xs font-bold py-2.5 px-4 rounded-xl hover:bg-secondary/30 transition-colors flex items-center justify-center gap-2 border border-white/5"
                            >
                                <Users className="w-4 h-4" />
                                Add Friends
                            </button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Total Spent Card */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#8A2BE2] to-[#4B0082] p-6 shadow-xl shadow-primary/20">
                <div className="absolute top-0 right-0 p-6 opacity-10">
                    <span className="text-9xl font-bold text-white">{currency === 'EUR' ? '€' : currency === 'INR' ? '₹' : '$'}</span>
                </div>
                <div className="relative z-10 space-y-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-white/80 text-sm font-medium">Personal Share Spent</p>
                            <h2 className="text-4xl font-bold text-white mt-1">{formatCurrency(totalSpent)}</h2>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                            <span className="text-xl font-bold text-white">{currency === 'EUR' ? '€' : currency === 'INR' ? '₹' : '$'}</span>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-medium text-white/80">
                            <span>Budget: {formatCurrency(monthlyBudget)}</span>
                            <span>Remaining: {formatCurrency(remaining)}</span>
                        </div>
                        <Progress value={progress} className="h-2 bg-black/30" indicatorClassName="bg-white" />
                        <div className="flex justify-between text-[10px] text-white/60">
                            <span>{progress.toFixed(1)}% used</span>
                            <span>{new Date().getDate()}th of Month</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Balance Summary Card */}
            <div className="grid grid-cols-2 gap-4">
                <Card className="bg-emerald-500/10 border-emerald-500/20">
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center mb-2">
                            <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                        </div>
                        <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">You are owed</p>
                        <h4 className="text-lg font-bold text-emerald-500">{formatCurrency(balances.totalOwedToMe)}</h4>
                    </CardContent>
                </Card>
                <Card className="bg-rose-500/10 border-rose-500/20">
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                        <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center mb-2">
                            <ArrowUpRight className="w-4 h-4 text-rose-500" />
                        </div>
                        <p className="text-[10px] text-rose-500 font-bold uppercase tracking-wider">You owe</p>
                        <h4 className="text-lg font-bold text-rose-500">{formatCurrency(balances.totalOwed)}</h4>
                    </CardContent>
                </Card>
            </div>

            {/* Spending by Category */}
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold">Spending by Category</h3>
                    <span className="text-xs bg-secondary/30 px-3 py-1 rounded-full text-primary border border-primary/20">Current Month</span>
                </div>
                <Card className="border-none bg-card/40 backdrop-blur-md shadow-none">
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                        {spendingData.length > 0 ? (
                            <>
                                <div className="w-32 h-32 relative flex-shrink-0">
                                    <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[250px]">
                                        <PieChart>
                                            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                                            <Pie
                                                data={spendingData}
                                                dataKey="value"
                                                nameKey="name"
                                                innerRadius={40}
                                                outerRadius={60}
                                                paddingAngle={5}
                                                cornerRadius={5}
                                                strokeWidth={0}
                                            >
                                                {spendingData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                        </PieChart>
                                    </ChartContainer>
                                </div>
                                <div className="flex-1 space-y-3">
                                    {spendingData.map((item) => (
                                        <div key={item.name} className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                                <span className="text-foreground/80">{item.name}</span>
                                            </div>
                                            <span className="font-semibold">{formatCurrency(item.value)}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="w-full text-center py-8 text-muted-foreground text-sm">
                                No personal expenses yet.
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Recent Transactions */}
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold">Recent Transactions</h3>
                    <Dialog>
                        <DialogTrigger asChild>
                            <button className="text-xs text-primary hover:text-primary/80">View All</button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
                            <DialogHeader>
                                <DialogTitle>All Transactions</DialogTitle>
                                <DialogDescription>History of all your expenses.</DialogDescription>
                            </DialogHeader>
                            <div className="flex-1 overflow-y-auto -mr-4 pr-4 min-h-0">
                                <div className="space-y-3 pt-4">
                                    {displayTransactions.map((tx) => {
                                        const myShare = calculateUserShare(tx, userId);
                                        return (
                                            <div key={tx.id} className="flex items-center justify-between p-3 rounded-2xl bg-card/20 border border-white/5 hover:bg-card/40 transition-colors group">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center border border-white/5 relative">
                                                        {getIconForCategory(tx.category)}
                                                        {tx.splits && tx.splits.length > 0 && (
                                                            <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-0.5 border border-background">
                                                                <Users className="w-2.5 h-2.5 text-white" />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-sm truncate max-w-[200px]" title={tx.description}>{tx.description}</p>
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                                            <span className="px-1.5 py-0.5 rounded bg-primary/10 text-[10px] text-primary border border-primary/10 capitalize">{tx.category}</span>
                                                            <span className="font-medium text-[10px] text-primary/80">
                                                                {tx.user_id === userId ? 'You paid' : `Paid by ${tx.profile?.full_name?.split(' ')[0] || 'Unknown'}`}
                                                            </span>
                                                            <span>• {format(new Date(tx.date), 'MMM d, yyyy')}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex flex-col items-end">

                                                        <span className={cn(
                                                            "font-bold text-sm",
                                                            // If it's income (e.g. settlement where I am creditor), it might be handled differently,
                                                            // but currently 'amount' in DB is usually positive for expense.
                                                            // If I am creditor in settlement, amount is negative in DB (from our RPC).
                                                            // calculateUserShare returns 'Number(tx.amount)' which is negative (-50).
                                                            myShare < 0 ? "text-emerald-500" : ""
                                                        )}>
                                                            {myShare < 0 ? '+' : '-'}{formatCurrency(Math.abs(myShare), tx.currency)}
                                                        </span>
                                                        {(tx.currency !== currency) && (
                                                            <div className="text-[10px] text-muted-foreground flex flex-col items-end mt-0.5">
                                                                <span className="font-medium text-emerald-500">
                                                                    ≈ {formatCurrency(convertAmount(Math.abs(myShare), tx.currency || 'USD'), currency)}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {tx.splits && tx.splits.length > 0 && (
                                                            <span className="text-[9px] text-muted-foreground mt-0.5">
                                                                My Share
                                                            </span>
                                                        )}
                                                    </div>
                                                    {isRecentUserTransaction(tx) && !tx.is_settlement && (!tx.splits || tx.splits.length === 0) && (
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <button className="p-1 rounded-full hover:bg-white/10 transition-opacity">
                                                                    <MoreVertical className="w-4 h-4 text-muted-foreground" />
                                                                </button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem onClick={() => {
                                                                    setEditingTransaction(tx);
                                                                    setIsEditOpen(true);
                                                                }}>
                                                                    <Pencil className="w-4 h-4 mr-2" />
                                                                    Edit
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => {
                                                                    toast('Delete transaction?', {
                                                                        action: {
                                                                            label: 'Delete',
                                                                            onClick: () => handleDeleteTransaction(tx.id)
                                                                        }
                                                                    });
                                                                }}>
                                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                                    Delete
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {displayTransactions.length === 0 && (
                                        <div className="text-center py-8 text-muted-foreground">No transactions found.</div>
                                    )}
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="space-y-3">
                    {displayTransactions.slice(0, 5).map((tx) => {
                        const myShare = calculateUserShare(tx, userId);
                        return (
                            <div key={tx.id} className="flex items-center justify-between p-3 rounded-2xl bg-card/30 border border-white/5 hover:bg-card/50 transition-colors group">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center border border-white/5 relative">
                                        {getIconForCategory(tx.category)}
                                        {tx.splits && tx.splits.length > 0 && (
                                            <div className="absolute -bottom-1 -right-1 bg-primary rounded-full p-0.5 border border-background">
                                                <Users className="w-2.5 h-2.5 text-white" />
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm truncate max-w-[180px]" title={tx.description}>{tx.description}</p>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span className="px-1.5 py-0.5 rounded bg-primary/10 text-[10px] text-primary capitalize">{tx.category}</span>
                                            <span className="font-medium text-[10px] text-primary/80">
                                                {tx.user_id === userId ? 'You paid' : `Paid by ${tx.profile?.full_name?.split(' ')[0] || 'Unknown'}`}
                                            </span>
                                            <span>• {format(new Date(tx.date), 'MMM d')}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex flex-col items-end">
                                        <span className={cn(
                                            "font-semibold text-sm",
                                            myShare < 0 ? "text-emerald-500" : ""
                                        )}>
                                            {myShare < 0 ? '+' : '-'}{formatCurrency(Math.abs(myShare), tx.currency)}
                                        </span>
                                        {(tx.currency !== currency) && (
                                            <div className="text-[10px] text-muted-foreground flex flex-col items-end mt-0.5">
                                                <span className="font-medium text-emerald-500">
                                                    ≈ {formatCurrency(convertAmount(Math.abs(myShare), tx.currency || 'USD'), currency)}
                                                </span>
                                            </div>
                                        )}
                                        {tx.splits && tx.splits.length > 0 && (
                                            <span className="text-[9px] text-muted-foreground mt-0.5">
                                                My Share
                                            </span>
                                        )}
                                    </div>
                                    <div className="w-[56px] flex items-center justify-start gap-1.5 transition-opacity">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                loadAuditLogs(tx);
                                            }}
                                            className="p-1.5 rounded-full hover:bg-white/10 transition-colors text-muted-foreground hover:text-primary"
                                            title="View History"
                                        >
                                            <History className="w-3.5 h-3.5" />
                                        </button>
                                        {isRecentUserTransaction(tx) && !tx.is_settlement && (!tx.splits || tx.splits.length === 0) && (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <button className="p-1 rounded-full hover:bg-white/10 transition-opacity">
                                                        <MoreVertical className="w-4 h-4 text-muted-foreground" />
                                                    </button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => {
                                                        setEditingTransaction(tx);
                                                        setIsEditOpen(true);
                                                    }}>
                                                        <Pencil className="w-4 h-4 mr-2" />
                                                        Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => {
                                                        toast('Delete transaction?', {
                                                            action: {
                                                                label: 'Delete',
                                                                onClick: () => handleDeleteTransaction(tx.id)
                                                            }
                                                        });
                                                    }}>
                                                        <Trash2 className="w-4 h-4 mr-2" />
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {displayTransactions.length === 0 && (
                        <div className="text-center text-xs text-muted-foreground py-4">No recent transactions found.</div>
                    )}
                </div>

                {/* Audit Log Dialog */}
                <Dialog open={!!selectedAuditTx} onOpenChange={(open) => !open && setSelectedAuditTx(null)}>
                    <DialogContent className="max-w-[340px] max-h-[80vh] flex flex-col rounded-3xl border-white/10 bg-card/90 backdrop-blur-xl">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <History className="w-5 h-5 text-primary" />
                                Transaction History
                            </DialogTitle>
                            <DialogDescription>
                                Timeline of changes for "{selectedAuditTx?.description}"
                            </DialogDescription>
                        </DialogHeader>
                        <ScrollArea className="flex-1 -mr-4 pr-4">
                            {loadingAudit ? (
                                <div className="py-20 flex justify-center">
                                    <WaveLoader bars={3} />
                                </div>
                            ) : auditLogs.length > 0 ? (
                                <div className="space-y-6 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-white/5 pt-4">
                                    {auditLogs.map((log) => (
                                        <div key={log.id} className="relative pl-10">
                                            <div className="absolute left-2.5 top-1 w-3.5 h-3.5 rounded-full bg-background border-2 border-primary z-10" />
                                            <div className="bg-secondary/10 rounded-2xl p-4 border border-white/5 space-y-2">
                                                <div className="flex justify-between items-start">
                                                    <span className={cn(
                                                        "text-[10px] font-bold uppercase py-0.5 px-2 rounded",
                                                        log.action === 'INSERT' ? "bg-emerald-500/20 text-emerald-500" :
                                                            log.action === 'UPDATE' ? "bg-blue-500/20 text-blue-500" : "bg-rose-500/20 text-rose-500"
                                                    )}>
                                                        {log.action}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {format(new Date(log.created_at), 'MMM d, h:mm a')}
                                                    </span>
                                                </div>
                                                <p className="text-xs font-medium">
                                                    {log.changed_by_profile?.full_name || 'System'} {log.action === 'INSERT' ? 'created this transaction' : log.action === 'UPDATE' ? 'updated this transaction' : 'deleted this transaction'}
                                                </p>
                                                {log.action === 'UPDATE' && log.old_data && log.new_data && (
                                                    <div className="text-[11px] space-y-1 pt-1 opacity-80">
                                                        {Object.keys(log.new_data).map(key => {
                                                            if (log.old_data[key] !== log.new_data[key] && !['updated_at', 'created_at'].includes(key)) {
                                                                return (
                                                                    <div key={key} className="flex flex-wrap gap-1">
                                                                        <span className="font-bold text-muted-foreground">{key}:</span>
                                                                        <span className="line-through text-rose-500/70">{JSON.stringify(log.old_data[key])}</span>
                                                                        <span>→</span>
                                                                        <span className="text-emerald-500">{JSON.stringify(log.new_data[key])}</span>
                                                                    </div>
                                                                );
                                                            }
                                                            return null;
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-10 text-muted-foreground text-sm">No history found.</div>
                            )}
                        </ScrollArea>
                    </DialogContent>
                </Dialog>
            </div>
        </div >
    );
}
