'use client';

import React, { useEffect, useState } from 'react';
import { ChevronLeft, MoreHorizontal, Filter } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer, Pie, PieChart } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/pie-chart";
import { supabase } from '@/lib/supabase';
import { format, subMonths, startOfMonth, endOfMonth, isSameMonth, parseISO, subYears } from 'date-fns';
import { WaveLoader } from '@/components/ui/wave-loader';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { useUserPreferences } from '@/components/providers/user-preferences-provider';

// Constants for consistent coloring
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
    food: { label: "Food", color: CATEGORY_COLORS.food },
    transport: { label: "Transport", color: CATEGORY_COLORS.transport },
    bills: { label: "Bills", color: CATEGORY_COLORS.bills },
    shopping: { label: "Shopping", color: CATEGORY_COLORS.shopping },
    healthcare: { label: "Healthcare", color: CATEGORY_COLORS.healthcare },
    entertainment: { label: "Entertainment", color: CATEGORY_COLORS.entertainment },
    others: { label: "Others", color: CATEGORY_COLORS.others },
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
                            <span className="font-mono font-medium">{formatCurrency(Number(entry.value))}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }
    return null;
};

type DateRange = '3M' | '6M' | '1Y' | 'ALL';

export function AnalyticsView() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [categoryTrendData, setCategoryTrendData] = useState<any[]>([]);
    const [categoryBreakdown, setCategoryBreakdown] = useState<any[]>([]);
    const [totalSpentInRange, setTotalSpentInRange] = useState(0);
    const [dateRange, setDateRange] = useState<DateRange>('6M');
    const { formatCurrency, currency, convertAmount } = useUserPreferences();
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUserId(session?.user?.id || null);
        });
    }, []);


    useEffect(() => {
        fetchData();
    }, [dateRange, currency, userId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user) return;
            setUserId(user.id);

            let query = supabase
                .from('transactions')
                .select(`
                    *,
                    splits (
                        user_id,
                        amount,
                        is_paid
                    )
                `)
                .order('date', { ascending: true });

            // Apply Date Filter
            const now = new Date();
            let startDate: Date | null = null;

            if (dateRange === '3M') startDate = startOfMonth(subMonths(now, 2)); // Current + 2 prev = 3 months
            else if (dateRange === '6M') startDate = startOfMonth(subMonths(now, 5));
            else if (dateRange === '1Y') startDate = startOfMonth(subYears(now, 1));
            // 'ALL' implies no lower bound filter

            if (startDate) {
                query = query.gte('date', startDate.toISOString());
            }

            const { data: transactions } = await query;

            if (transactions) {
                processTransactions(transactions, dateRange, user.id);
            }
        } catch (error) {
            console.error("Error fetching analytics:", error);
        } finally {
            setLoading(false);
        }
    };

    const processTransactions = (transactions: any[], range: DateRange, currentUserId: string | null) => {
        const now = new Date();

        // 1. Process Trend Data
        const monthsMap: Record<string, any> = {};

        // Determine number of months to display on X-axis
        let monthsBack = 5; // Default 6M (0 to 5)
        if (range === '3M') monthsBack = 2;
        else if (range === '1Y') monthsBack = 11;
        else if (range === 'ALL') {
            // For ALL, we don't pre-fill months, we just take what's in the data
            monthsBack = -1;
        }

        // Initialize months if not ALL
        if (monthsBack !== -1) {
            for (let i = monthsBack; i >= 0; i--) {
                const d = subMonths(now, i);
                const monthKey = format(d, 'MMM yyyy'); // Use Year too to avoid collisions in 1Y view
                monthsMap[monthKey] = { month: monthKey, rawDate: d };
                Object.keys(CATEGORY_COLORS).forEach(cat => monthsMap[monthKey][cat] = 0);
            }
        }

        // Aggregate Data
        transactions.forEach(tx => {
            const date = parseISO(tx.date);
            const monthKey = format(date, 'MMM yyyy');

            // If ALL, create entry if missing
            if (monthsBack === -1 && !monthsMap[monthKey]) {
                monthsMap[monthKey] = { month: monthKey, rawDate: date };
                Object.keys(CATEGORY_COLORS).forEach(cat => monthsMap[monthKey][cat] = 0);
            }

            if (monthsMap[monthKey]) {
                const cat = tx.category.toLowerCase();
                if (!monthsMap[monthKey][cat]) monthsMap[monthKey][cat] = 0; // Init if category new

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

                monthsMap[monthKey][cat] += convertAmount(myShare, tx.currency || 'USD');
            }
        });

        // Convert map to array and Sort by date
        const sortedTrendData = Object.values(monthsMap).sort((a: any, b: any) => a.rawDate - b.rawDate);

        // Format month label back to short format for display if needed, or keep MMM yyyy
        const displayData = sortedTrendData.map((item: any) => ({
            ...item,
            month: range === '1Y' || range === 'ALL' ? format(item.rawDate, 'MMM yy') : format(item.rawDate, 'MMM')
        }));

        setCategoryTrendData(displayData);


        // 2. Process Breakdown (Aggregate of Selected Range)
        const breakdownMap: Record<string, number> = {};
        let total = 0;

        transactions.forEach(tx => {
            const cat = tx.category.toLowerCase();

            let myShare = Number(tx.amount);
            if (tx.splits && tx.splits.length > 0) {
                if (tx.user_id === currentUserId) {
                    const othersOwe = tx.splits.reduce((sum: number, s: any) => sum + Number(s.amount), 0);
                    myShare = Number(tx.amount) - othersOwe;
                } else {
                    const mySplit = tx.splits.find((s: any) => s.user_id === currentUserId);
                    myShare = mySplit ? Number(mySplit.amount) : 0;
                }
            } else if (tx.user_id !== currentUserId) {
                myShare = 0;
            }

            if (myShare > 0) {
                const amount = convertAmount(myShare, tx.currency || 'USD');
                breakdownMap[cat] = (breakdownMap[cat] || 0) + amount;
                total += amount;
            }
        });

        setTotalSpentInRange(total);

        const breakdownData = Object.entries(breakdownMap).map(([name, amount]) => {
            const percentage = total > 0 ? (amount / total) * 100 : 0;
            return {
                name: name.charAt(0).toUpperCase() + name.slice(1),
                amount,
                value: percentage,
                color: CATEGORY_COLORS[name] || CATEGORY_COLORS.others,
                fill: CATEGORY_COLORS[name] || CATEGORY_COLORS.others,
                stroke: CATEGORY_COLORS[name] || CATEGORY_COLORS.others,
            };
        }).sort((a, b) => b.amount - a.amount);

        setCategoryBreakdown(breakdownData);
    };

    if (loading) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center min-h-[50vh]">
                <WaveLoader bars={5} message="Loading analytics..." />
            </div>
        );
    }

    return (
        <div className="p-5 space-y-6 max-w-md mx-auto relative pb-24">
            {/* Header */}
            <div className="flex items-center justify-between relative">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-full bg-secondary/30 hover:bg-secondary/50 transition-colors"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-lg font-semibold absolute left-1/2 -translate-x-1/2">Analytics</h2>
                <div className="flex items-center gap-2">
                    <Select value={dateRange} onValueChange={(val: DateRange) => setDateRange(val)}>
                        <SelectTrigger className="w-[110px] h-8 text-xs bg-secondary/20 border-white/5 rounded-full">
                            <SelectValue placeholder="Period" />
                        </SelectTrigger>
                        <SelectContent align="end">
                            <SelectItem value="3M">Last 3 Months</SelectItem>
                            <SelectItem value="6M">Last 6 Months</SelectItem>
                            <SelectItem value="1Y">Last Year</SelectItem>
                            <SelectItem value="ALL">All Time</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Monthly Spending Trend */}
            <Card className="bg-card/50 backdrop-blur-md border-white/5">
                <CardContent className="p-5 space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-sm">Spending Trend</h3>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{dateRange === 'ALL' ? 'All Time' : dateRange}</span>
                    </div>

                    <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={categoryTrendData}>
                                <XAxis
                                    dataKey="month"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                                    interval={dateRange === '1Y' || dateRange === 'ALL' ? 'preserveStartEnd' : 0}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                {Object.keys(CATEGORY_COLORS).map((cat) => (
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
                            <span className="text-[10px] text-muted-foreground">Total in Period</span>
                            <span className="text-lg font-bold">{formatCurrency(totalSpentInRange)}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Category Breakdown including Pie Chart */}
            <div className="space-y-4">
                <h3 className="font-semibold text-sm">Category Breakdown</h3>

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
                    {categoryBreakdown.map((cat) => (
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

                            <div className="flex justify-end text-[10px] text-muted-foreground">
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
        </div>
    );
}
