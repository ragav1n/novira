'use client';

import React from 'react';
import { format, parseISO } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import {
    CheckSquare, Square, SearchX, Tag, Plane, Home, Gift, Car, Utensils,
    ShoppingCart, Heart, Gamepad2, School, Laptop, Music,
} from 'lucide-react';
import { TransactionRow } from '@/components/transaction-row';
import { CATEGORY_COLORS, getIconForCategory } from '@/lib/categories';
import { Transaction } from '@/types/transaction';
import { highlightMatch, parseNumericQuery, type SortOption } from '@/lib/search-utils';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { useBucketsList } from '@/components/providers/buckets-provider';
import { useWorkspaceTheme } from '@/hooks/useWorkspaceTheme';
import { cn } from '@/lib/utils';
import { toast } from '@/utils/haptics';
import { SearchSkeleton } from './search-skeleton';

const bucketIcons: Record<string, React.ElementType> = {
    Tag, Plane, Home, Gift, Car, Utensils, ShoppingCart,
    Heart, Gamepad2, School, Laptop, Music,
};

function calculateUserShare(tx: Transaction, currentUserId: string | null): number {
    if (!currentUserId) return Number(tx.amount);
    if (tx.splits && tx.splits.length > 0) {
        if (tx.user_id === currentUserId) {
            const othersOwe = tx.splits.reduce((sum, s) => sum + Number(s.amount), 0);
            return Number(tx.amount) - othersOwe;
        } else {
            const mySplit = tx.splits.find(s => s.user_id === currentUserId);
            return mySplit ? Number(mySplit.amount) : 0;
        }
    }
    return tx.user_id === currentUserId ? Number(tx.amount) : 0;
}

interface Props {
    transactions: Transaction[];
    loading: boolean;
    sortBy: SortOption;
    bulkMode: boolean;
    selectedIds: Set<string>;
    toggleSelection: (id: string) => void;
    debouncedSearchQuery: string;
    onViewReceipt: (path: string) => void;
    onResetFilters: () => void;
}

export function SearchResultsList({
    transactions, loading, sortBy, bulkMode, selectedIds, toggleSelection,
    debouncedSearchQuery, onViewReceipt, onResetFilters,
}: Props) {
    const { formatCurrency, convertAmount, currency, userId } = useUserPreferences();
    const { buckets } = useBucketsList();
    const { theme: themeConfig } = useWorkspaceTheme();

    const getBucketChip = (tx: Transaction) => {
        if (!tx.bucket_id) return null;
        const txBucket = buckets.find(b => b.id === tx.bucket_id);
        if (!txBucket) return null;
        const Icon = bucketIcons[txBucket.icon || 'Tag'] || Tag;
        return (
            <span className="flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                <div className="w-2.5 h-2.5 shrink-0"><Icon className="w-full h-full" /></div>
                {txBucket.name}
            </span>
        );
    };

    const numericQueryActive = parseNumericQuery(debouncedSearchQuery);

    return (
        <div className={cn(
            "space-y-0 overflow-y-auto pr-1 -mr-1 h-full transition-all duration-300 flex-1",
            loading ? "opacity-50 blur-[2px] pointer-events-none" : "opacity-100 blur-0"
        )}>
            {loading ? (
                <SearchSkeleton />
            ) : (
                <AnimatePresence mode="popLayout">
                    {transactions.length > 0 ? (
                        (() => {
                            const groupByDate = sortBy.startsWith('date');
                            const nodes: React.ReactNode[] = [];
                            let lastDateKey: string | null = null;
                            const queryActive = !!debouncedSearchQuery && !numericQueryActive;
                            for (const tx of transactions) {
                                const dateKey = (tx.date || '').slice(0, 10);
                                if (groupByDate && dateKey && dateKey !== lastDateKey) {
                                    lastDateKey = dateKey;
                                    nodes.push(
                                        <div
                                            key={`hdr-${dateKey}`}
                                            className="sticky top-0 z-10 bg-background/85 backdrop-blur px-2 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
                                        >
                                            {format(parseISO(dateKey), 'EEE, MMM d')}
                                        </div>
                                    );
                                }
                                const myShare = calculateUserShare(tx, userId);
                                const showConverted = !!(tx.currency && tx.currency.toUpperCase() !== currency.toUpperCase());
                                const color = CATEGORY_COLORS[tx.category?.toLowerCase()] || CATEGORY_COLORS.uncategorized;
                                const isSelected = selectedIds.has(tx.id);
                                const descriptionNode = queryActive
                                    ? highlightMatch(tx.description, debouncedSearchQuery)
                                    : undefined;
                                const row = (
                                    <TransactionRow
                                        key={tx.id}
                                        tx={tx}
                                        userId={userId}
                                        myShare={myShare}
                                        formattedAmount={formatCurrency(Math.abs(myShare), tx.currency)}
                                        formattedConverted={showConverted ? formatCurrency(convertAmount(Math.abs(myShare), tx.currency || 'USD', currency), currency) : undefined}
                                        showConverted={showConverted}
                                        canEdit={false}
                                        icon={getIconForCategory(tx.category, 'w-4 h-4')}
                                        color={color}
                                        bucketChip={getBucketChip(tx)}
                                        descriptionNode={descriptionNode}
                                        onHistory={() => toast('History is available from the dashboard')}
                                        onEdit={() => { }}
                                        onDelete={() => { }}
                                        onViewReceipt={tx.receipt_path ? () => onViewReceipt(tx.receipt_path!) : undefined}
                                    />
                                );
                                if (!bulkMode) {
                                    nodes.push(row);
                                } else {
                                    nodes.push(
                                        <div
                                            key={tx.id}
                                            onClick={() => toggleSelection(tx.id)}
                                            className={cn(
                                                "relative flex items-center gap-2 cursor-pointer rounded-xl transition-colors",
                                                isSelected && `${themeConfig.bgMedium}`
                                            )}
                                        >
                                            <div className="pl-2 shrink-0">
                                                {isSelected
                                                    ? <CheckSquare className={cn("w-5 h-5", themeConfig.text)} />
                                                    : <Square className="w-5 h-5 text-muted-foreground" />}
                                            </div>
                                            <div className="flex-1 min-w-0 pointer-events-none">
                                                {row}
                                            </div>
                                        </div>
                                    );
                                }
                            }
                            return nodes;
                        })()
                    ) : (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex flex-col items-center justify-center py-12 px-6 text-center"
                        >
                            <div className="w-14 h-14 rounded-2xl bg-secondary/20 border border-white/5 flex items-center justify-center mb-3">
                                <SearchX className="w-6 h-6 text-muted-foreground/50" strokeWidth={1.75} />
                            </div>
                            <p className="text-sm font-bold text-muted-foreground/80">No matches</p>
                            <p className="text-xs text-muted-foreground/50 mt-1 max-w-[240px]">
                                Try a wider date range or clear some filters.
                            </p>
                            <button
                                onClick={onResetFilters}
                                className="mt-4 text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full bg-primary/15 hover:bg-primary/25 border border-primary/30 text-primary transition-colors"
                            >
                                Reset filters
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            )}
        </div>
    );
}
