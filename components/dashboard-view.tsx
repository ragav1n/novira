'use client';

import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, LogOut, Utensils, Car, Zap, ShoppingBag, HeartPulse, Clapperboard, CircleDollarSign } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Pie, PieChart } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/pie-chart";
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { WaveLoader } from '@/components/ui/wave-loader';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"

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
    icon?: string; // Derived for display
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
    const [budget, setBudget] = useState<number>(3000);
    const [transactions, setTransactions] = useState<Transaction[]>([]);

    const [loading, setLoading] = useState(true);
    const { formatCurrency, currency } = useUserPreferences();

    useEffect(() => {
        async function fetchData() {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;

                // Fetch Profile
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name, monthly_budget')
                    .eq('id', user.id)
                    .single();

                if (profile) {
                    setUserName(profile.full_name || user.email?.split('@')[0] || 'User');
                    setBudget(profile.monthly_budget || 3000);
                }

                // Fetch Transactions
                const { data: txs, error } = await supabase
                    .from('transactions')
                    .select('*')
                    .order('date', { ascending: false })
                    .order('created_at', { ascending: false });

                if (txs) {
                    setTransactions(txs);
                }
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    // Calculate totals
    const totalSpent = transactions.reduce((acc, tx) => acc + Number(tx.amount), 0);
    const remaining = budget - totalSpent;
    const progress = Math.min((totalSpent / budget) * 100, 100);

    // Calculate Spending by Category
    const spendingByCategory = transactions.reduce((acc, tx) => {
        const cat = tx.category.toLowerCase();
        if (!acc[cat]) acc[cat] = 0;
        acc[cat] += Number(tx.amount);
        return acc;
    }, {} as Record<string, number>);

    const spendingData: SpendingCategory[] = Object.entries(spendingByCategory).map(([cat, value]) => ({
        name: cat.charAt(0).toUpperCase() + cat.slice(1),
        value,
        color: CATEGORY_COLORS[cat] || CATEGORY_COLORS.others,
        fill: CATEGORY_COLORS[cat] || CATEGORY_COLORS.others,
    }));

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/signin');
    };

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

    const getEmojiForCategory = (category: string) => {
        switch (category.toLowerCase()) {
            case 'food': return '🍔';
            case 'transport': return '🚗';
            case 'bills': return '💡';
            case 'shopping': return '🛍️';
            case 'healthcare': return '🏥';
            case 'entertainment': return '🎬';
            default: return '💸';
        }
    }


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
                <div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/80">
                        Hello, {userName}! 👋
                    </h1>
                    <p className="text-sm text-muted-foreground">Track your expenses wisely</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSignOut}
                        className="w-10 h-10 rounded-full bg-secondary/20 hover:bg-secondary/30 flex items-center justify-center border border-white/5 transition-colors"
                    >
                        <LogOut className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button
                        onClick={() => router.push('/add')}
                        className="w-10 h-10 rounded-full bg-primary/20 hover:bg-primary/30 flex items-center justify-center border border-primary/20 transition-colors"
                    >
                        <Plus className="w-5 h-5 text-primary" />
                    </button>
                </div>
            </div>

            {/* Total Spent Card */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#8A2BE2] to-[#4B0082] p-6 shadow-xl shadow-primary/20">
                <div className="absolute top-0 right-0 p-6 opacity-10">
                    <span className="text-9xl font-bold text-white">{currency === 'EUR' ? '€' : '$'}</span>
                </div>

                <div className="relative z-10 space-y-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-white/80 text-sm font-medium">Total Spent This Month</p>
                            <h2 className="text-4xl font-bold text-white mt-1">{formatCurrency(totalSpent)}</h2>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                            <span className="text-xl font-bold text-white">{currency === 'EUR' ? '€' : '$'}</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-medium text-white/80">
                            <span>Budget: {formatCurrency(budget)}</span>
                            <span>Remaining: {formatCurrency(remaining)}</span>
                        </div>
                        <Progress value={progress} className="h-2 bg-black/30" indicatorClassName="bg-white" />
                        <div className="flex justify-between text-[10px] text-white/60">
                            <span>{progress.toFixed(1)}% used</span>
                            {/* Simple generic message or date calc */}
                            <span>{new Date().getDate()}th of Month</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Spending by Category */}
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold">Spending by Category</h3>
                    <span className="text-xs bg-secondary/30 px-3 py-1 rounded-full text-primary border border-primary/20">Current Month</span>
                </div>

                <Card className="border-none bg-card/40 backdrop-blur-md shadow-none">
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                        {/* Chart Circle */}
                        {spendingData.length > 0 ? (
                            <>
                                <div className="w-32 h-32 relative flex-shrink-0">
                                    <ChartContainer
                                        config={chartConfig}
                                        className="mx-auto aspect-square max-h-[250px]"
                                    >
                                        <PieChart>
                                            <ChartTooltip
                                                cursor={false}
                                                content={<ChartTooltipContent hideLabel />}
                                            />
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

                                {/* Legend */}
                                <div className="flex-1 space-y-3">
                                    {spendingData.map((item) => (
                                        <div key={item.name} className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                                <span className="text-foreground/80">{item.name}</span>
                                            </div>
                                            <div className="flex flex-col items-end">
                                                <span className="font-semibold">{formatCurrency(item.value)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="w-full text-center py-8 text-muted-foreground text-sm">
                                No expenses yet. Click + to add one!
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
                                <DialogDescription>
                                    History of all your expenses.
                                </DialogDescription>
                            </DialogHeader>
                            <ScrollArea className="flex-1 -mr-4 pr-4">
                                <div className="space-y-3 pt-4">
                                    {transactions.map((tx) => (
                                        <div key={tx.id} className="flex items-center justify-between p-3 rounded-2xl bg-card/20 border border-white/5 hover:bg-card/40 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center border border-white/5">
                                                    {getIconForCategory(tx.category)}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm">{tx.description}</p>
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                                        <span className="px-1.5 py-0.5 rounded bg-primary/10 text-[10px] text-primary border border-primary/10 capitalize">{tx.category}</span>
                                                        <span>• {format(new Date(tx.date), 'MMM d, yyyy')}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <span className="font-bold text-sm">-{formatCurrency(Number(tx.amount))}</span>
                                        </div>
                                    ))}
                                    {transactions.length === 0 && (
                                        <div className="text-center py-8 text-muted-foreground">
                                            No transactions found.
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="space-y-3">
                    {transactions.slice(0, 5).map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between p-3 rounded-2xl bg-card/30 border border-white/5 hover:bg-card/50 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center text-lg">
                                    {getEmojiForCategory(tx.category)}
                                </div>
                                <div>
                                    <p className="font-medium text-sm">{tx.description}</p>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <span className="px-1.5 py-0.5 rounded bg-primary/10 text-[10px] text-primary capitalize">{tx.category}</span>
                                        <span>• {format(new Date(tx.date), 'MMM d')}</span>
                                    </div>
                                </div>
                            </div>
                            <span className="font-semibold text-sm">-{formatCurrency(Number(tx.amount))}</span>
                        </div>
                    ))}
                    {transactions.length === 0 && (
                        <div className="text-center text-xs text-muted-foreground py-4">
                            No recent transactions found.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
