'use client';

import React, { startTransition } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Check, Wallet, Tag, Pencil, ArrowUpRight, ArrowDownLeft, Clock, LayoutGrid, Plus } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { BasePieChart } from '@/components/charts/base-pie-chart';
import { CHART_CONFIG } from '@/lib/categories';
import { Currency, CURRENCY_SYMBOLS } from '@/components/providers/user-preferences-provider';
import { toast } from '@/utils/haptics';

interface SpendingOverviewProps {
    totalSpent: number;
    displayBudget: number;
    remaining: number;
    progress: number;
    isBucketFocused: boolean;
    focusedBucket: any | null;
    bucketCurrency: Currency;
    formatCurrency: (val: number, cur: Currency) => string;
    isRatesLoading: boolean;
    isCoupleWorkspace: boolean;
    isHomeWorkspace: boolean;
    runRateData: any;
    dashboardFocus: string;
    setDashboardFocus: (focus: string) => void;
    isFocusMenuOpen: boolean;
    setIsFocusMenuOpen: (open: boolean) => void;
    activeBuckets: any[];
    getBucketIcon: (iconName?: string) => React.ReactNode;
    setIsBudgetEditOpen: (open: boolean) => void;
    setTempBudgetInput: (val: string) => void;
    hoveredFocusId: string | null;
    setHoveredFocusId: (id: string | null) => void;
    focusSelectorRef: React.RefObject<HTMLDivElement | null>;
    spendingData: any[];
    balances: {
        totalOwedToMe: number;
        totalOwed: number;
    };
    setIsAddFundsOpen: (open: boolean) => void;
}

const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
};

const itemVariants = {
    hidden: { opacity: 0, y: -10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.32, 0.725, 0.32, 1] } }
};

export function SpendingOverview({
    totalSpent,
    displayBudget,
    remaining,
    progress,
    isBucketFocused,
    focusedBucket,
    bucketCurrency,
    formatCurrency,
    isRatesLoading,
    isCoupleWorkspace,
    isHomeWorkspace,
    runRateData,
    dashboardFocus,
    setDashboardFocus,
    isFocusMenuOpen,
    setIsFocusMenuOpen,
    activeBuckets,
    getBucketIcon,
    setIsBudgetEditOpen,
    setTempBudgetInput,
    hoveredFocusId,
    setHoveredFocusId,
    focusSelectorRef,
    spendingData,
    balances,
    setIsAddFundsOpen
}: SpendingOverviewProps) {
    return (
        <div className="space-y-6">
            {/* Project Focus Selector */}
            <div className="flex justify-center mb-4 relative z-[60]" ref={focusSelectorRef}>
                <button
                    onClick={() => setIsFocusMenuOpen(!isFocusMenuOpen)}
                    className={cn(
                        "flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold transition-all shadow-lg active:scale-95 border backdrop-blur-md",
                        isBucketFocused
                            ? "bg-cyan-500/20 border-cyan-500/30 text-cyan-300 shadow-cyan-500/10"
                            : isCoupleWorkspace
                                ? "bg-rose-500/20 border-rose-500/30 text-rose-300 shadow-rose-500/10"
                                : isHomeWorkspace
                                    ? "bg-amber-500/20 border-amber-500/30 text-amber-300 shadow-amber-500/10"
                                    : "bg-primary/15 border-primary/30 text-primary shadow-primary/10"
                    )}
                >
                    {isBucketFocused ? (
                        <>{focusedBucket?.name || 'Loading'} Focus</>
                    ) : (
                        <>Monthly Allowance</>
                    )}
                    <motion.div
                        animate={{ rotate: isFocusMenuOpen ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-center justify-center"
                    >
                        <ChevronRight className="w-3.5 h-3.5 rotate-90 ml-1 opacity-70" />
                    </motion.div>
                </button>

                <AnimatePresence>
                    {isFocusMenuOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: -10, height: 0, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, height: "auto", scale: 1 }}
                            exit={{ opacity: 0, y: -10, height: 0, scale: 0.95 }}
                            className="absolute top-[110%] left-1/2 -translate-x-1/2 w-64 z-[70] overflow-hidden"
                        >
                            <div className="bg-card/95 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 shadow-2xl">
                                <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-1">
                                    <motion.button 
                                        variants={itemVariants}
                                        onHoverStart={() => setHoveredFocusId('allowance')}
                                        onHoverEnd={() => setHoveredFocusId(null)}
                                        onClick={() => {
                                            startTransition(() => {
                                                setDashboardFocus('allowance');
                                            });
                                            toast.haptic();
                                            setIsFocusMenuOpen(false);
                                        }}
                                        className={cn(
                                            "relative flex w-full items-center rounded-xl py-3 px-3 transition-colors duration-200",
                                            !isBucketFocused ? "text-primary" : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        {(dashboardFocus === 'allowance' || hoveredFocusId === 'allowance') && (
                                            <motion.div layoutId="focus-highlight" className="absolute inset-0 bg-primary/20 rounded-xl -z-0" />
                                        )}
                                        <div className="relative z-10 flex items-center w-full">
                                            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center mr-3">
                                                <Wallet className="w-4 h-4 text-primary" />
                                            </div>
                                            <span className="font-bold flex-1 text-left">Monthly Allowance</span>
                                            {!isBucketFocused && <Check className="w-4 h-4 text-primary ml-2" />}
                                        </div>
                                    </motion.button>
                                    
                                    {activeBuckets.length > 0 && (
                                        <motion.div variants={itemVariants} className="px-3 py-1.5 border-t border-white/5">
                                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Active Missions</p>
                                        </motion.div>
                                    )}

                                    {activeBuckets.map(bucket => (
                                        <motion.button 
                                            key={bucket.id}
                                            variants={itemVariants}
                                            onHoverStart={() => setHoveredFocusId(bucket.id)}
                                            onHoverEnd={() => setHoveredFocusId(null)}
                                            onClick={() => {
                                                startTransition(() => {
                                                    setDashboardFocus(bucket.id);
                                                });
                                                toast.haptic();
                                                setIsFocusMenuOpen(false);
                                            }}
                                            className={cn(
                                                "relative flex w-full items-center rounded-xl py-3 px-3 transition-colors duration-200",
                                                dashboardFocus === bucket.id ? "text-primary" : "text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            {(dashboardFocus === bucket.id || hoveredFocusId === bucket.id) && (
                                                <motion.div layoutId="focus-highlight" className={cn("absolute inset-0 rounded-xl -z-0", bucket.id === dashboardFocus ? "bg-primary/20" : "bg-white/5")} />
                                            )}
                                            <div className="relative z-10 flex items-center w-full">
                                                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center mr-3 text-primary">
                                                    <div className="w-4 h-4">{getBucketIcon(bucket.icon)}</div>
                                                </div>
                                                <span className="font-bold flex-1 text-left">{bucket.name}</span>
                                                {dashboardFocus === bucket.id && <Check className="w-4 h-4 text-primary ml-2" />}
                                            </div>
                                        </motion.button>
                                    ))}
                                </motion.div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Total Spent Card */}
            <div className={cn(
                "relative overflow-hidden rounded-3xl p-6 shadow-xl transition-all duration-500",
                isBucketFocused 
                    ? "bg-gradient-to-br from-cyan-500 to-teal-600 shadow-cyan-500/20"
                    : isCoupleWorkspace 
                        ? "bg-gradient-to-br from-rose-500 to-rose-700 shadow-rose-500/20"
                        : isHomeWorkspace
                            ? "bg-gradient-to-br from-yellow-500 to-amber-600 shadow-yellow-500/20"
                            : "bg-gradient-to-br from-primary to-primary/60 shadow-primary/20"
            )}>
                <div className="absolute top-0 right-0 p-6 opacity-10">
                    <span className="text-9xl font-bold text-white leading-none translate-x-4 -translate-y-4">
                        {CURRENCY_SYMBOLS[bucketCurrency] || '$'}
                    </span>
                </div>
                <div className="relative z-10 space-y-6">
                    <div className="flex justify-between items-start">
                        <div className="min-w-0 flex-1">
                            <p className="text-white/80 text-sm font-medium">
                                {isBucketFocused ? "Total Mission Spent" : `Spent in ${format(new Date(), 'MMMM')}`}
                            </p>
                            <h2 className="text-4xl font-bold text-white mt-1 truncate">
                                {isRatesLoading
                                    ? <span className="inline-block h-9 w-36 bg-white/20 rounded-lg animate-pulse align-middle" />
                                    : formatCurrency(totalSpent, bucketCurrency)}
                            </h2>
                        </div>
                        <div className="w-10 h-10 shrink-0 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm shadow-sm">
                            <span className="text-xl font-bold text-white">
                                {CURRENCY_SYMBOLS[bucketCurrency] || '$'}
                            </span>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-medium text-white/80 gap-2">
                            <div className="flex items-center gap-1 min-w-0">
                                <span className="truncate">{isBucketFocused ? "Target" : "Allowance"}: {formatCurrency(displayBudget, bucketCurrency)}</span>
                                {!isBucketFocused && (
                                    <button 
                                        onClick={() => {
                                            setTempBudgetInput(displayBudget.toString());
                                            setIsBudgetEditOpen(true);
                                        }} 
                                        className="p-1 hover:bg-white/10 rounded-full transition-colors shrink-0 outline-none"
                                    >
                                        <Pencil className="w-3 h-3 text-white/70 hover:text-white" />
                                    </button>
                                )}
                            </div>
                            <span className={cn("shrink-0 flex items-center gap-1", remaining < 0 ? "text-red-200" : "")}>
                                {remaining < 0 ? "Over by " : "Remaining: "}
                                {isRatesLoading
                                    ? <span className="inline-block h-3.5 w-16 bg-white/20 rounded animate-pulse align-middle" />
                                    : formatCurrency(Math.abs(remaining), bucketCurrency)}
                            </span>
                        </div>
                        <Progress value={progress} className="h-2 bg-black/30" indicatorClassName={cn(remaining < 0 ? "bg-red-400" : "bg-white")} />
                        <div className="flex justify-between text-[11px] text-white/60 gap-2">
                            <span>{progress.toFixed(1)}% used</span>
                            <span className={isBucketFocused ? "flex flex-col items-end gap-1 text-right" : "text-right"}>
                                {isBucketFocused ? (
                                    <>
                                        {focusedBucket?.start_date && focusedBucket?.end_date ? (
                                            (() => {
                                                const today = new Date();
                                                const start = new Date(focusedBucket.start_date!);
                                                const end = new Date(focusedBucket.end_date!);
                                                if (today > end) return <span className="text-white/80 font-medium whitespace-nowrap">Mission Completed</span>;
                                                const effectiveStart = today > start ? today : start;
                                                const daysLeft = Math.max(1, differenceInDays(end, effectiveStart));
                                                const safeToSpendDaily = remaining > 0 ? remaining / daysLeft : 0;
                                                return (
                                                    <span className="text-white font-bold bg-white/10 px-2 py-0.5 rounded backdrop-blur-sm border border-white/10 whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                                                        {formatCurrency(safeToSpendDaily, bucketCurrency)}/day
                                                    </span>
                                                );
                                            })()
                                        ) : "All Time"}
                                    </>
                                ) : (
                                    (() => { 
                                        const d = new Date().getDate(); 
                                        const s = ['th', 'st', 'nd', 'rd']; 
                                        const v = d % 100; 
                                        return d + (s[(v - 20) % 10] || s[v] || s[0]) + " of Month"; 
                                    })()
                                )}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            
            <motion.button 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setIsAddFundsOpen(true)}
                className={cn(
                    "w-full flex items-center justify-center gap-2 py-4 rounded-3xl backdrop-blur-xl border text-white font-bold transition-all active:scale-95 group",
                    isCoupleWorkspace 
                        ? "bg-rose-500/20 border-rose-500/30 shadow-[0_4px_30px_rgba(244,63,94,0.15)] hover:bg-rose-500/30 hover:border-rose-500/50" 
                        : isHomeWorkspace
                            ? "bg-yellow-500/20 border-yellow-500/30 shadow-[0_4px_30px_rgba(234,179,8,0.15)] hover:bg-yellow-500/30 hover:border-yellow-500/50"
                            : "bg-primary/20 border-primary/30 shadow-[0_4px_30px_rgba(138,43,226,0.15)] hover:bg-primary/30 hover:border-primary/50"
                )}
            >
                <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm group-hover:scale-110 transition-transform">
                    <Plus className="w-5 h-5 text-white" />
                </div>
                Add Funds
            </motion.button>

            {/* Run Rate Widget */}
            {runRateData && !isBucketFocused && runRateData.currentDayOfMoth > 1 && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                        "p-4 rounded-3xl border backdrop-blur-md relative overflow-hidden",
                        runRateData.isExceeding
                            ? isCoupleWorkspace ? "bg-rose-500/10 border-rose-500/20" : isHomeWorkspace ? "bg-yellow-500/10 border-yellow-500/20" : "bg-red-500/10 border-red-500/20"
                            : isCoupleWorkspace ? "bg-rose-500/5 border-rose-500/10" : isHomeWorkspace ? "bg-yellow-500/5 border-yellow-500/10" : "bg-emerald-500/10 border-emerald-500/20"
                    )}
                >
                    <div className={cn(
                        "absolute top-0 right-0 w-24 h-24 rounded-full blur-[40px] opacity-20",
                        isCoupleWorkspace ? "bg-rose-500" : isHomeWorkspace ? "bg-yellow-500" : (runRateData.isExceeding ? "bg-red-500" : "bg-emerald-500")
                    )} />
                    
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                                <Clock className={cn("w-4 h-4", isCoupleWorkspace ? "text-rose-400" : isHomeWorkspace ? "text-yellow-500" : (runRateData.isExceeding ? "text-red-400" : "text-emerald-400"))} />
                                <h3 className="text-sm font-bold">Month Forecasting</h3>
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-secondary/30 px-2 py-0.5 rounded-full">
                                Day {runRateData.currentDayOfMoth}/{runRateData.daysInMonth}
                            </span>
                        </div>

                        <p className="text-xs text-muted-foreground mb-3 font-medium">
                            Based on your spending speed of <span className="text-foreground font-bold">{formatCurrency(runRateData.dailyAverage, bucketCurrency)}/day</span>, 
                            you are projected to hit <span className="text-foreground font-bold">{formatCurrency(runRateData.projectedSpend, bucketCurrency)}</span> by month's end.
                        </p>

                        {runRateData.isExceeding ? (
                            <div className={cn(
                                "flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl border mt-2",
                                isCoupleWorkspace ? "text-rose-400 bg-rose-500/10 border-rose-500/20" : isHomeWorkspace ? "text-yellow-500 bg-yellow-500/10 border-yellow-500/20" : "text-red-400 bg-red-500/10 border-red-500/20"
                            )}>
                                <ArrowUpRight className="w-4 h-4" />
                                Projected to exceed {isCoupleWorkspace || isHomeWorkspace ? 'workspace limit' : 'budget'} by {formatCurrency(Math.abs(displayBudget - runRateData.projectedSpend), bucketCurrency)}
                            </div>
                        ) : (
                            <div className={cn(
                                "flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl border mt-2",
                                isCoupleWorkspace ? "text-rose-400 bg-rose-500/10 border-rose-500/20" : isHomeWorkspace ? "text-yellow-500 bg-yellow-500/10 border-yellow-500/20" : "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                            )}>
                                <ArrowDownLeft className="w-4 h-4" />
                                On track! Projected to save {formatCurrency(displayBudget - runRateData.projectedSpend, bucketCurrency)}
                            </div>
                        )}
                    </div>
                </motion.div>
            )}

            {/* Balance Summary Card */}
            <div className="grid grid-cols-2 gap-4">
                <Card className="bg-emerald-500/15 border-emerald-500/20 backdrop-blur-md">
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center mb-2">
                            <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                        </div>
                        <p className="text-[11px] text-emerald-500 font-bold uppercase tracking-wider">You are owed</p>
                        <h4 className="text-lg font-bold text-emerald-500 whitespace-nowrap overflow-hidden text-ellipsis w-full">
                            {formatCurrency(balances.totalOwedToMe, bucketCurrency)}
                        </h4>
                    </CardContent>
                </Card>
                <Card className="bg-rose-500/15 border-rose-500/20 backdrop-blur-md">
                    <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                        <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center mb-2">
                            <ArrowUpRight className="w-4 h-4 text-rose-500" />
                        </div>
                        <p className="text-[11px] text-rose-500 font-bold uppercase tracking-wider">You owe</p>
                        <h4 className="text-lg font-bold text-rose-500 whitespace-nowrap overflow-hidden text-ellipsis w-full">
                            {formatCurrency(balances.totalOwed, bucketCurrency)}
                        </h4>
                    </CardContent>
                </Card>
            </div>

            {/* Spending by Category Pie Chart Section */}
            <div className="space-y-4">
                <div className="flex flex-wrap justify-between items-center gap-2">
                    <h3 className="text-lg font-bold">Spending by Category</h3>
                    <span className={cn(
                        "text-[11px] bg-secondary/50 backdrop-blur-md px-3 py-1 rounded-full border font-bold uppercase tracking-wider whitespace-nowrap",
                        isCoupleWorkspace ? "text-rose-400 border-rose-500/20" : isHomeWorkspace ? "text-yellow-500 border-yellow-500/20" : "text-primary border-primary/20"
                    )}>
                        {isBucketFocused ? "Mission" : format(new Date(), 'MMMM')} Overview
                    </span>
                </div>
                <Card className="border-none bg-card/40 backdrop-blur-md shadow-none overflow-hidden">
                    <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-start gap-4">
                        {spendingData.length > 0 ? (
                            <>
                                <motion.div 
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                                    className="w-40 h-40 relative flex-shrink-0"
                                >
                                    <BasePieChart 
                                        data={spendingData} 
                                        config={CHART_CONFIG} 
                                        innerRadius={50}
                                        outerRadius={75}
                                    />
                                </motion.div>
                                <div className="w-full flex-1 space-y-2">
                                    {spendingData.map((item: any) => (
                                        <div key={item.name} className="flex items-center justify-between text-[11px]">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                                <span className="text-foreground/80 truncate">{item.name}</span>
                                            </div>
                                            <span className="font-bold">{formatCurrency(item.value, bucketCurrency)}</span>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="w-full py-8 flex flex-col items-center justify-center text-center">
                                <div className="w-12 h-12 rounded-full bg-secondary/20 flex items-center justify-center mb-3">
                                    <LayoutGrid className="w-6 h-6 text-muted-foreground/50" />
                                </div>
                                <p className="text-sm text-muted-foreground font-medium">No spending data yet for this view.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
