'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { ChevronLeft, MoreHorizontal, Filter, Shirt } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { ChartConfig, BasePieChart } from "@/components/charts/base-pie-chart";
import { TransactionService } from '@/lib/services/transaction-service';
import { CHART_CONFIG, CATEGORY_COLORS, getIconForCategory } from '@/lib/categories';
import { format, startOfMonth, endOfMonth, subMonths, subYears, isSameMonth, parseISO } from 'date-fns';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { useBuckets } from '@/components/providers/buckets-provider';
import { useGroups } from '@/components/providers/groups-provider';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { WaveLoader } from '@/components/ui/wave-loader';
import { AnimatePresence, motion } from 'framer-motion';
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Transaction } from '@/types/transaction';



const PAYMENT_COLORS: Record<string, string> = {
    cash: '#22C55E',          // Vibrant Green
    'debit card': '#3B82F6',  // Bright Blue
    'credit card': '#A855F7', // Vivid Purple
    upi: '#F59E0B',           // Bright Amber
    'bank transfer': '#06B6D4', // Bright Cyan
    other: '#EC4899',         // Hot Pink
};

const paymentChartConfig: any = {
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



import { supabase } from '@/lib/supabase';

type DateRange = '1M' | 'LM' | '3M' | '6M' | '1Y' | 'ALL';

export function AnalyticsView() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [dateRange, setDateRange] = useState<DateRange>('1M');
    const [selectedBucketId, setSelectedBucketId] = useState<string | 'all'>('all');
    const { formatCurrency, currency, convertAmount, userId, activeWorkspaceId } = useUserPreferences();
    const { groups } = useGroups();
    
    const activeWorkspace = useMemo(() => 
        activeWorkspaceId && activeWorkspaceId !== 'personal' 
            ? groups.find((g: any) => g.id === activeWorkspaceId) 
            : null
    , [activeWorkspaceId, groups]);

    const themeConfig = useMemo(() => {
        if (activeWorkspace?.type === 'couple') {
            return {
                text: 'text-rose-500',
                textOpacity: 'text-rose-500/60',
                bgLight: 'bg-rose-500/10',
                bgMedium: 'bg-rose-500/20',
                borderLight: 'border-rose-500/10',
                borderMedium: 'border-rose-500/20',
                shadowGlow: 'shadow-[0_0_20px_rgba(244,63,94,0.05)]',
            }
        } else if (activeWorkspace?.type === 'home') {
            return {
                text: 'text-amber-500',
                textOpacity: 'text-amber-500/60',
                bgLight: 'bg-amber-500/10',
                bgMedium: 'bg-amber-500/20',
                borderLight: 'border-amber-500/10',
                borderMedium: 'border-amber-500/20',
                shadowGlow: 'shadow-[0_0_20px_rgba(245,158,11,0.05)]',
            }
        }
        return {
            text: 'text-cyan-500',
            textOpacity: 'text-cyan-500/60',
            bgLight: 'bg-cyan-500/10',
            bgMedium: 'bg-cyan-500/20',
            borderLight: 'border-cyan-500/10',
            borderMedium: 'border-cyan-500/20',
            shadowGlow: 'shadow-[0_0_20px_rgba(6,182,212,0.05)]',
        }
    }, [activeWorkspace]);

    // getIconForCategory is now imported from lib/categories.ts
    const getBucketIcon = (iconName?: string) => {
        const iconElement = getIconForCategory(iconName || 'Tag');
        return React.cloneElement(iconElement as React.ReactElement<any>, { className: "w-full h-full" });
    };

    const { buckets } = useBuckets();

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            if (!userId) return;

            // Apply Date Filter
            const now = new Date();
            let startDate: Date | null = null;
            let endDate: Date | null = null;

            if (dateRange === '1M') startDate = startOfMonth(now);
            else if (dateRange === 'LM') {
                startDate = startOfMonth(subMonths(now, 1));
                endDate = startOfMonth(now);
            }
            else if (dateRange === '3M') startDate = startOfMonth(subMonths(now, 2));
            else if (dateRange === '6M') startDate = startOfMonth(subMonths(now, 5));
            else if (dateRange === '1Y') startDate = startOfMonth(subYears(now, 1));

            const data = await TransactionService.getTransactions({
                userId,
                workspaceId: activeWorkspaceId,
                bucketId: selectedBucketId === 'all' ? undefined : selectedBucketId,
                startDate: startDate?.toISOString(),
                endDate: endDate?.toISOString()
            });

            if (data) {
                setTransactions(data as any);
            }
        } catch (error) {
            console.error("Error fetching analytics:", error);
        } finally {
            setLoading(false);
        }
    }, [userId, activeWorkspaceId, dateRange, selectedBucketId]);

    useEffect(() => {
        if (userId) {
            fetchData();
        }
    }, [fetchData, userId, currency]);

    // Real-time subscription for transactions
    useEffect(() => {
        if (!userId) return;

        const channel = supabase
            .channel(`analytics-updates-${userId}-${activeWorkspaceId || 'personal'}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'transactions'
            }, () => {
                fetchData();
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'splits'
            }, () => {
                fetchData();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId, activeWorkspaceId, fetchData]);

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
            // Use string slicing instead of parseISO for grouping dates
            // tx.date is ISO string: "2026-03-01T14:30:00Z"
            // slice(0, 10) gives "YYYY-MM-DD"
            // slice(0, 7) gives "YYYY-MM"
            let timeKey = '';
            
            if (dateRange === '1M' || dateRange === 'LM') {
                // We need day-level groupings for short ranges
                // Reconstruct to 'd MMM' (e.g., "1 Mar") using lightweight Date just for the matched string
                const d = new Date(tx.date.slice(0, 10));
                timeKey = format(d, 'd MMM');
            } else {
                // For long ranges, group by month
                const yyyymm = tx.date.slice(0, 7);
                // Convert "2026-03" to "Mar 2026" safely
                const m = parseInt(yyyymm.slice(5, 7), 10);
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                timeKey = `${monthNames[m - 1]} ${yyyymm.slice(0, 4)}`;
            }
            
            const cat = tx.category.toLowerCase();

            if (monthsBack === -1 && !monthsMap[timeKey]) {
                // Create dummy date for sorting purposes if all time
                monthsMap[timeKey] = { month: timeKey, rawDate: new Date(tx.date.slice(0, 10)) };
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

    const categorizedBreakdown = categoryBreakdown as Array<{
        name: string;
        amount: number;
        value: number;
        fill: string;
    }>;

    const categorizedPayment = paymentBreakdown as Array<{
        name: string;
        amount: number;
        value: number;
        fill: string;
    }>;


    return (
        <motion.div 
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="relative min-h-screen"
        >


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
                        <SelectTrigger className={`flex-1 min-w-0 max-w-[160px] px-3 h-9 text-[12px] rounded-xl font-medium ${themeConfig.bgLight} ${themeConfig.borderMedium} ${themeConfig.text}`}>
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
                    <Card className={`${themeConfig.bgLight} ${themeConfig.borderMedium} ${themeConfig.shadowGlow}`}>
                        <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${themeConfig.bgMedium} ${themeConfig.text} ${themeConfig.borderMedium}`}>
                                    {getBucketIcon(buckets.find(b => b.id === selectedBucketId)?.icon)}
                                </div>
                                <div>
                                    <h4 className={`text-sm font-bold ${themeConfig.text}`}>{buckets.find(b => b.id === selectedBucketId)?.name}</h4>
                                    <p className={`text-[11px] font-bold uppercase tracking-widest ${themeConfig.textOpacity}`}>Targeted View</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className={`text-[11px] font-bold uppercase tracking-widest ${themeConfig.textOpacity}`}>Budget Remaining</p>
                                <p className={`text-sm font-bold ${themeConfig.text}`}>
                                    {formatCurrency(Number(buckets.find(b => b.id === selectedBucketId)?.budget || 0) - totalSpentInRange)}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Monthly Spending Trend */}
                <Card className="bg-card/40 backdrop-blur-md border-white/5 shadow-none">
                    <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-[13px] uppercase tracking-wider text-muted-foreground/80">Spending Trend</h3>
                            <span className="text-[10px] bg-secondary/30 px-2 py-0.5 rounded-md text-muted-foreground font-bold">{dateRange === 'ALL' ? 'All Time' : dateRange}</span>
                        </div>

                        <div className="h-[140px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={categoryTrendData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                                    <XAxis
                                        dataKey="month"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
                                        interval={dateRange === '1M' || dateRange === 'LM' ? 3 : (dateRange === '1Y' || dateRange === 'ALL' ? 'preserveStartEnd' : 0)}
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

                        <div className="flex items-center justify-between pt-2 border-t border-white/5">
                            <span className="text-[11px] text-muted-foreground uppercase tracking-widest font-bold">Total Spent</span>
                            <span className="text-base font-bold">{formatCurrency(totalSpentInRange)}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Category Breakdown including Pie Chart */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80">
                            Spending by Category
                        </span>
                    </div>
                    <Card className="bg-card/40 border-none shadow-none backdrop-blur-md overflow-hidden">
                        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-start gap-6">
                            <div className="w-36 h-36 relative flex-shrink-0">
                                {categoryBreakdown.length > 0 ? (
                                    <BasePieChart 
                                        data={categoryBreakdown} 
                                        config={CHART_CONFIG} 
                                        innerRadius={46}
                                        outerRadius={68}
                                        hideLabel={true}
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full text-muted-foreground text-[10px] font-bold uppercase">
                                        No Data
                                    </div>
                                )}
                            </div>

                            <div className="w-full flex-1 space-y-3">
                                {categorizedBreakdown.slice(0, 5).map((cat) => (
                                    <div key={cat.name} className="space-y-1.5">
                                        <div className="flex justify-between text-[11px] font-bold">
                                            <span className="flex items-center gap-2 text-muted-foreground/80">
                                                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.fill }} />
                                                {cat.name}
                                            </span>
                                            <span className="text-foreground">{formatCurrency(cat.amount)}</span>
                                        </div>
                                        <div className="h-1 w-full bg-secondary/20 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-700"
                                                style={{ width: `${cat.value}%`, backgroundColor: cat.fill }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Payment Methods Breakdown */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80">
                            Spending by Payment Method
                        </span>
                    </div>
                    <Card className="bg-card/40 border-none shadow-none backdrop-blur-md overflow-hidden">
                        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-start gap-6">
                            <div className="w-32 h-32 relative flex-shrink-0">
                                {paymentBreakdown.length > 0 ? (
                                    <BasePieChart 
                                        data={paymentBreakdown} 
                                        config={paymentChartConfig} 
                                        innerRadius={40}
                                        outerRadius={60}
                                        hideLabel={true}
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full text-muted-foreground text-[10px] font-bold uppercase">
                                        No Data
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-3 flex-1 w-full">
                                {categorizedPayment.map((pay) => (
                                    <div key={pay.name} className="flex flex-col p-3 rounded-2xl bg-secondary/10 border border-white/5">
                                        <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground/80 uppercase tracking-widest font-bold">
                                            <div className="w-1 h-1 rounded-full shadow-glow" style={{ backgroundColor: pay.fill }} />
                                            {pay.name}
                                        </span>
                                        <span className="text-sm font-bold mt-1">{formatCurrency(pay.amount)}</span>
                                        <div className="h-1 w-full bg-secondary/20 rounded-full mt-2 overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-1000"
                                                style={{ width: `${pay.value}%`, backgroundColor: pay.fill }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </motion.div>
    );
};
