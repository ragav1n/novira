'use client';

import { useUserPreferences, CURRENCY_SYMBOLS, type Currency } from '@/components/providers/user-preferences-provider';
import { BudgetAlertManager } from '@/components/budget-alert-manager';
import React, { useEffect, useState, useRef, useCallback, useMemo, startTransition, lazy, Suspense } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRouter } from 'next/navigation';
import { Plus, Utensils, Car, Zap, ShoppingBag, HeartPulse, Clapperboard, CircleDollarSign, ArrowUpRight, ArrowDownLeft, Users, MoreVertical, Pencil, Trash2, X, History, Clock, HelpCircle, Tag, Plane, Home, Gift, ShoppingCart, Stethoscope, Gamepad2, School, Laptop, Music, Heart, RefreshCcw, Wallet, ChevronRight, Check, Shirt, LayoutGrid, MapPin, Target, ChevronDown, UserCircle, Building2 } from 'lucide-react';
import { format, isSameMonth, parseISO, differenceInDays } from 'date-fns';
import { WaveLoader } from '@/components/ui/wave-loader';
import { AnimatePresence, motion } from 'framer-motion';
import { CATEGORY_COLORS, getIconForCategory, CHART_CONFIG } from '@/lib/categories';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import dynamic from 'next/dynamic';
const ChartContainer: any = dynamic(() => import("@/components/ui/pie-chart").then(mod => mod.ChartContainer as any), { ssr: false });
const ChartTooltip: any = dynamic(() => import("@/components/ui/pie-chart").then(mod => mod.ChartTooltip as any), { ssr: false });
const ChartTooltipContent: any = dynamic(() => import("@/components/ui/pie-chart").then(mod => mod.ChartTooltipContent as any), { ssr: false });
import { BasePieChart } from '@/components/charts/base-pie-chart';
import { TransactionService } from '@/lib/services/transaction-service';
import { Transaction, AuditLog } from '@/types/transaction';
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
import { WorkspaceHeader } from './dashboard/workspace-header';
import { SpendingOverview } from './dashboard/spending-overview';
import { TransactionListSection } from './dashboard/transaction-list-section';
import { DashboardDialogs } from './dashboard/dashboard-dialogs';
import { DashboardSkeleton } from './dashboard/dashboard-skeleton';

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





type SpendingCategory = {
    name: string;
    value: number;
    color: string;
    fill: string;
};

import { useDashboardData } from '@/hooks/useDashboardData';
import { useDashboardState } from '@/hooks/useDashboardState';
import { useDashboardStats } from '@/hooks/useDashboardStats';



export function DashboardView() {
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
    }, []);

    const router = useRouter();
    const { 
        formatCurrency, currency, convertAmount, monthlyBudget, setMonthlyBudget, 
        userId, isRatesLoading, avatarUrl, fullName: userName, 
        activeWorkspaceId, setActiveWorkspaceId, 
        workspaceBudgets, convertedWorkspaceBudgets, setWorkspaceBudget 
    } = useUserPreferences();
    const { balances, groups, friends } = useGroups();
    const { buckets } = useBuckets();

    const {
        transactions, loading, editingTransaction, setEditingTransaction,
        isEditOpen, setIsEditOpen, selectedAuditTx, setSelectedAuditTx,
        auditLogs, loadingAudit, handleDeleteTransaction, handleUpdateTransaction, loadAuditLogs, loadTransactions
    } = useDashboardData(userId, activeWorkspaceId);


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
    const isHomeWorkspace = activeWorkspaceGroup?.type === 'home';

    const isBucketFocused = dashboardFocus !== 'allowance' && dashboardFocus !== '';
    const bucketCurrencyTemp = isBucketFocused ? buckets.find(b => b.id === dashboardFocus)?.currency || currency : currency;
    const bucketCurrency = bucketCurrencyTemp.toUpperCase() as Currency;

    const currentWorkspaceBudget = activeWorkspaceId ? (convertedWorkspaceBudgets[activeWorkspaceId] || 0) : monthlyBudget;

    const {
        focusedBucket, displayBudget, calculateUserShare, totalSpent,
        remaining, progress, spendingData, displayTransactions, recentFeed, runRateData
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
        <div className="relative min-h-[100dvh]">
            <BudgetAlertManager totalSpent={totalSpent} currency={bucketCurrency} />
            <div className={cn(
                "p-5 space-y-6 max-w-md mx-auto relative",
                mounted && !loading && isAnyModalOpen ? "pointer-events-none overflow-hidden" : "overflow-x-hidden"
            )}>
                <AnimatePresence mode="wait">
                    {!mounted || loading ? (
                        <motion.div 
                            key="skeleton"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <DashboardSkeleton />
                        </motion.div>
                    ) : (
                        <motion.div 
                            key="content"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                            className="relative"
                            inert={isAnyModalOpen ? true : undefined}
                        >
                <WorkspaceHeader 
                    userName={userName}
                    avatarUrl={avatarUrl}
                    eligibleGroups={eligibleGroups}
                    activeWorkspaceId={activeWorkspaceId}
                    setActiveWorkspaceId={setActiveWorkspaceId}
                    setDashboardFocus={setDashboardFocus}
                    setIsHowToUseOpen={setIsHowToUseOpen}
                    isCoupleWorkspace={isCoupleWorkspace}
                    isHomeWorkspace={isHomeWorkspace}
                />

                {/* Empty State */}
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
                                    className="flex-1 bg-transparent text-primary text-xs font-bold py-2.5 px-4 rounded-xl hover:bg-primary/10 transition-colors flex items-center justify-center gap-2 border border-primary/30"
                                >
                                    <Users className="w-4 h-4" />
                                    Add Friends
                                </button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <SpendingOverview 
                    totalSpent={totalSpent}
                    displayBudget={displayBudget}
                    remaining={remaining}
                    progress={progress}
                    isBucketFocused={isBucketFocused}
                    focusedBucket={focusedBucket}
                    bucketCurrency={bucketCurrency}
                    formatCurrency={formatCurrency}
                    isRatesLoading={isRatesLoading}
                    isCoupleWorkspace={isCoupleWorkspace}
                    isHomeWorkspace={isHomeWorkspace}
                    runRateData={runRateData}
                    dashboardFocus={dashboardFocus}
                    setDashboardFocus={setDashboardFocus}
                    isFocusMenuOpen={isFocusMenuOpen}
                    setIsFocusMenuOpen={setIsFocusMenuOpen}
                    activeBuckets={activeBuckets}
                    getBucketIcon={getBucketIcon}
                    setIsBudgetEditOpen={setIsBudgetEditOpen}
                    setTempBudgetInput={setTempBudgetInput}
                    hoveredFocusId={hoveredFocusId}
                    setHoveredFocusId={setHoveredFocusId}
                    focusSelectorRef={focusSelectorRef}
                    spendingData={spendingData}
                    balances={balances}
                    setIsAddFundsOpen={setIsAddFundsOpen}
                />
                <TransactionListSection 
                    isBucketFocused={isBucketFocused}
                    isMapOpen={isMapOpen}
                    setIsMapOpen={setIsMapOpen}
                    setIsViewAllOpen={setIsViewAllOpen}
                    isViewAllOpen={isViewAllOpen}
                    displayTransactions={recentFeed}
                    userId={userId}
                    currency={currency}
                    buckets={buckets}
                    calculateUserShare={effectiveCalculateUserShare}
                    canEditTransaction={canEditTransaction}
                    getBucketChip={getBucketChip}
                    loadAuditLogs={loadAuditLogs}
                    setEditingTransaction={setEditingTransaction}
                    setIsEditOpen={setIsEditOpen}
                    handleDeleteTransaction={handleDeleteTransaction}
                    isCoupleWorkspace={isCoupleWorkspace}
                    isHomeWorkspace={isHomeWorkspace}
                    formatCurrency={formatCurrency}
                    convertAmount={convertAmount}
                />

                <DashboardDialogs 
                    userId={userId}
                    currency={currency}
                    isBudgetEditOpen={isBudgetEditOpen}
                    setIsBudgetEditOpen={setIsBudgetEditOpen}
                    activeWorkspaceId={activeWorkspaceId}
                    tempBudgetInput={tempBudgetInput}
                    setTempBudgetInput={setTempBudgetInput}
                    handleSaveBudget={handleSaveBudget}
                    selectedAuditTx={selectedAuditTx}
                    setSelectedAuditTx={setSelectedAuditTx}
                    auditLogs={auditLogs}
                    loadingAudit={loadingAudit}
                    isEditOpen={isEditOpen}
                    setIsEditOpen={setIsEditOpen}
                    editingTransaction={editingTransaction}
                    setEditingTransaction={setEditingTransaction}
                    handleUpdateTransaction={handleUpdateTransaction}
                    activeBuckets={activeBuckets}
                    getBucketIcon={getBucketIcon}
                    isMapOpen={isMapOpen}
                    setIsMapOpen={setIsMapOpen}
                    transactions={transactions}
                    formatCurrency={formatCurrency}
                    convertAmount={convertAmount}
                    activeModal={activeModal}
                    setActiveModal={setActiveModal}
                    isAddFundsOpen={isAddFundsOpen}
                    setIsAddFundsOpen={setIsAddFundsOpen}
                    isHowToUseOpen={isHowToUseOpen}
                    setIsHowToUseOpen={setIsHowToUseOpen}
                    dashboardFocus={dashboardFocus}
                    isBucketFocused={isBucketFocused}
                    loadTransactions={loadTransactions}
                />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
