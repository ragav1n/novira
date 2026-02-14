'use client';

import React from 'react';
import { ChevronLeft, MoreHorizontal } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer, Pie, PieChart } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/pie-chart";

// Mock Data
const trendData = [
    { month: 'Aug', value: 2000 },
    { month: 'Sep', value: 2400 },
    { month: 'Oct', value: 2200 },
    { month: 'Nov', value: 3100 },
    { month: 'Dec', value: 2800 },
    { month: 'Jan', value: 3500 },
    { month: 'Feb', value: 3200 },
];

const categoryBreakdown = [
    { name: 'Food', amount: 1150, color: 'bg-[#8A2BE2]', value: 75, lastMonth: 'bg-[#8A2BE2]/20', fill: "#8A2BE2" }, // Electric Purple
    { name: 'Transport', amount: 680, color: 'bg-[#FF6B6B]', value: 45, lastMonth: 'bg-[#FF6B6B]/20', fill: "#FF6B6B" }, // Coral
    { name: 'Bills', amount: 520, color: 'bg-[#4ECDC4]', value: 35, lastMonth: 'bg-[#4ECDC4]/20', fill: "#4ECDC4" }, // Teal
    { name: 'Shopping', amount: 350, color: 'bg-[#F9C74F]', value: 25, lastMonth: 'bg-[#F9C74F]/20', fill: "#F9C74F" }, // Yellow
];

const chartConfig = {
    food: { label: "Food", color: "#8A2BE2" },
    transport: { label: "Transport", color: "#FF6B6B" },
    bills: { label: "Bills", color: "#4ECDC4" },
    shopping: { label: "Shopping", color: "#F9C74F" },
} satisfies ChartConfig;

export function AnalyticsView() {
    const router = useRouter();

    return (
        <div className="p-5 space-y-6 max-w-md mx-auto relative pb-24">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-full bg-secondary/30 hover:bg-secondary/50 transition-colors"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-lg font-semibold">Analytics</h2>
                <button className="p-2 rounded-full hover:bg-secondary/30 transition-colors">
                    <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
                </button>
            </div>

            {/* Monthly Spending Trend */}
            <Card className="bg-card/50 backdrop-blur-md border-white/5">
                <CardContent className="p-5 space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-sm">Monthly Spending Trend</h3>
                    </div>

                    <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={trendData}>
                                <XAxis
                                    dataKey="month"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1a1a1a', border: 'none', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="value"
                                    stroke="#8A2BE2"
                                    strokeWidth={3}
                                    dot={{ fill: '#8A2BE2', r: 4, strokeWidth: 0 }}
                                    activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                            <span className="text-xs">↑ +8.5% vs last month</span>
                        </div>
                        <div className="px-3 py-1.5 rounded-full bg-primary/20 text-primary text-xs font-medium border border-primary/20">
                            January 2025
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Category Breakdown including Pie Chart */}
            <div className="space-y-4">
                <h3 className="font-semibold text-sm">Category Breakdown</h3>

                {/* Pie Chart Integration */}
                <div className="h-[250px] w-full">
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
                </div>

                <div className="space-y-4">
                    {categoryBreakdown.map((cat) => (
                        <div key={cat.name} className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>{cat.name}</span>
                                <span className="font-semibold">${cat.amount}</span>
                            </div>

                            {/* Dual Progress Bar (Current vs Last Month representation style) */}
                            <div className="h-2 w-full bg-secondary/20 rounded-full overflow-hidden flex">
                                <div className={cn("h-full rounded-full", cat.color)} style={{ width: `${cat.value}%` }} />
                                <div className={cn("h-full", cat.lastMonth)} style={{ width: '20%' }} /> {/* Placeholder for last month */}
                            </div>

                            <div className="flex justify-between text-[10px] text-muted-foreground">
                                <span>This Month</span>
                                <span>Last Month</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
