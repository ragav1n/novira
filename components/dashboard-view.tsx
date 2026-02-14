'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ChevronRight, MoreHorizontal, LogOut } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Pie, PieChart } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/pie-chart";

// Mock Data
const spendingData = [
    { name: 'Food', value: 1150, color: '#8A2BE2', fill: '#8A2BE2' },      // Electric Purple
    { name: 'Transport', value: 680, color: '#FF6B6B', fill: '#FF6B6B' },   // Coral
    { name: 'Bills', value: 520, color: '#4ECDC4', fill: '#4ECDC4' },       // Teal
    { name: 'Shopping', value: 350, color: '#F9C74F', fill: '#F9C74F' },    // Yellow
    { name: 'Others', value: 147, color: '#C7F464', fill: '#C7F464' },      // Lime
];

const chartConfig = {
    food: { label: "Food", color: "#8A2BE2" },
    transport: { label: "Transport", color: "#FF6B6B" },
    bills: { label: "Bills", color: "#4ECDC4" },
    shopping: { label: "Shopping", color: "#F9C74F" },
    others: { label: "Others", color: "#C7F464" },
} satisfies ChartConfig;

const transactions = [
    { id: 1, name: 'Starbucks Coffee', category: 'Food', date: 'Today', amount: -8.75, icon: '☕' },
    { id: 2, name: 'Uber Ride', category: 'Transport', date: 'Today', amount: -22.50, icon: '🚗' },
    { id: 3, name: 'Whole Foods', category: 'Food', date: 'Yesterday', amount: -156.80, icon: '🛒' },
    { id: 4, name: 'Apple Music', category: 'Bills', date: 'Yesterday', amount: -9.99, icon: '🎵' },
];

export function DashboardView() {
    const router = useRouter();

    return (
        <div className="p-5 space-y-6 max-w-md mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center pt-2">
                <div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/80">
                        Hello, Sarah! 👋
                    </h1>
                    <p className="text-sm text-muted-foreground">Track your expenses wisely</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => router.push('/signin')}
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
                    <span className="text-9xl font-bold text-white">$</span>
                </div>

                <div className="relative z-10 space-y-6">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-white/80 text-sm font-medium">Total Spent This Month</p>
                            <h2 className="text-4xl font-bold text-white mt-1">$2,847</h2>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                            <span className="text-xl font-bold text-white">$</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-medium text-white/80">
                            <span>Budget: $3,500</span>
                            <span>Remaining: $653</span>
                        </div>
                        <Progress value={81.3} className="h-2 bg-black/30" indicatorClassName="bg-white" />
                        <div className="flex justify-between text-[10px] text-white/60">
                            <span>81.3% used</span>
                            <span>9 days left</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Spending by Category */}
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold">Spending by Category</h3>
                    <span className="text-xs bg-secondary/30 px-3 py-1 rounded-full text-primary border border-primary/20">January 2025</span>
                </div>

                <Card className="border-none bg-card/40 backdrop-blur-md shadow-none">
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                        {/* Chart Circle */}
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
                            {/* Center text could go here */}
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
                                        <span className="font-semibold">${item.value}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Transactions */}
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold">Recent Transactions</h3>
                    <button className="text-xs text-primary hover:text-primary/80">View All</button>
                </div>

                <div className="space-y-3">
                    {transactions.map((tx) => (
                        <div key={tx.id} className="flex items-center justify-between p-3 rounded-2xl bg-card/30 border border-white/5 hover:bg-card/50 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center text-lg">
                                    {tx.icon}
                                </div>
                                <div>
                                    <p className="font-medium text-sm">{tx.name}</p>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <span className="px-1.5 py-0.5 rounded bg-primary/10 text-[10px] text-primary">{tx.category}</span>
                                        <span>• {tx.date}</span>
                                    </div>
                                </div>
                            </div>
                            <span className="font-semibold text-sm">{tx.amount < 0 ? `-$${Math.abs(tx.amount).toFixed(2)}` : `+$${tx.amount.toFixed(2)}`}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
