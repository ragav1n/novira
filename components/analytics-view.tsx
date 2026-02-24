'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { ChevronLeft, MoreHorizontal, Filter, Shirt } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer, Pie, PieChart, Cell } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/pie-chart";
import { supabase } from '@/lib/supabase';
import { format, subMonths, startOfMonth, endOfMonth, isSameMonth, parseISO, subYears } from 'date-fns';
import { WaveLoader } from '@/components/ui/wave-loader';
import { AnimatePresence, motion } from 'framer-motion';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { useBuckets } from '@/components/providers/buckets-provider';
import {
    Tag, Plane, Home, Gift, Car, Utensils, ShoppingCart,
    Heart, Gamepad2, School, Laptop, Music
} from 'lucide-react';

// Constants for consistent coloring
const CATEGORY_COLORS: Record<string, string> = {
    food: '#8B5CF6',      // Violet
    groceries: '#10B981', // Emerald
    fashion: '#F472B6',   // Hot Pink
    transport: '#3B82F6', // Blue
    bills: '#06B6D4',     // Cyan
    shopping: '#F59E0B',  // Amber
    healthcare: '#EF4444', // Red
    entertainment: '#EC4899', // Pink
    rent: '#6366F1',       // Bright Indigo
    education: '#84CC16',  // Bright Lime
    others: '#2DD4BF',    // Mint
    uncategorized: '#6366F1', // Indigo
};

const chartConfig: ChartConfig = {
    food: { label: "Food", color: CATEGORY_COLORS.food },
    groceries: { label: "Groceries", color: CATEGORY_COLORS.groceries },
    fashion: { label: "Fashion", color: CATEGORY_COLORS.fashion },
    transport: { label: "Transport", color: CATEGORY_COLORS.transport },
    bills: { label: "Bills", color: CATEGORY_COLORS.bills },
    shopping: { label: "Shopping", color: CATEGORY_COLORS.shopping },
    healthcare: { label: "Healthcare", color: CATEGORY_COLORS.healthcare },
    entertainment: { label: "Entertainment", color: CATEGORY_COLORS.entertainment },
    rent: { label: "Rent", color: CATEGORY_COLORS.rent },
    education: { label: "Education", color: CATEGORY_COLORS.education },
    others: { label: "Others", color: CATEGORY_COLORS.others },
    uncategorized: { label: "Uncategorized", color: CATEGORY_COLORS.uncategorized },
};

const PAYMENT_COLORS: Record<string, string> = {
    cash: '#22C55E',          // Vibrant Green
    'debit card': '#3B82F6',  // Bright Blue
    'credit card': '#A855F7', // Vivid Purple
    upi: '#F59E0B',           // Bright Amber
    'bank transfer': '#06B6D4', // Bright Cyan
    other: '#EC4899',         // Hot Pink
};

const paymentChartConfig: ChartConfig = {
    cash: { label: "Cash", color: PAYMENT_COLORS.cash },
    'debit card': { label: "Debit Card", color: PAYMENT_COLORS['debit card'] },
    'credit card': { label: "Credit Card", color: PAYMENT_COLORS['credit card'] },
    upi: { label: "UPI", color: PAYMENT_COLORS.upi },
    'bank transfer': { label: "Bank Transfer", color: PAYMENT_COLORS['bank transfer'] },
    other: { label: "Other", color: PAYMENT_COLORS.other },
};

// Custom Tooltip Component
// Custom Tooltip Component needs access to context, but it's outside component. passing formatter?
// Or better, define CustomTooltip inside, or pass it as prop?
// Recharts tooltip content can be a function. 
// Let's refactor CustomTooltip to be defined inside AnalyticsView or accept formatter.
// Actually, for simplicity I will just update the CustomTooltip definition to use a context consumer or passing props is hard with Recharts sometimes.
// I'll move CustomTooltip into the component or use a wrapper.
// Moving CustomTooltip inside AnalyticsView might be performance heavy if it re-renders.
// I'll update the component to accept a formatter prop if I can, but Recharts cloning might block it.
// Easiest is to just use the raw symbol if I can't easily pass the function.
// Wait, I can just use the hook if I make CustomTooltip a component that uses the hook?
// Yes, CustomTooltip is a component.
const CustomTooltip = ({ active, payload, label }: any) => {
    const { formatCurrency } = useUserPreferences();
    if (active && payload && payload.length) {
        return (
            <div className="bg-card/90 backdrop-blur-md border border-white/10 p-3 rounded-xl shadow-xl">
                <p className="text-sm font-bold mb-2 text-foreground">{label}</p>
                <div className="space-y-1">
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center gap-2 text-xs">
                            <div
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: entry.stroke || entry.color || entry.fill }}
                            />
                            <span className="text-muted-foreground capitalize">{entry.name}:</span>
                            <span className="font-mono font-medium">{formatCurrency(Math.round(Number(entry.value)))}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};

type Transaction = {
    amount: number;
    category: string;
    date: string;
    payment_method?: string;
    currency?: string;
    exchange_rate?: number;
    base_currency?: string;
    user_id: string;
    bucket_id?: string;
    splits?: {
        user_id: string;
        amount: number;
    }[];
};

type DateRange = '1M' | 'LM' | '3M' | '6M' | '1Y' | 'ALL';

export function AnalyticsView() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [dateRange, setDateRange] = useState<DateRange>('1M');
    const [selectedBucketId, setSelectedBucketId] = useState<string | 'all'>('all');
    const { formatCurrency, currency, convertAmount, userId } = useUserPreferences();

    const getBucketIcon = (iconName?: string) => {
        const icons: Record<string, any> = {
            Tag, Plane, Home, Gift, Car, Utensils, ShoppingCart,
            Heart, Gamepad2, School, Laptop, Music, Shirt
        };
        const Icon = icons[iconName || 'Tag'] || Tag;
        return <Icon className="w-full h-full" />;
    };

    const { buckets } = useBuckets();

    useEffect(() => {
        if (userId) {
            fetchData();
        }
    }, [dateRange, currency, userId, selectedBucketId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (!userId) return;

            let query = supabase
                .from('transactions')
                .select(`
                    amount, category, date, payment_method, currency, exchange_rate, base_currency, user_id, bucket_id,
                    splits (
                        user_id,
                        amount
                    )
                `)
                .order('date', { ascending: true });

            if (selectedBucketId !== 'all') {
                query = query.eq('bucket_id', selectedBucketId);
            }

            // Apply Date Filter
            const now = new Date();
            let startDate: Date | null = null;

            if (dateRange === '1M') startDate = startOfMonth(now);
            else if (dateRange === 'LM') {
                startDate = startOfMonth(subMonths(now, 1));
                // For LM we need an upper bound too, as it shouldn't include current month
                query = query.lt('date', startOfMonth(now).toISOString());
            }
            else if (dateRange === '3M') startDate = startOfMonth(subMonths(now, 2)); // Current + 2 prev = 3 months
            else if (dateRange === '6M') startDate = startOfMonth(subMonths(now, 5));
            else if (dateRange === '1Y') startDate = startOfMonth(subYears(now, 1));
            // 'ALL' implies no lower bound filter

            if (startDate) {
                query = query.gte('date', startDate.toISOString());
            }

            const { data } = await query;

            if (data) {
                // Flatten splits if they are arrays
                const formatted = data.map(tx => ({
                    ...tx,
                    splits: tx.splits || []
                }));
                setTransactions(formatted);
            }
        } catch (error) {
            console.error("Error fetching analytics:", error);
        } finally {
            setLoading(false);
        }
    };

    const { categoryTrendData, categoryBreakdown, paymentBreakdown, totalSpentInRange } = useMemo(() => {
        if (!transactions.length || !userId) return {
            categoryTrendData: [],
            categoryBreakdown: [],
            paymentBreakdown: [],
            totalSpentInRange: 0
        };

        const now = new Date();
        const monthsMap: Record<string, any> = {};

        // 1. Process Trend Data Initialization
        let monthsBack = 5;
        if (dateRange === '1M' || dateRange === 'LM') monthsBack = -2;
        else if (dateRange === '3M') monthsBack = 2;
        else if (dateRange === '6M') monthsBack = 5;
        else if (dateRange === '1Y') monthsBack = 11;
        else if (dateRange === 'ALL') monthsBack = -1;

        if (monthsBack !== -1 && monthsBack !== -2) {
            for (let i = monthsBack; i >= 0; i--) {
                const d = subMonths(now, i);
                const monthKey = format(d, 'MMM yyyy');
                monthsMap[monthKey] = { month: monthKey, rawDate: d };
                Object.keys(CATEGORY_COLORS).forEach(cat => monthsMap[monthKey][cat] = 0);
            }
        }

        if (monthsBack === -2) {
            const start = dateRange === 'LM' ? startOfMonth(subMonths(now, 1)) : startOfMonth(now);
            const endRange = endOfMonth(start);
            let current = new Date(start);
            while (current <= endRange) {
                const dayKey = format(current, 'd MMM');
                monthsMap[dayKey] = { month: dayKey, rawDate: new Date(current) };
                Object.keys(CATEGORY_COLORS).forEach(cat => monthsMap[dayKey][cat] = 0);
                current.setDate(current.getDate() + 1);
            }
        }

        // 2. Aggregate Data and Breakdown
        const breakdownMap: Record<string, number> = {};
        const paymentMap: Record<string, number> = {};
        let total = 0;

        transactions.forEach((tx: Transaction) => {
            const date = parseISO(tx.date);
            const timeKey = monthsBack === -2 ? format(date, 'd MMM') : format(date, 'MMM yyyy');
            const cat = tx.category.toLowerCase();

            if (monthsBack === -1 && !monthsMap[timeKey]) {
                monthsMap[timeKey] = { month: timeKey, rawDate: date };
                Object.keys(CATEGORY_COLORS).forEach(c => monthsMap[timeKey][c] = 0);
            }

            let myShare = Number(tx.amount);
            if (tx.splits && tx.splits.length > 0) {
                if (tx.user_id === userId) {
                    const othersOwe = tx.splits.reduce((sum: number, s: any) => sum + Number(s.amount), 0);
                    myShare = Number(tx.amount) - othersOwe;
                } else {
                    const mySplit = tx.splits.find((s: any) => s.user_id === userId);
                    myShare = mySplit ? Number(mySplit.amount) : 0;
                }
            } else if (tx.user_id !== userId) {
                myShare = 0;
            }

            if (myShare > 0) {
                let amount = 0;
                if (tx.exchange_rate && tx.base_currency === currency) {
                    amount = (myShare * Number(tx.exchange_rate));
                } else {
                    amount = convertAmount(myShare, tx.currency || 'USD');
                }

                if (monthsMap[timeKey]) {
                    if (!monthsMap[timeKey][cat]) monthsMap[timeKey][cat] = 0;
                    monthsMap[timeKey][cat] += amount;
                }

                breakdownMap[cat] = (breakdownMap[cat] || 0) + amount;
                const method = (tx.payment_method || 'Other').toLowerCase();
                paymentMap[method] = (paymentMap[method] || 0) + amount;
                total += amount;
            }
        });

        // 3. Finalize Trend Data
        const sortedTrendData = Object.values(monthsMap).sort((a: any, b: any) => a.rawDate - b.rawDate);
        const displayTrendData = sortedTrendData.map((item: any) => ({
            ...item,
            month: dateRange === '1Y' || dateRange === 'ALL'
                ? format(item.rawDate, 'MMM yy')
                : (dateRange === '1M' || dateRange === 'LM' ? format(item.rawDate, 'MMM d') : format(item.rawDate, 'MMM'))
        }));

        // 4. Finalize Breakdowns
        const breakdownData = Object.entries(breakdownMap).map(([name, amount]: [string, number]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            amount,
            value: total > 0 ? (amount / total) * 100 : 0,
            color: CATEGORY_COLORS[name] || CATEGORY_COLORS.others,
            fill: CATEGORY_COLORS[name] || CATEGORY_COLORS.others,
            stroke: CATEGORY_COLORS[name] || CATEGORY_COLORS.others,
        })).sort((a, b) => b.amount - a.amount);

        const paymentData = Object.entries(paymentMap).map(([name, amount]: [string, number]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            amount,
            value: total > 0 ? (amount / total) * 100 : 0,
            color: PAYMENT_COLORS[name] || PAYMENT_COLORS.other,
            fill: PAYMENT_COLORS[name] || PAYMENT_COLORS.other,
            stroke: PAYMENT_COLORS[name] || PAYMENT_COLORS.other,
        })).sort((a, b) => b.amount - a.amount);

        return {
            categoryTrendData: displayTrendData,
            categoryBreakdown: breakdownData,
            paymentBreakdown: paymentData,
            totalSpentInRange: total
        };
    }, [transactions, userId, dateRange, currency, convertAmount]);


    return (
        <div className="relative min-h-screen">
            <AnimatePresence>
                {loading && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-background/20 backdrop-blur-[2px]"
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: 'rgba(12, 8, 30, 0.2)',
                            backdropFilter: 'blur(2px)',
                            zIndex: 50
                        }}
                    >
                        <WaveLoader bars={5} message="" />
                    </motion.div>
                )}
            </AnimatePresence>

            <div className={cn(
                "p-5 space-y-6 max-w-md mx-auto relative transition-all duration-300",
                loading ? "opacity-40 blur-[1px] pointer-events-none" : "opacity-100 blur-0"
            )}>
                {/* Header */}
                {/* Header */}
                <div className="flex items-center justify-between relative min-h-[40px]">
                    <button
                        onClick={() => router.back()}
                        className="p-1.5 rounded-full bg-secondary/30 hover:bg-secondary/50 transition-colors shrink-0 z-10"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <h2 className="text-lg font-semibold truncate text-center leading-tight">Analytics</h2>
                    </div>
                    <div className="w-9 shrink-0 z-10" />
                </div>

                {/* Filters Row */}
                <div className="flex items-center justify-center gap-2 px-1">
                    <Select value={selectedBucketId} onValueChange={(val) => setSelectedBucketId(val)}>
                        <SelectTrigger className="flex-1 min-w-0 max-w-[160px] px-3 h-9 text-[12px] bg-cyan-500/10 border-cyan-500/20 text-cyan-500 rounded-xl font-medium">
                            <SelectValue placeholder="All Spending" />
                        </SelectTrigger>
                        <SelectContent align="center">
                            <SelectItem value="all">All Spending</SelectItem>
                            {buckets.map(b => (
                                <SelectItem key={b.id} value={b.id}>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 flex items-center justify-center">
                                            {getBucketIcon(b.icon)}
                                        </div>
                                        <span>{b.name}</span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={dateRange} onValueChange={(val: DateRange) => setDateRange(val)}>
                        <SelectTrigger className="flex-1 min-w-0 max-w-[140px] px-3 h-9 text-[12px] bg-secondary/20 border-white/5 rounded-xl font-medium">
                            <SelectValue placeholder="Period" />
                        </SelectTrigger>
                        <SelectContent align="center">
                            <SelectItem value="1M">Current Month</SelectItem>
                            <SelectItem value="LM">Last Month</SelectItem>
                            <SelectItem value="3M">Last 3 Months</SelectItem>
                            <SelectItem value="6M">Last 6 Months</SelectItem>
                            <SelectItem value="1Y">Last Year</SelectItem>
                            <SelectItem value="ALL">All Time</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Bucket Progress Highlight */}
                {selectedBucketId !== 'all' && buckets.find(b => b.id === selectedBucketId) && (
                    <Card className="bg-cyan-500/10 border-cyan-500/20 shadow-[0_0_20px_rgba(6,182,212,0.05)]">
                        <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 flex items-center justify-center text-cyan-500 border border-cyan-500/20">
                                    {getBucketIcon(buckets.find(b => b.id === selectedBucketId)?.icon)}
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-cyan-500">{buckets.find(b => b.id === selectedBucketId)?.name}</h4>
                                    <p className="text-[11px] text-cyan-500/60 font-bold uppercase tracking-widest">Targeted View</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[11px] text-cyan-500/60 font-bold uppercase tracking-widest">Budget Remaining</p>
                                <p className="text-sm font-bold text-cyan-500">
                                    {formatCurrency(Number(buckets.find(b => b.id === selectedBucketId)?.budget || 0) - totalSpentInRange)}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Monthly Spending Trend */}
                <Card className="bg-card/50 backdrop-blur-md border-white/5">
                    <CardContent className="p-5 space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-semibold text-sm">Spending Trend</h3>
                            <span className="text-[11px] text-muted-foreground uppercase tracking-wider">{dateRange === 'ALL' ? 'All Time' : dateRange}</span>
                        </div>

                        <div className="h-48 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={categoryTrendData}>
                                    <XAxis
                                        dataKey="month"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 11 }}
                                        interval={dateRange === '1M' || dateRange === 'LM' ? 3 : (dateRange === '1Y' || dateRange === 'ALL' ? 'preserveStartEnd' : 0)}
                                        tickFormatter={(value) => {
                                            if (dateRange === '1M' || dateRange === 'LM') {
                                                const parts = value.split(' ');
                                                return parts.length === 2 ? parts[1] : value;
                                            }
                                            return value;
                                        }}
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    {Object.keys(CATEGORY_COLORS).map((cat: string) => (
                                        <Line
                                            key={cat}
                                            type="monotone"
                                            dataKey={cat}
                                            stroke={CATEGORY_COLORS[cat]}
                                            strokeWidth={2}
                                            dot={false}
                                            connectNulls
                                        />
                                    ))}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="text-[11px] text-muted-foreground">Total in Period</span>
                                <span className="text-lg font-bold">{formatCurrency(totalSpentInRange)}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Category Breakdown including Pie Chart */}
                <div className="space-y-4">
                    <h3 className="font-semibold text-sm">Spending by Category</h3>

                    {/* Pie Chart Integration */}
                    <div className="h-[250px] w-full">
                        {categoryBreakdown.length > 0 ? (
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
                                        data={categoryBreakdown}
                                        dataKey="amount"
                                        nameKey="name"
                                        innerRadius={60}
                                        strokeWidth={0}
                                        paddingAngle={5}
                                        cornerRadius={5}
                                    >
                                        {categoryBreakdown.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ChartContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                No data for this period
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        {categoryBreakdown.map((cat: any) => (
                            <div key={cat.name} className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.fill }} />
                                        {cat.name}
                                    </span>
                                    <span className="font-semibold">{formatCurrency(cat.amount)}</span>
                                </div>

                                {/* Simple Progress Bar */}
                                <div className="h-2 w-full bg-secondary/20 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{ width: `${cat.value}%`, backgroundColor: cat.fill }}
                                    />
                                </div>

                                <div className="flex justify-end text-[11px] text-muted-foreground">
                                    <span>{cat.value.toFixed(1)}%</span>
                                </div>
                            </div>
                        ))}
                        {categoryBreakdown.length === 0 && (
                            <div className="text-center text-xs text-muted-foreground">
                                No transactions recorded.
                            </div>
                        )}
                    </div>
                </div>

                {/* Payment Methods Breakdown */}
                <div className="space-y-4 pt-4 border-t border-white/5">
                    <h3 className="font-semibold text-sm text-foreground">Spending by Payment Method</h3>

                    <div className="h-[250px] w-full">
                        {paymentBreakdown.length > 0 ? (
                            <ChartContainer
                                config={paymentChartConfig}
                                className="mx-auto aspect-square max-h-[250px]"
                            >
                                <PieChart>
                                    <ChartTooltip
                                        cursor={false}
                                        content={<ChartTooltipContent hideLabel />}
                                    />
                                    <Pie
                                        data={paymentBreakdown}
                                        dataKey="amount"
                                        nameKey="name"
                                        innerRadius={60}
                                        strokeWidth={0}
                                        paddingAngle={5}
                                        cornerRadius={5}
                                    >
                                        {paymentBreakdown.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ChartContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                                No payment data for this period
                            </div>
                        )}
                    </div>

                    <div className={cn(
                        "grid gap-4",
                        paymentBreakdown.length === 1 ? "grid-cols-1" : "grid-cols-2"
                    )}>
                        {paymentBreakdown.map((pay: any) => (
                            <div key={pay.name} className="flex flex-col p-4 rounded-3xl bg-secondary/5 border border-white/5 hover:bg-secondary/10 transition-colors group">
                                <span className="flex items-center gap-2 text-[11px] text-muted-foreground uppercase tracking-widest font-bold">
                                    <div className="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.2)]" style={{ backgroundColor: pay.fill }} />
                                    {pay.name}
                                </span>
                                <div className="flex items-baseline gap-1 mt-2">
                                    <span className="text-base font-bold text-foreground">{formatCurrency(pay.amount)}</span>
                                </div>
                                <div className="flex items-center justify-between mt-1">
                                    <span className="text-[11px] text-muted-foreground font-medium">{pay.value.toFixed(0)}%</span>
                                    <div className="h-1 flex-1 mx-2 bg-secondary/20 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-1000"
                                            style={{ width: `${pay.value}%`, backgroundColor: pay.fill }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
