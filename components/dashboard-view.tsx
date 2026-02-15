'use client';

import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { BudgetAlertManager } from '@/components/budget-alert-manager';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Utensils, Car, Zap, ShoppingBag, HeartPulse, Clapperboard, CircleDollarSign, ArrowUpRight, ArrowDownLeft, Users, MoreVertical, Pencil, Trash2, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Pie, PieChart } from 'recharts';
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

// Constants
const CATEGORY_COLORS: Record<string, string> = {
    food: '#8A2BE2',      // Electric Purple
    transport: '#FF6B6B', // Coral
    bills: '#4ECDC4',     // Teal
    shopping: '#F9C74F',  // Yellow
    healthcare: '#FF9F1C', // Orange
    entertainment: '#2EC4B6', // Light Blue
    others: '#C7F464',    // Lime
};

const chartConfig: ChartConfig = {
    food: { label: "Food & Dining", color: CATEGORY_COLORS.food },
    transport: { label: "Transportation", color: CATEGORY_COLORS.transport },
    bills: { label: "Bills & Utilities", color: CATEGORY_COLORS.bills },
    shopping: { label: "Shopping", color: CATEGORY_COLORS.shopping },
    healthcare: { label: "Healthcare", color: CATEGORY_COLORS.healthcare },
    entertainment: { label: "Entertainment", color: CATEGORY_COLORS.entertainment },
    others: { label: "Others", color: CATEGORY_COLORS.others },
};

type Transaction = {
    id: string;
    description: string;
    amount: number;
    category: string;
    date: string;
    created_at: string;
    user_id: string;
    currency?: string;
    splits?: {
        user_id: string;
        amount: number;
        is_paid: boolean;
    }[];
};

type SpendingCategory = {
    name: string;
    value: number;
    color: string;
    fill: string;
};

export function DashboardView() {
    const router = useRouter();
    const [userName, setUserName] = useState<string>('User');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [userId, setUserId] = useState<string | null>(null);

    const [loading, setLoading] = useState(true);
    const { formatCurrency, currency, convertAmount, monthlyBudget, userId: providerUserId } = useUserPreferences();
    const { balances } = useGroups();

    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);

    // Sync provider userId to local state if needed, or just use it directly
    // We kept the local state 'userId' for now to minimize refactor impact, 
    // but we'll sync it.
    useEffect(() => {
        if (providerUserId) {
            setUserId(providerUserId);
        }
    }, [providerUserId]);

    const loadTransactions = async (currentUserId: string) => {
        try {
            const { data: txs } = await supabase
                .from('transactions')
                .select('*, splits(*)')
                .order('date', { ascending: false })
                .order('created_at', { ascending: false });

            if (txs) {
                setTransactions(txs);
            }
        } catch (error) {
            console.error("Error loading transactions:", error);
        }
    };

    useEffect(() => {
        async function fetchData() {
            if (!providerUserId) return; // Wait for provider to have user

            try {
                // Fetch Profile - we can probably optimize this too if provider has it, 
                // but provider only has preferences. Let's keep profile fetch for now.
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
        }
        fetchData();
    }, [providerUserId]);

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

    const isRecentUserTransaction = (tx: Transaction) => {
        if (tx.user_id !== userId) return false;
        // Get all transactions by this user, assuming 'transactions' is already sorted by date desc
        const userTxs = transactions.filter(t => t.user_id === userId);
        // Check if this tx is in the top 3
        return userTxs.slice(0, 3).some(t => t.id === tx.id);
    };

    // Calculate personal share for budget tracking
    const totalSpent = transactions.reduce((acc, tx) => {
        if (!userId) return acc;

        // Filter for current month using parseISO
        const txDate = parseISO(tx.date);
        if (!isSameMonth(txDate, new Date())) return acc;

        let myShare = Number(tx.amount);
        if (tx.splits && tx.splits.length > 0) {
            if (tx.user_id === userId) {
                const othersOwe = tx.splits.reduce((sum, s) => sum + Number(s.amount), 0);
                myShare = Number(tx.amount) - othersOwe;
            } else {
                const mySplit = tx.splits.find(s => s.user_id === userId);
                myShare = mySplit ? Number(mySplit.amount) : 0;
            }
        } else if (tx.user_id !== userId) {
            myShare = 0;
        }

        return acc + convertAmount(myShare, tx.currency || 'USD');
    }, 0);

    const remaining = monthlyBudget - totalSpent;
    const progress = Math.min((totalSpent / monthlyBudget) * 100, 100);

    // Calculate Spending by Category (converted personal share)
    const spendingByCategory = transactions.reduce((acc, tx) => {
        if (!userId) return acc;

        // Filter for current month
        const txDate = parseISO(tx.date);
        if (!isSameMonth(txDate, new Date())) return acc;

        const cat = tx.category.toLowerCase();

        let myShare = Number(tx.amount);
        if (tx.splits && tx.splits.length > 0) {
            if (tx.user_id === userId) {
                const othersOwe = tx.splits.reduce((sum, s) => sum + Number(s.amount), 0);
                myShare = Number(tx.amount) - othersOwe;
            } else {
                const mySplit = tx.splits.find(s => s.user_id === userId);
                myShare = mySplit ? Number(mySplit.amount) : 0;
            }
        } else if (tx.user_id !== userId) {
            myShare = 0;
        }

        if (myShare > 0) {
            if (!acc[cat]) acc[cat] = 0;
            acc[cat] += convertAmount(myShare, tx.currency || 'USD');
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

    return (
        <div className="p-5 space-y-6 max-w-md mx-auto relative pb-24">
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
                                            />
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
                            <ScrollArea className="flex-1 -mr-4 pr-4">
                                <div className="space-y-3 pt-4">
                                    {transactions.map((tx) => (
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
                                                    <p className="font-medium text-sm">{tx.description}</p>
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                                        <span className="px-1.5 py-0.5 rounded bg-primary/10 text-[10px] text-primary border border-primary/10 capitalize">{tx.category}</span>
                                                        <span>• {format(new Date(tx.date), 'MMM d, yyyy')}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="flex flex-col items-end">
                                                    <span className="font-bold text-sm">-{formatCurrency(Number(tx.amount), tx.currency)}</span>
                                                    {tx.splits && tx.splits.length > 0 && (
                                                        <span className="text-[9px] text-muted-foreground mt-0.5">
                                                            Split • {tx.splits.length + 1} people
                                                        </span>
                                                    )}
                                                </div>
                                                {isRecentUserTransaction(tx) && (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <button className="p-1 rounded-full hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
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
                                    ))}
                                    {transactions.length === 0 && (
                                        <div className="text-center py-8 text-muted-foreground">No transactions found.</div>
                                    )}
                                </div>
                            </ScrollArea>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="space-y-3">
                    {transactions.slice(0, 5).map((tx) => (
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
                                    <p className="font-medium text-sm">{tx.description}</p>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <span className="px-1.5 py-0.5 rounded bg-primary/10 text-[10px] text-primary capitalize">{tx.category}</span>
                                        <span>• {format(new Date(tx.date), 'MMM d')}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex flex-col items-end">
                                    <span className="font-semibold text-sm">-{formatCurrency(Number(tx.amount), tx.currency)}</span>
                                    {tx.splits && tx.splits.length > 0 && (
                                        <span className="text-[9px] text-muted-foreground mt-0.5">
                                            Split
                                        </span>
                                    )}
                                </div>
                                {isRecentUserTransaction(tx) && (
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button className="p-1 rounded-full hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
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
                    ))}
                    {transactions.length === 0 && (
                        <div className="text-center text-xs text-muted-foreground py-4">No recent transactions found.</div>
                    )}
                </div>
            </div>
        </div>
    );
}
