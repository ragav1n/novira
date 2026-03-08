'use client';

import { useUserPreferences, CURRENCY_SYMBOLS, type Currency } from '@/components/providers/user-preferences-provider';
import { BudgetAlertManager } from '@/components/budget-alert-manager';
import React, { useEffect, useState, useRef, useCallback, useMemo, startTransition, lazy, Suspense } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRouter } from 'next/navigation';
import { Plus, Utensils, Car, Zap, ShoppingBag, HeartPulse, Clapperboard, CircleDollarSign, ArrowUpRight, ArrowDownLeft, Users, MoreVertical, Pencil, Trash2, X, History, Clock, HelpCircle, Tag, Plane, Home, Gift, ShoppingCart, Stethoscope, Gamepad2, School, Laptop, Music, Heart, RefreshCcw, Wallet, ChevronRight, Check, Shirt, LayoutGrid, MapPin, Target, ChevronDown, UserCircle, Building2 } from 'lucide-react';
import { CATEGORY_COLORS, getIconForCategory } from '@/lib/categories';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Pie, PieChart, Cell } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/pie-chart";
import { supabase } from '@/lib/supabase';
import { format, isSameMonth, parseISO, differenceInDays } from 'date-fns';
import { WaveLoader } from '@/components/ui/wave-loader';
import { AnimatePresence, motion } from 'framer-motion';
import { useGroups } from './providers/groups-provider';
import { useBuckets } from './providers/buckets-provider';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { toast } from '@/utils/haptics';
import { cn } from '@/lib/utils';
import { FeatureAnnouncementModal } from '@/components/feature-announcement-modal';
import { WelcomeModal } from '@/components/welcome-modal';
import { LATEST_FEATURE_ANNOUNCEMENT } from '@/lib/feature-flags';
import { TransactionRow } from '@/components/transaction-row';
import { DashboardTransactionsDrawer } from '@/components/dashboard-transactions-drawer';
import { TransactionHistoryDialog } from '@/components/transaction-history-dialog';
import { LocationPicker } from '@/components/ui/location-picker';
import dynamic from 'next/dynamic';
const ExpenseMapView = dynamic(() => import('@/components/expense-map-view').then(mod => mod.ExpenseMapView), { ssr: false });

// Lazy load non-critical dialogs
const AddFundsDialog = lazy(() => import('@/components/add-funds-dialog').then(module => ({ default: module.AddFundsDialog })));
const HowToUseDialog = lazy(() => import('@/components/how-to-use-dialog').then(module => ({ default: module.HowToUseDialog })));

// Animation variants
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            when: "beforeChildren",
            staggerChildren: 0.05,
        },
    },
};

const itemVariants = {
    hidden: { opacity: 0, y: -10 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.4,
            ease: [0.32, 0.725, 0.32, 1],
        },
    },
};

// Chart config remains for label mapping, but colors are centralized
const chartConfig: any = {
    food: { label: "Food" },
    groceries: { label: "Groceries" },
    fashion: { label: "Fashion" },
    transport: { label: "Transport" },
    bills: { label: "Bills" },
    shopping: { label: "Shopping" },
    healthcare: { label: "Healthcare" },
    entertainment: { label: "Entertainment" },
    rent: { label: "Rent" },
    education: { label: "Education" },
    others: { label: "Others" },
    uncategorized: { label: "Uncategorized" },
};

import type { Transaction, AuditLog } from '@/types/transaction';

type SpendingCategory = {
    name: string;
    value: number;
    color: string;
    fill: string;
};

import { useDashboardData } from '@/hooks/useDashboardData';
import { useDashboardState } from '@/hooks/useDashboardState';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { VirtualizedTransactionList } from '@/components/virtualized-transaction-list';



export function DashboardView() {
    const router = useRouter();
    const { formatCurrency, currency, convertAmount, monthlyBudget, setMonthlyBudget, userId, isRatesLoading, avatarUrl, fullName: userName, activeWorkspaceId, setActiveWorkspaceId, workspaceBudgets, setWorkspaceBudget } = useUserPreferences();
    const { balances, groups, friends } = useGroups();
    const { buckets } = useBuckets();

    const {
        transactions, loading, editingTransaction, setEditingTransaction,
        isEditOpen, setIsEditOpen, selectedAuditTx, setSelectedAuditTx,
        auditLogs, loadingAudit, handleDeleteTransaction, handleUpdateTransaction, loadAuditLogs, loadTransactions
    } = useDashboardData(userId);

    const {
        dashboardFocus, setDashboardFocus, isFocusRestored,
        isAddFundsOpen, setIsAddFundsOpen, isHowToUseOpen, setIsHowToUseOpen,
        activeModal, setActiveModal, isFocusMenuOpen, setIsFocusMenuOpen,
        focusSelectorRef, isViewAllOpen, setIsViewAllOpen,
        isMapOpen, setIsMapOpen, hoveredFocusId, setHoveredFocusId
    } = useDashboardState(userId);

    const [isBudgetEditOpen, setIsBudgetEditOpen] = useState(false);
    const [tempBudgetInput, setTempBudgetInput] = useState("");

    const eligibleGroups = useMemo(() => groups.filter(g => g.type === 'couple' || g.type === 'home'), [groups]);
    const activeWorkspaceGroup = useMemo(() => 
        activeWorkspaceId ? eligibleGroups.find(g => g.id === activeWorkspaceId) : null, 
    [eligibleGroups, activeWorkspaceId]);

    const isCoupleWorkspace = activeWorkspaceGroup?.type === 'couple';

    const isBucketFocused = dashboardFocus !== 'allowance' && dashboardFocus !== '';
    const bucketCurrencyTemp = isBucketFocused ? buckets.find(b => b.id === dashboardFocus)?.currency || currency : currency;
    const bucketCurrency = bucketCurrencyTemp.toUpperCase() as Currency;

    const currentWorkspaceBudget = activeWorkspaceId ? (workspaceBudgets[activeWorkspaceId] || 0) : monthlyBudget;

    const {
        focusedBucket, displayBudget, calculateUserShare, totalSpent,
        remaining, progress, spendingData, displayTransactions, runRateData
    } = useDashboardStats({
        transactions, 
        userId: activeWorkspaceId ? null : userId, // if workspace, null so we get all workspace txs
        isBucketFocused, effectiveFocus: dashboardFocus,
        bucketCurrency, currency, convertAmount, monthlyBudget: currentWorkspaceBudget, buckets
    });

    const effectiveCalculateUserShare = useCallback((tx: Transaction, uid: string | null) => {
        if (!activeWorkspaceId || !activeWorkspaceGroup) return calculateUserShare(tx, uid);
        
        // In workspace, we count spending by *anyone* in the workspace group
        const partnerIds = activeWorkspaceGroup.members.map(m => m.user_id);
        
        // If the transaction belongs to anyone in the workspace, count the full amount
        if (partnerIds.includes(tx.user_id)) {
             return Number(tx.amount);
        }
        
        // If it's a split with other people outside the workspace, sum up the shares of the workspace members
        if (tx.splits) {
             let workspaceShare = 0;
             for (const split of tx.splits) {
                 if (partnerIds.includes(split.user_id)) {
                     workspaceShare += Number(split.amount);
                 }
             }
             if (workspaceShare > 0) return workspaceShare;
        }

        return 0;
    }, [activeWorkspaceId, activeWorkspaceGroup, calculateUserShare]);

    const handleSaveBudget = async () => {
        const newBudget = Number(tempBudgetInput);
        if (!isNaN(newBudget) && newBudget >= 0) {
            if (activeWorkspaceId) {
                await setWorkspaceBudget(activeWorkspaceId, newBudget);
            } else {
                await setMonthlyBudget(newBudget);
            }
            setIsBudgetEditOpen(false);
        }
    };

    const isAnyModalOpen = isViewAllOpen || activeModal !== null || isAddFundsOpen || isHowToUseOpen || isEditOpen || isBudgetEditOpen;

    const currentMonthForEditPrefix = useMemo(() => {
        const d = new Date();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        return `${d.getFullYear()}-${month}`;
    }, []);

    const canEditTransaction = useCallback((tx: Transaction) => {
        if (tx.user_id !== userId) return false;
        return tx.date.startsWith(currentMonthForEditPrefix);
    }, [userId, currentMonthForEditPrefix]);

    const getBucketIcon = useCallback((iconName?: string) => {
        const icons: Record<string, any> = {
            Tag, Plane, Home, Gift, Car, Utensils, ShoppingCart,
            Heart, Gamepad2, School, Laptop, Music
        };
        const Icon = icons[iconName || 'Tag'] || Tag;
        return <Icon className="w-full h-full" />;
    }, []);

    const getBucketChip = useCallback((tx: Transaction) => {
        if (!tx.bucket_id) return null;
        const txBucket = buckets.find(b => b.id === tx.bucket_id);
        if (!txBucket) return null;
        return (
            <span className="flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 shadow-sm">
                <div className="w-2.5 h-2.5 shrink-0 opacity-90">
                    {getBucketIcon(txBucket.icon)}
                </div>
                {txBucket.name}
            </span>
        );
    }, [buckets, getBucketIcon]);

    const activeBuckets = useMemo(() => activeWorkspaceId ? [] : buckets.filter(b => !b.is_archived), [buckets, activeWorkspaceId]);

    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 0.8 }}
            className="relative min-h-screen"
        >
            <Dialog open={isBudgetEditOpen} onOpenChange={setIsBudgetEditOpen}>
                <DialogContent className="max-w-[340px] bg-card border-white/10 rounded-3xl p-6">
                    <DialogHeader className="mb-4">
                        <DialogTitle>Edit {activeWorkspaceId ? 'Workspace' : 'Personal'} Budget</DialogTitle>
                        <DialogDescription className="text-xs">
                            Set your monthly spending allowance for this context.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Monthly Allowance ({currency})</Label>
                            <Input 
                                type="number" 
                                value={tempBudgetInput} 
                                onChange={(e) => setTempBudgetInput(e.target.value)} 
                                placeholder="e.g. 5000"
                                className="bg-secondary/50 border-white/10 h-12 rounded-xl text-lg font-bold"
                            />
                        </div>
                        <Button onClick={handleSaveBudget} className="w-full h-12 rounded-xl font-bold bg-primary hover:bg-primary/90">
                            Save Budget
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            {/* Focus-based Background Overlay */}
            <AnimatePresence>
                {isBucketFocused ? (
                    <motion.div 
                        key="bucket-focus"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.8 }}
                        className="fixed inset-0 pointer-events-none z-0 overflow-hidden gpu"
                    >
                        <div className="absolute -top-[10%] -left-[10%] w-[70%] h-[70%] rounded-full blur-[50px] bg-cyan-500 opacity-[0.2] gpu" />
                        <div className="absolute -bottom-[10%] -right-[10%] w-[60%] h-[60%] rounded-full blur-[40px] bg-teal-500 opacity-10 gpu" />
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-950/20 via-transparent to-teal-950/20" />
                    </motion.div>
                ) : (
                    <motion.div 
                        key="default-focus"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.8 }}
                        className="fixed inset-0 pointer-events-none z-0 overflow-hidden gpu"
                    >
                        <div className={cn(
                            "absolute top-[20%] -right-[10%] w-[60%] h-[60%] rounded-full blur-[50px] opacity-15 gpu transition-colors duration-1000",
                            isCoupleWorkspace ? "bg-rose-500" : "bg-primary"
                        )} />
                        <div className={cn(
                            "absolute bottom-[20%] -left-[10%] w-[50%] h-[50%] rounded-full blur-[40px] opacity-10 gpu transition-colors duration-1000",
                            isCoupleWorkspace ? "bg-rose-500" : "bg-primary/40"
                        )} />
                    </motion.div>
                )}
            </AnimatePresence>



            <div 
                className={cn(
                    "p-5 space-y-6 max-w-md mx-auto relative transition-opacity duration-300 z-10",
                    loading ? "opacity-40 blur-[1px] pointer-events-none" : "opacity-100 blur-0",
                    isAnyModalOpen ? "pointer-events-none overflow-hidden" : "overflow-x-hidden"
                )}
                inert={isAnyModalOpen}
            >
                {/* Header */}
                <div className="flex justify-between items-center pt-2 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="w-10 h-10 relative shrink-0">
                            <img src="/Novira.png" alt="Novira" className="w-full h-full object-contain drop-shadow-[0_0_8px_rgba(138,43,226,0.5)]" />
                        </div>
                        <div className="min-w-0 flex flex-col justify-center">
                            {eligibleGroups.length > 0 ? (
                                <DropdownMenu>
                                    <DropdownMenuTrigger className="flex items-center gap-1.5 focus:outline-none">
                                        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/80 truncate">
                                            {activeWorkspaceId ? activeWorkspaceGroup?.name : `Hi, ${userName.split(' ')[0]}!`}
                                        </h1>
                                        <ChevronDown className="w-4 h-4 text-white/50 shrink-0" />
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="w-48 bg-card/95 backdrop-blur-xl border-white/10 rounded-2xl">
                                        <DropdownMenuItem 
                                            onClick={() => {
                                                setActiveWorkspaceId(null);
                                                setDashboardFocus('allowance');
                                            }} 
                                            className={cn("rounded-xl cursor-pointer py-2", !activeWorkspaceId && "bg-primary/10 text-primary")}
                                        >
                                            <UserCircle className="w-4 h-4 mr-2" />
                                            Personal
                                            {!activeWorkspaceId && <Check className="w-3 h-3 ml-auto" />}
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator className="bg-white/5" />
                                        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold px-2 py-1.5">
                                            Shared Workspaces
                                        </DropdownMenuLabel>
                                        {eligibleGroups.map(g => (
                                            <DropdownMenuItem 
                                                key={g.id} 
                                                onClick={() => {
                                                    setActiveWorkspaceId(g.id);
                                                    setDashboardFocus('allowance');
                                                }} 
                                                className={cn("rounded-xl cursor-pointer py-2", activeWorkspaceId === g.id && "bg-rose-500/10 text-rose-400")}
                                            >
                                                <Building2 className="w-4 h-4 mr-2" />
                                                <span className="truncate">{g.name}</span>
                                                {activeWorkspaceId === g.id && <Check className="w-3 h-3 ml-auto shrink-0" />}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            ) : (
                                <h1 className="text-xl font-bold flex items-center gap-1.5 min-w-0">
                                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-white/80 truncate">Hi, {userName.split(' ')[0]}!</span>
                                    <span className="shrink-0">👋</span>
                                </h1>
                            )}
                            <p className="text-[11px] text-muted-foreground font-medium truncate">
                                {activeWorkspaceId ? (
                                    activeWorkspaceGroup?.type === 'couple' ? 'Couple Dashboard' : 
                                    activeWorkspaceGroup?.type === 'home' ? 'Home Dashboard' : 
                                    'Household Dashboard'
                                ) : 'Track your expenses with Novira'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
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
                            onClick={() => setIsHowToUseOpen(true)}
                            className="w-10 h-10 rounded-full bg-secondary/20 hover:bg-secondary/40 flex items-center justify-center border border-white/5 transition-colors shrink-0"
                            title="How to use Novira"
                        >
                            <HelpCircle className="w-5 h-5 text-white/70" />
                        </button>
                        <button
                            onClick={() => router.push('/add')}
                            className="w-10 h-10 rounded-full bg-primary/20 hover:bg-primary/30 flex items-center justify-center border border-primary/20 transition-colors shrink-0"
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
                                    className="flex-1 bg-primary text-white text-xs font-bold py-2.5 px-4 rounded-xl hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 border border-primary/20"
                                >
                                    <Users className="w-4 h-4" />
                                    Add Friends
                                </button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Project Focus Selector (The Pill) */}
                <div className="flex justify-center mb-4 relative z-[60]" ref={focusSelectorRef}>
                    <button 
                        onClick={() => setIsFocusMenuOpen(!isFocusMenuOpen)}
                        className={cn(
                            "flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold transition-all shadow-lg active:scale-95",
                            isBucketFocused 
                                ? "bg-cyan-500 text-white shadow-cyan-500/30" 
                                : "bg-white/10 backdrop-blur-md text-foreground shadow-black/5 border border-white/5"
                        )}
                    >
                        {isBucketFocused ? (
                            <>
                                {focusedBucket?.name || 'Loading'} Focus
                            </>
                        ) : (
                            <>
                                Monthly Allowance
                            </>
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
                                animate={{
                                    opacity: 1,
                                    y: 0,
                                    height: "auto",
                                    scale: 1,
                                    transition: {
                                        duration: 0.4,
                                        ease: [0.32, 0.725, 0.32, 1],
                                    },
                                }}
                                exit={{
                                    opacity: 0,
                                    y: -10,
                                    height: 0,
                                    scale: 0.95,
                                    transition: {
                                        duration: 0.3,
                                        ease: [0.32, 0.725, 0.32, 1],
                                    },
                                }}
                                className="absolute top-[110%] left-1/2 -translate-x-1/2 w-64 z-[70] overflow-hidden"
                            >
                                <div className="bg-card/95 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 shadow-2xl">
                                    <motion.div
                                        variants={containerVariants}
                                        initial="hidden"
                                        animate="visible"
                                        className="space-y-1"
                                    >
                                        <motion.button 
                                            variants={itemVariants}
                                            onHoverStart={() => setHoveredFocusId('allowance')}
                                            onHoverEnd={() => setHoveredFocusId(null)}
                                            onClick={() => {
                                                startTransition(() => {
                                                    setDashboardFocus('allowance');
                                                });
                                                setIsFocusMenuOpen(false);
                                            }}
                                            className={cn(
                                                "relative flex w-full items-center rounded-xl py-3 px-3 transition-colors duration-200",
                                                !isBucketFocused ? "text-primary" : "text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            {(dashboardFocus === 'allowance' || hoveredFocusId === 'allowance') && (
                                                <motion.div
                                                    layoutId="focus-highlight"
                                                    className="absolute inset-0 bg-primary/20 rounded-xl -z-0"
                                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                                />
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
                                                    setIsFocusMenuOpen(false);
                                                }}
                                                className={cn(
                                                    "relative flex w-full items-center rounded-xl py-3 px-3 transition-colors duration-200",
                                                    dashboardFocus === bucket.id ? "text-cyan-400" : "text-muted-foreground hover:text-foreground"
                                                )}
                                            >
                                                {(dashboardFocus === bucket.id || hoveredFocusId === bucket.id) && (
                                                    <motion.div
                                                        layoutId="focus-highlight"
                                                        className={cn(
                                                            "absolute inset-0 rounded-xl -z-0",
                                                            bucket.id === dashboardFocus ? "bg-cyan-500/20" : "bg-white/5"
                                                        )}
                                                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                                    />
                                                )}
                                                <div className="relative z-10 flex items-center w-full">
                                                    <div className="w-7 h-7 rounded-full bg-cyan-500/20 flex items-center justify-center mr-3 text-cyan-500">
                                                        <div className="w-4 h-4">
                                                            {getBucketIcon(bucket.icon)}
                                                        </div>
                                                    </div>
                                                    <span className="font-bold flex-1 text-left">{bucket.name}</span>
                                                    {dashboardFocus === bucket.id && <Check className="w-4 h-4 text-cyan-500 ml-2" />}
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
                            : "bg-gradient-to-br from-[#8A2BE2] to-[#4B0082] shadow-primary/20"
                )}>
                    <div className="absolute top-0 right-0 p-6 opacity-10 transition-colors">
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
                                    {isRatesLoading ? "..." : formatCurrency(totalSpent, bucketCurrency)}
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
                                <span className={cn("shrink-0", remaining < 0 ? "text-red-200" : "")}>{remaining < 0 ? "Over by " : "Remaining: "}{isRatesLoading ? "..." : formatCurrency(Math.abs(remaining), bucketCurrency)}</span>
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
                                                    
                                                    // Only calculate pacing if the trip hasn't ended yet
                                                    if (today > end) return <span className="text-white/80 font-medium whitespace-nowrap">Mission Completed</span>;
                                                    
                                                    // Effective start date is either today or the trip start date, whichever is later
                                                    const effectiveStart = today > start ? today : start;
                                                    
                                                    // Calculate remaining days (minimum 1 to avoid division by zero)
                                                    const daysLeft = Math.max(1, differenceInDays(end, effectiveStart));
                                                    
                                                    // Calculate daily allowance using remaining budget
                                                    // If budget is already blown, show 0
                                                    const safeToSpendDaily = remaining > 0 ? remaining / daysLeft : 0;
                                                    
                                                    return (
                                                        <span className="text-white font-bold bg-white/10 px-2 py-0.5 rounded backdrop-blur-sm border border-white/10 whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
                                                            {formatCurrency(safeToSpendDaily, bucketCurrency)}/day
                                                        </span>
                                                    );
                                                })()
                                            ) : (
                                                "All Time"
                                            )}
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

                {/* Run Rate Widget */}
                {runRateData && !isBucketFocused && runRateData.currentDayOfMoth > 1 && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                            "p-4 rounded-3xl border backdrop-blur-md relative overflow-hidden",
                            runRateData.isExceeding
                                ? "bg-rose-500/10 border-rose-500/20"
                                : "bg-emerald-500/10 border-emerald-500/20"
                        )}
                    >
                        <div className={cn(
                            "absolute top-0 right-0 w-24 h-24 rounded-full blur-[40px] opacity-20",
                            runRateData.isExceeding ? "bg-rose-500" : "bg-emerald-500"
                        )} />
                        
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    <Clock className={cn("w-4 h-4", runRateData.isExceeding ? "text-rose-400" : "text-emerald-400")} />
                                    <h3 className="text-sm font-bold">Month Forecasting</h3>
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-secondary/30 px-2 py-0.5 rounded-full">
                                    Day {runRateData.currentDayOfMoth}/{runRateData.daysInMonth}
                                </span>
                            </div>

                            <p className="text-xs text-muted-foreground mb-3 font-medium">
                                Based on your spending speed of <span className="text-foreground font-bold">{formatCurrency(runRateData.dailyAverage)}/day</span>, 
                                you are projected to hit <span className="text-foreground font-bold">{formatCurrency(runRateData.projectedSpend)}</span> by month's end.
                            </p>

                            {runRateData.isExceeding ? (
                                <div className="flex items-center gap-2 text-xs font-bold text-rose-400 bg-rose-500/10 px-3 py-2 rounded-xl border border-rose-500/20 mt-2">
                                    <ArrowUpRight className="w-4 h-4" />
                                    Projected to exceed budget by {formatCurrency(Math.abs(monthlyBudget - runRateData.projectedSpend))}
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-2 rounded-xl border border-emerald-500/20 mt-2">
                                    <ArrowDownLeft className="w-4 h-4" />
                                    On track! Projected to save {formatCurrency(monthlyBudget - runRateData.projectedSpend)}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}

                {/* Separate Add Funds Action */}
                <div className="flex justify-center mt-4 mb-6 relative group">
                    <button 
                        onClick={() => setIsAddFundsOpen(true)}
                        className={cn(
                            "flex items-center justify-center w-full gap-2 py-4 rounded-3xl backdrop-blur-xl border text-white font-bold transition-all active:scale-95",
                            isCoupleWorkspace 
                                ? "bg-rose-500/20 border-rose-500/30 shadow-[0_4px_30px_rgba(244,63,94,0.15)] hover:bg-rose-500/30 hover:border-rose-500/50" 
                                : "bg-primary/20 border-primary/30 shadow-[0_4px_30px_rgba(138,43,226,0.15)] hover:bg-primary/30 hover:border-primary/50"
                        )}
                    >
                        <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                            <Plus className="w-4 h-4 text-white" />
                        </div>
                        Add Funds
                    </button>
                </div>

                {/* Balance Summary Card */}
                <div className="grid grid-cols-2 gap-4">
                    <Card className="bg-emerald-500/15 border-emerald-500/20 backdrop-blur-md">
                        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center mb-2">
                                <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                            </div>
                            <p className="text-[11px] text-emerald-500 font-bold uppercase tracking-wider">You are owed</p>
                            <h4 className="text-lg font-bold text-emerald-500 whitespace-nowrap overflow-hidden text-ellipsis w-full">{formatCurrency(balances.totalOwedToMe)}</h4>
                        </CardContent>
                    </Card>
                    <Card className="bg-rose-500/15 border-rose-500/20 backdrop-blur-md">
                        <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                            <div className="w-8 h-8 rounded-full bg-rose-500/20 flex items-center justify-center mb-2">
                                <ArrowUpRight className="w-4 h-4 text-rose-500" />
                            </div>
                            <p className="text-[11px] text-rose-500 font-bold uppercase tracking-wider">You owe</p>
                            <h4 className="text-lg font-bold text-rose-500 whitespace-nowrap overflow-hidden text-ellipsis w-full">{formatCurrency(balances.totalOwed)}</h4>
                        </CardContent>
                    </Card>
                </div>

                {/* Spending by Category */}
                <div className="space-y-4">
                    <div className="flex flex-wrap justify-between items-center gap-2">
                        <h3 className="text-lg font-bold">Spending by Category</h3>
                        <span className={cn(
                            "text-[11px] bg-secondary/50 backdrop-blur-md px-3 py-1 rounded-full border font-bold uppercase tracking-wider whitespace-nowrap",
                            isCoupleWorkspace ? "text-rose-400 border-rose-500/20" : "text-primary border-primary/20"
                        )}>{format(new Date(), 'MMMM')} Overview</span>
                    </div>
                    <Card className="border-none bg-card/40 backdrop-blur-md shadow-none">
                        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-6">
                            {spendingData.length > 0 ? (
                                <>
                                    <motion.div 
                                        key={dashboardFocus}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ duration: 0.5, ease: "easeOut" }}
                                        className="w-32 h-32 relative flex-shrink-0"
                                    >
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
                                                    isAnimationActive={true}
                                                    animationBegin={0}
                                                    animationDuration={1500}
                                                    animationEasing="ease-in-out"
                                                    startAngle={90}
                                                    endAngle={450}
                                                >
                                                    {spendingData.map((entry: any, index: number) => (
                                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                                    ))}
                                                </Pie>
                                            </PieChart>
                                        </ChartContainer>
                                    </motion.div>
                                    <div className="w-full flex-1 space-y-3">
                                        {spendingData.map((item: any) => (
                                            <div key={item.name} className="flex items-center justify-between text-[11px]">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                                                    <span className="text-foreground/80 truncate">{item.name}</span>
                                                </div>
                                                <span className="font-semibold shrink-0">{formatCurrency(item.value)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className="w-full text-center py-8 text-muted-foreground space-y-2">
                                    <p className="text-sm">No expenses found for {format(new Date(), 'MMMM')}.</p>
                                    <p className="text-[11px] opacity-70">Check if your transactions are from a different month or marked as "Excluded".</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Recent Transactions */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold">Recent Transactions</h3>
                        <div className="flex items-center gap-2">
                            {transactions.some(tx => tx.place_lat && tx.place_lng) && (
                                <button
                                    onClick={() => setIsMapOpen(true)}
                                    className="text-xs text-emerald-400 font-bold hover:text-emerald-300 transition-colors uppercase tracking-wider px-2 py-1 flex items-center gap-1"
                                >
                                    <MapPin className="w-3 h-3" />
                                    Map
                                </button>
                            )}
                            <button
                                onClick={() => setIsViewAllOpen(true)}
                                className={cn(
                                    "text-xs font-bold transition-colors uppercase tracking-wider px-2 py-1",
                                    isCoupleWorkspace ? "text-rose-400 hover:text-rose-300" : "text-primary hover:text-primary/80"
                                )}
                            >
                                View All
                            </button>
                        </div>
                    </div>

                    <div className="space-y-1">
                        {displayTransactions.slice(0, 5).map((tx: Transaction) => {
                            const myShare = effectiveCalculateUserShare(tx, userId);
                            const showConverted = tx.currency && tx.currency !== currency;
                            return (
                                <TransactionRow
                                    key={tx.id}
                                    tx={tx}
                                    userId={userId}
                                    myShare={myShare}
                                    formattedAmount={formatCurrency(Math.abs(myShare), tx.currency)}
                                    formattedConverted={
                                        showConverted
                                            ? formatCurrency(convertAmount(Math.abs(myShare), tx.currency || 'USD'), currency)
                                            : undefined
                                    }
                                    showConverted={!!showConverted}
                                    canEdit={canEditTransaction(tx)}
                                    icon={getIconForCategory(tx.category, 'w-4 h-4')}
                                    color={CATEGORY_COLORS[tx.category.toLowerCase()] || CATEGORY_COLORS.uncategorized}
                                    bucketChip={getBucketChip(tx)}
                                    onHistory={() => loadAuditLogs(tx)}
                                    onEdit={() => { setEditingTransaction(tx); setIsEditOpen(true); }}
                                    onDelete={() => {
                                        toast('Delete transaction?', {
                                            action: { label: 'Delete', onClick: () => handleDeleteTransaction(tx) }
                                        });
                                    }}
                                />
                            );
                        })}
                        {displayTransactions.length === 0 && (
                            <div className="text-center text-sm text-muted-foreground/40 py-8">
                                No recent transactions found.
                            </div>
                        )}
                    </div>

                    {/* Extracted Modular Components */}
                    <DashboardTransactionsDrawer
                        isOpen={isViewAllOpen}
                        onOpenChange={setIsViewAllOpen}
                    >
                        <VirtualizedTransactionList
                            transactions={displayTransactions}
                            userId={userId}
                            currency={currency}
                            buckets={buckets}
                            calculateUserShare={effectiveCalculateUserShare}
                            getIconForCategory={getIconForCategory}
                            formatCurrency={formatCurrency}
                            convertAmount={convertAmount}
                            setEditingTransaction={setEditingTransaction}
                            setIsEditOpen={setIsEditOpen}
                            handleDeleteTransaction={handleDeleteTransaction}
                            getBucketChip={getBucketChip}
                            loadAuditLogs={loadAuditLogs}
                            canEditTransaction={canEditTransaction}
                            toast={toast}
                        />
                    </DashboardTransactionsDrawer>

                    <TransactionHistoryDialog
                        isOpen={!!selectedAuditTx}
                        onOpenChange={(open) => !open && setSelectedAuditTx(null)}
                        transaction={selectedAuditTx}
                        auditLogs={auditLogs}
                        isLoading={loadingAudit}
                    />
                </div>

                {/* Edit Transaction Dialog */}
                <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                    <DialogContent className="max-w-md rounded-3xl border-white/10 bg-card/95 backdrop-blur-xl max-h-[90vh] overflow-y-auto overflow-x-hidden no-scrollbar">
                        <DialogHeader>
                            <DialogTitle>Edit Transaction</DialogTitle>
                            <DialogDescription>Update your transaction details.</DialogDescription>
                        </DialogHeader>
                        {editingTransaction && (
                            <form onSubmit={handleUpdateTransaction} className="space-y-4 pt-4">
                                <div className="space-y-2">
                                    <Label htmlFor="edit-description">Description</Label>
                                    <Input
                                        id="edit-description"
                                        value={editingTransaction.description}
                                        onChange={(e) => setEditingTransaction({ ...editingTransaction, description: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-amount">Amount</Label>
                                    <Input
                                        id="edit-amount"
                                        type="number"
                                        step="0.01"
                                        value={editingTransaction.amount}
                                        onChange={(e) => setEditingTransaction({ ...editingTransaction, amount: parseFloat(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="edit-category">Category</Label>
                                    <Select
                                        value={editingTransaction.category}
                                        onValueChange={(val) => setEditingTransaction({ ...editingTransaction, category: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select category" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-card/95 backdrop-blur-xl border-white/10">
                                            {Object.keys(chartConfig).map((cat) => (
                                                <SelectItem key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {/* Bucket Selection in Edit Mode */}
                                <div className="space-y-2">
                                    <Label>Personal Bucket (Private)</Label>
                                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                        <div
                                            onClick={() => setEditingTransaction({ ...editingTransaction, bucket_id: undefined })}
                                            className={cn(
                                                "flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all min-w-[70px] cursor-pointer",
                                                !editingTransaction.bucket_id
                                                    ? "bg-secondary/30 border-white/20"
                                                    : "bg-background/20 border-white/5 hover:border-white/10"
                                            )}
                                        >
                                            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-secondary/20 border border-white/5">
                                                <X className="w-3.5 h-3.5 text-muted-foreground" />
                                            </div>
                                            <span className="text-[9px] font-medium truncate w-14 text-center">None</span>
                                        </div>
                                        {activeBuckets.map((bucket) => (
                                            <div
                                                key={bucket.id}
                                                onClick={() => setEditingTransaction({ ...editingTransaction, bucket_id: bucket.id })}
                                                className={cn(
                                                    "flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all min-w-[70px] cursor-pointer",
                                                    editingTransaction.bucket_id === bucket.id
                                                        ? "bg-primary/20 border-primary shadow-[0_0_15px_rgba(138,43,226,0.2)]"
                                                        : "bg-background/20 border-white/5 hover:border-white/10"
                                                )}
                                            >
                                                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-secondary/20 border border-white/5">
                                                    <div className="w-4 h-4 text-primary">
                                                        {getBucketIcon(bucket.icon)}
                                                    </div>
                                                </div>
                                                <span className="text-[9px] font-medium truncate w-14 text-center">{bucket.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {/* Exclude from Allowance Toggle */}
                                <div className="space-y-4 pt-2">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Wallet className="w-4 h-4 text-cyan-500" />
                                            <div>
                                                <p className="text-sm font-medium">Exclude from Allowance</p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={!!editingTransaction.exclude_from_allowance}
                                            onCheckedChange={(val: boolean) => setEditingTransaction({ ...editingTransaction, exclude_from_allowance: val })}
                                            className="data-[state=checked]:bg-cyan-500"
                                        />
                                    </div>
                                </div>
                                {/* Location in Edit Mode */}
                                <LocationPicker
                                    placeName={editingTransaction.place_name || null}
                                    placeAddress={editingTransaction.place_address || null}
                                    placeLat={editingTransaction.place_lat || null}
                                    placeLng={editingTransaction.place_lng || null}
                                    onChange={(loc) => setEditingTransaction({
                                        ...editingTransaction,
                                        place_name: loc.place_name || undefined,
                                        place_address: loc.place_address || undefined,
                                        place_lat: loc.place_lat || undefined,
                                        place_lng: loc.place_lng || undefined,
                                    })}
                                />
                                <DialogFooter className="pt-4 gap-2 sm:gap-0">
                                    <DialogClose asChild>
                                        <Button type="button" variant="outline" className="rounded-xl">Cancel</Button>
                                    </DialogClose>
                                    <Button type="submit" className="rounded-xl bg-primary hover:bg-primary/90">Save Changes</Button>
                                </DialogFooter>
                            </form>
                        )}
                    </DialogContent>
                </Dialog>

                {/* Expense Map View */}
            <ExpenseMapView 
                isOpen={isMapOpen}
                onClose={() => setIsMapOpen(false)}
                transactions={transactions}
                formatCurrency={formatCurrency}
            />

            {/* Quick Record Modal */}
                <WelcomeModal
                    isOpen={activeModal === 'welcome'}
                    onClose={() => {
                        if (userId) {
                            localStorage.setItem(`welcome_seen_${userId}`, 'true');
                        }

                        const lastSeenId = userId
                            ? localStorage.getItem(`last_seen_feature_id_${userId}`)
                            : localStorage.getItem('last_seen_feature_id');

                        if (lastSeenId !== LATEST_FEATURE_ANNOUNCEMENT.id) {
                            setActiveModal('announcement');
                        } else {
                            setActiveModal(null);
                        }
                    }}
                />

                <FeatureAnnouncementModal
                    showAnnouncement={activeModal === 'announcement'}
                    userId={userId}
                    onClose={() => setActiveModal(null)}
                />

                {/* Suspense for lazy loaded dialogs */}
                <Suspense fallback={null}>
                    <AddFundsDialog
                        isOpen={isAddFundsOpen}
                        onClose={() => setIsAddFundsOpen(false)}
                        userId={userId}
                        defaultBucketId={isBucketFocused ? dashboardFocus : undefined}
                        onSuccess={() => userId && loadTransactions(userId)}
                    />
                    
                    <HowToUseDialog
                        isOpen={isHowToUseOpen}
                        onClose={() => setIsHowToUseOpen(false)}
                    />
                </Suspense>
            </div>
        </motion.div>
    );
}
