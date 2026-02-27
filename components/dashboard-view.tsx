'use client';

import { useUserPreferences, CURRENCY_SYMBOLS, type Currency } from '@/components/providers/user-preferences-provider';
import { BudgetAlertManager } from '@/components/budget-alert-manager';
import React, { useEffect, useState, useRef, useCallback, useMemo, startTransition, lazy, Suspense } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRouter } from 'next/navigation';
import { Plus, Utensils, Car, Zap, ShoppingBag, HeartPulse, Clapperboard, CircleDollarSign, ArrowUpRight, ArrowDownLeft, Users, MoreVertical, Pencil, Trash2, X, History, Clock, HelpCircle, Tag, Plane, Home, Gift, ShoppingCart, Stethoscope, Gamepad2, School, Laptop, Music, Heart, RefreshCcw, Wallet, ChevronRight, Check, Shirt, LayoutGrid } from 'lucide-react';
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

type Transaction = {
    id: string;
    description: string;
    amount: number;
    category: string;
    is_settlement?: boolean;
    date: string;
    created_at: string;
    user_id: string;
    currency?: string;
    exchange_rate?: number;
    base_currency?: string;
    converted_amount?: number;
    is_recurring?: boolean;
    bucket_id?: string;
    exclude_from_allowance?: boolean;
    splits?: {
        user_id: string;
        amount: number;
        is_paid: boolean;
    }[];
    profile?: {
        full_name: string;
    };
};

type SpendingCategory = {
    name: string;
    value: number;
    color: string;
    fill: string;
};
type AuditLog = {
    id: string;
    action: 'INSERT' | 'UPDATE' | 'DELETE';
    old_data: any;
    new_data: any;
    created_at: string;
    changed_by_profile?: {
        full_name: string;
    };
};

const VirtualizedTransactionList = React.memo(function VirtualizedTransactionList({
  transactions, userId, currency, buckets,
  calculateUserShare, getIconForCategory, formatCurrency,
  convertAmount, setEditingTransaction, setIsEditOpen,
  handleDeleteTransaction, getBucketChip, loadAuditLogs,
  canEditTransaction, toast
}: any) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: transactions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 130, // Tall enough for badge row
    overscan: 10,
  });

  return (
    <div ref={parentRef} className="overflow-auto h-[65vh]">
      <div
        style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualItem) => {
          const tx = transactions[virtualItem.index];
          const myShare = calculateUserShare(tx, userId);
          const showConverted = tx.currency && tx.currency !== currency;

          return (
            <div
              key={tx.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
              className="px-2"
            >
              <TransactionRow
                tx={tx}
                userId={userId}
                myShare={myShare}
                formattedAmount={formatCurrency(Math.abs(myShare), tx.currency)}
                formattedConverted={
                  showConverted
                    ? formatCurrency(convertAmount(Math.abs(myShare), tx.currency || 'USD'), currency)
                    : undefined
                }
                showConverted={showConverted}
                canEdit={canEditTransaction(tx)}
                icon={getIconForCategory(tx.category, 'w-4 h-4')}
                color={CATEGORY_COLORS[tx.category.toLowerCase()] || CATEGORY_COLORS.uncategorized}
                bucketChip={getBucketChip(tx)}
                onHistory={() => loadAuditLogs(tx)}
                onEdit={() => {
                  setEditingTransaction(tx);
                  setIsEditOpen(true);
                }}
                onDelete={() => {
                  toast('Delete transaction?', {
                    action: { label: 'Delete', onClick: () => handleDeleteTransaction(tx) }
                  });
                }}
              />
            </div>
          );
        })}

        {transactions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/40 text-sm">
            No transactions found.
          </div>
        )}
      </div>
    </div>
  );
});

export function DashboardView() {
    const router = useRouter();
    const [userName, setUserName] = useState<string>('User');
    const [transactions, setTransactions] = useState<Transaction[]>([]);

    const [loading, setLoading] = useState(true);
    const { formatCurrency, currency, convertAmount, monthlyBudget, userId, isRatesLoading, avatarUrl } = useUserPreferences();
    const { balances, groups, friends } = useGroups();
    const { buckets } = useBuckets();

    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);

    const [selectedAuditTx, setSelectedAuditTx] = useState<Transaction | null>(null);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [loadingAudit, setLoadingAudit] = useState(false);

    // Dashboard Focus State
    const [dashboardFocus, setDashboardFocus] = useState<string>('');
    const [isFocusRestored, setIsFocusRestored] = useState(false);
    const [isAddFundsOpen, setIsAddFundsOpen] = useState(false);
    const [isHowToUseOpen, setIsHowToUseOpen] = useState(false);

    // Modal Sequencing State
    const [activeModal, setActiveModal] = useState<'welcome' | 'announcement' | null>(null);
    const [isFocusMenuOpen, setIsFocusMenuOpen] = useState(false);
    const focusSelectorRef = useRef<HTMLDivElement>(null);
    const [hoveredFocusId, setHoveredFocusId] = useState<string | null>(null);
    
    // Virtualization parent ref for "View All" modal
    const parentRef = useRef<HTMLDivElement>(null);

    // Modal Interaction State
    const [isViewAllOpen, setIsViewAllOpen] = useState(false);
    const isAnyModalOpen = isViewAllOpen || activeModal !== null || isAddFundsOpen || isHowToUseOpen || isEditOpen;

    // Debounced realtime refresh for transaction changes
    const txDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const debouncedLoadTx = useCallback((uid: string) => {
        if (txDebounceRef.current) clearTimeout(txDebounceRef.current);
        txDebounceRef.current = setTimeout(() => {
            loadTransactions(uid);
        }, 300);
    }, []);

    useEffect(() => {
        return () => {
            if (txDebounceRef.current) clearTimeout(txDebounceRef.current);
        };
    }, []);

    useEffect(() => {
        if (!userId) return;

        const channel = supabase
            .channel('db-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'transactions',
                },
                () => {
                    debouncedLoadTx(userId);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId, debouncedLoadTx]);

    // Handle modal sequencing and initial data load
    useEffect(() => {
        if (userId) {
            // 1. Sync Restoration (Critical to do before any async calls to avoid race conditions)
            if (!isFocusRestored) {
                const savedFocus = localStorage.getItem(`dashboard_focus_${userId}`);
                setDashboardFocus(savedFocus || 'allowance');
                setIsFocusRestored(true);
            }

            // Modal Sequencing Logic (Per-User)
            const hasSeenWelcome = localStorage.getItem(`welcome_seen_${userId}`);
            const lastSeenFeatureId = localStorage.getItem(`last_seen_feature_id_${userId}`) || localStorage.getItem('last_seen_feature_id');
            const hasNewAnnouncement = lastSeenFeatureId !== LATEST_FEATURE_ANNOUNCEMENT.id;

            if (!hasSeenWelcome) {
                setTimeout(() => setActiveModal('welcome'), 1500);
            } else if (hasNewAnnouncement) {
                setTimeout(() => setActiveModal('announcement'), 1500);
            }

            // Parallel Data Fetching
            const fetchData = async () => {
                try {
                    const { data } = await supabase
                        .from('profiles')
                        .select('full_name')
                        .eq('id', userId)
                        .single();

                    if (data) {
                        setUserName(data.full_name || 'User');
                    }

                    await loadTransactions(userId);
                } catch (error) {
                    console.error("Error fetching data:", error);
                } finally {
                    setLoading(false);
                }
            };
            fetchData();
        } else if (!loading) {
            setLoading(false);
        }
    }, [userId, loading, isFocusRestored]);

    // Save Focus Mode Persistence
    useEffect(() => {
        // Only save if we have successfully restored AND have a valid value
        if (userId && dashboardFocus && isFocusRestored && dashboardFocus !== '') {
            localStorage.setItem(`dashboard_focus_${userId}`, dashboardFocus);
        }
    }, [userId, dashboardFocus, isFocusRestored]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (focusSelectorRef.current && !focusSelectorRef.current.contains(event.target as Node)) {
                setIsFocusMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const loadTransactions = async (currentUserId: string) => {
        try {
            const { data: txs } = await supabase
                .from('transactions')
                .select('id, description, amount, category, date, created_at, user_id, currency, exchange_rate, base_currency, bucket_id, exclude_from_allowance, is_recurring, profile:profiles(full_name), splits(user_id, amount, is_paid)')
                .order('date', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(200);

            if (txs) {
                // Flatten profile and splits if they are arrays (Supabase dynamic returns)
                const formattedTxs = txs.map(tx => ({
                    ...tx,
                    profile: Array.isArray(tx.profile) ? tx.profile[0] : tx.profile,
                    splits: tx.splits || []
                })) as Transaction[];
                setTransactions(formattedTxs);
            }
        } catch (error) {
            console.error("Error loading transactions:", error);
        }
    };

    const handleDeleteTransaction = async (tx: Transaction) => {
        // Optimistic: remove from UI immediately
        const previousTransactions = [...transactions];
        setTransactions(prev => prev.filter(t => t.id !== tx.id));
        toast.success('Transaction deleted');

        try {
            const { error } = await supabase
                .from('transactions')
                .delete()
                .eq('id', tx.id);

            if (error) throw error;

            // If recurring, ask if user wants to stop future ones
            if (tx.is_recurring) {
                // We use a small delay to not collide with the previous toast
                setTimeout(() => {
                    toast('This was a recurring expense.', {
                        description: 'Stop future occurrences too?',
                        action: {
                            label: 'Stop Series',
                            onClick: async () => {
                                try {
                                    const { error } = await supabase
                                        .from('recurring_templates')
                                        .delete()
                                        .eq('user_id', userId)
                                        .eq('description', tx.description)
                                        .eq('amount', tx.amount);

                                    if (error) throw error;
                                    toast.success('Recurring series stopped');
                                } catch (err: any) {
                                    toast.error('Failed to stop series: ' + err.message);
                                }
                            }
                        }
                    });
                }, 1000);
            }
        } catch (error: any) {
            // Rollback on failure
            setTransactions(previousTransactions);
            toast.error('Failed to delete: ' + error.message);
        }
    };

    const handleUpdateTransaction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTransaction) return;

        // Optimistic: update in UI immediately
        const previousTransactions = [...transactions];
        setTransactions(prev => prev.map(tx =>
            tx.id === editingTransaction.id
                ? { ...tx, ...editingTransaction }
                : tx
        ));
        toast.success('Transaction updated');
        setIsEditOpen(false);
        const savedEditingTx = editingTransaction;
        setEditingTransaction(null);

        try {
            const { error } = await supabase
                .from('transactions')
                .update({
                    description: savedEditingTx.description,
                    category: savedEditingTx.category,
                    amount: savedEditingTx.amount,
                    bucket_id: savedEditingTx.bucket_id || null,
                    exclude_from_allowance: savedEditingTx.exclude_from_allowance || false,
                })
                .eq('id', savedEditingTx.id);

            if (error) throw error;
        } catch (error: any) {
            // Rollback on failure
            setTransactions(previousTransactions);
            toast.error('Failed to update: ' + error.message);
        }
    };

    const loadAuditLogs = async (tx: Transaction) => {
        setSelectedAuditTx(tx);
        setLoadingAudit(true);
        try {
            const { data, error } = await supabase
                .from('transaction_history')
                .select('*, changed_by_profile:profiles(full_name)')
                .eq('transaction_id', tx.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setAuditLogs(data || []);
        } catch (error: any) {
            console.error("Error loading audit logs:", error);
            toast.error("Failed to load history");
        } finally {
            setLoadingAudit(false);
        }
    };

    const canEditTransaction = useCallback((tx: Transaction) => {
        if (tx.user_id !== userId) return false;
        return isSameMonth(parseISO(tx.date), new Date());
    }, [userId]);

    const calculateUserShare = useCallback((tx: Transaction, currentUserId: string | null) => {
        if (!currentUserId) return 0;

        // CASH BASIS LOGIC:
        // 1. If I PAID the transaction (user_id === currentUserId), I spent the FULL amount immediately.
        //    Reimbursements will come later as separate 'Settlement Received' transactions (negative amount).
        if (tx.user_id === currentUserId) {
            return Number(tx.amount);
        }

        // 2. If I am a DEBTOR (in splits) but didn't pay:
        //    - I haven't "spent" money yet in cash items.
        //    - My expense will be recorded when I SETTLE (via 'Settlement Sent' transaction).
        //    - So for the ORIGINAL split transaction, my share is 0.
        return 0;
    }, []);

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

    const effectiveFocus = dashboardFocus || 'allowance';
    const focusedBucket = effectiveFocus !== 'allowance' ? buckets.find(b => b.id === effectiveFocus) : null;
    const isBucketFocused = effectiveFocus !== 'allowance';
    const bucketCurrency = (focusedBucket?.currency || currency).toUpperCase() as Currency;
    const displayBudget = isBucketFocused && focusedBucket ? Number(focusedBucket.budget) : monthlyBudget;

    // Memoize active (non-archived) buckets to avoid repeated filtering in JSX
    const activeBuckets = useMemo(() => buckets.filter(b => !b.is_archived), [buckets]);

    // Calculate personal share for budget tracking
    const totalSpent = useMemo(() => transactions.reduce((acc, tx) => {
        if (!userId) return acc;

        if (isBucketFocused) {
            // Project Focus: show all expenses for this project bucket (all time)
            if (tx.bucket_id !== effectiveFocus) return acc;
        } else {
            // Allowance Focus: exclude project elements that are marked explicitly
            if (tx.exclude_from_allowance) return acc;
            
            // Filter for current month using parseISO
            const txDate = parseISO(tx.date);
            if (!isSameMonth(txDate, new Date())) return acc;
        }

        const myShare = calculateUserShare(tx, userId);

        // Conversion Logic:
        const txCurr = (tx.currency || 'USD').toUpperCase();
        const targetCurr = bucketCurrency;
        
        const isSameCurrency = txCurr === targetCurr;
        
        if (!isSameCurrency && tx.exchange_rate && tx.exchange_rate !== 1 && tx.base_currency === targetCurr) {
            return acc + (myShare * Number(tx.exchange_rate));
        }

        return acc + convertAmount(myShare, txCurr, targetCurr);
    }, 0), [transactions, userId, isBucketFocused, dashboardFocus, calculateUserShare, bucketCurrency, convertAmount]);

    const remaining = displayBudget - totalSpent;
    const progress = displayBudget > 0 ? Math.min((totalSpent / displayBudget) * 100, 100) : 0;

    // Calculate Spending by Category (converted personal share)
    const spendingByCategory = useMemo(() => transactions.reduce((acc, tx) => {
        if (!userId) return acc;

        if (isBucketFocused) {
            // Project Focus: show all expenses for this project bucket (all time)
            if (tx.bucket_id !== effectiveFocus) return acc;
        } else {
            // Allowance Focus: exclude project elements that are marked explicitly
            if (tx.exclude_from_allowance) return acc;
            
            // Filter for current month using parseISO
            const txDate = parseISO(tx.date);
            if (!isSameMonth(txDate, new Date())) return acc;
        }

        const cat = tx.category.toLowerCase();
        const myShare = calculateUserShare(tx, userId);

        if (myShare > 0) {
            if (!acc[cat]) acc[cat] = 0;

            const txCurr = tx.currency || 'USD';
            const isSameCurrency = txCurr === currency;

            if (!isSameCurrency && tx.exchange_rate && tx.exchange_rate !== 1 && tx.base_currency === currency) {
                acc[cat] += (myShare * Number(tx.exchange_rate));
            } else {
                acc[cat] += convertAmount(myShare, txCurr);
            }
        }
        return acc;
    }, {} as Record<string, number>), [transactions, userId, isBucketFocused, effectiveFocus, calculateUserShare, currency, convertAmount]);

    const spendingData: SpendingCategory[] = useMemo(() => Object.entries(spendingByCategory).map(([cat, value]) => ({
        name: cat.charAt(0).toUpperCase() + cat.slice(1),
        value,
        color: CATEGORY_COLORS[cat] || CATEGORY_COLORS.others,
        fill: CATEGORY_COLORS[cat] || CATEGORY_COLORS.others,
    })), [spendingByCategory]);


    // Filter transactions to only show relevant ones (where user has a share, paid, or it's a settlement for them)
    const displayTransactions = useMemo(() => transactions.filter(tx => {
        if (tx.user_id === userId) return true; // I paid or created the settlement
        if (tx.splits && tx.splits.some(s => s.user_id === userId)) return true; // I'm in splits
        return false;
    }), [transactions, userId]);

    return (
        <div className="relative min-h-screen">
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
                        <div className="absolute -top-[10%] -left-[10%] w-[70%] h-[70%] rounded-full blur-[80px] bg-cyan-500 opacity-[0.2] gpu" />
                        <div className="absolute -bottom-[10%] -right-[10%] w-[60%] h-[60%] rounded-full blur-[70px] bg-teal-500 opacity-10 gpu" />
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
                        <div className="absolute top-[20%] -right-[10%] w-[60%] h-[60%] rounded-full blur-[80px] bg-primary opacity-15 gpu" />
                        <div className="absolute bottom-[20%] -left-[10%] w-[50%] h-[50%] rounded-full blur-[70px] bg-primary/40 opacity-10 gpu" />
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {loading && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-background/20 backdrop-blur-[2px]"
                    >
                        <WaveLoader bars={5} message="" />
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
                        <div className="min-w-0">
                            <h1 className="text-xl font-bold flex items-center gap-1.5 min-w-0">
                                <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-white/80 truncate">
                                    Hi, {userName.split(' ')[0]}!
                                </span>
                                <span className="shrink-0">👋</span>
                            </h1>
                            <p className="text-[11px] text-muted-foreground font-medium truncate">Track your expenses with Novira</p>
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
                                <span className="truncate">{isBucketFocused ? "Target" : "Allowance"}: {formatCurrency(displayBudget, bucketCurrency)}</span>
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

                {/* Separate Add Funds Action */}
                <div className="flex justify-center mt-4 mb-6 relative group">
                    <button 
                        onClick={() => setIsAddFundsOpen(true)}
                        className="flex items-center justify-center w-full gap-2 py-4 rounded-3xl bg-primary/20 backdrop-blur-xl border border-primary/30 text-white font-bold transition-all shadow-[0_4px_30px_rgba(138,43,226,0.15)] active:scale-95 hover:bg-primary/30 hover:border-primary/50"
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
                        <span className="text-[11px] bg-secondary/50 backdrop-blur-md px-3 py-1 rounded-full text-primary border border-primary/20 font-bold uppercase tracking-wider whitespace-nowrap">{format(new Date(), 'MMMM')} Overview</span>
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
                <button 
                    onClick={() => setIsViewAllOpen(true)}
                    className="text-xs text-primary font-bold hover:text-primary/80 transition-colors uppercase tracking-wider px-2 py-1"
                >
                    View All
                </button>
                    </div>

                    <div className="space-y-1">
                        {displayTransactions.slice(0, 5).map((tx: Transaction) => {
                            const myShare = calculateUserShare(tx, userId);
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
                            calculateUserShare={calculateUserShare}
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
                    <DialogContent className="max-w-md rounded-3xl border-white/10 bg-card/95 backdrop-blur-xl">
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

                {/* Feature Modals */}
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
        </div>
    );
}
