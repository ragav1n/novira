'use client';

import React, { useMemo, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import {
    CheckSquare, Square, SearchX, Tag, Plane, Home, Gift, Car, Utensils,
    ShoppingCart, Heart, Gamepad2, School, Laptop, Music, Receipt,
} from 'lucide-react';
import { TransactionRow } from '@/components/transaction-row';
import { CATEGORY_COLORS } from '@/lib/categories';
import { Transaction } from '@/types/transaction';
import { highlightMatch, parseNumericQuery, type SortOption } from '@/lib/search-utils';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { useBucketsList } from '@/components/providers/buckets-provider';
import { useWorkspaceTheme } from '@/hooks/useWorkspaceTheme';
import { cn } from '@/lib/utils';
import { toast } from '@/utils/haptics';
import { SearchSkeleton } from './search-skeleton';
import { EmptyState, accentFromTheme } from '@/components/ui/empty-state';

const bucketIcons: Record<string, React.ElementType> = {
    Tag, Plane, Home, Gift, Car, Utensils, ShoppingCart,
    Heart, Gamepad2, School, Laptop, Music,
};

/** Search rows are read-only (`canEdit={false}`), so edit/delete are never reachable.
 *  A module-level no-op keeps the prop identity stable across renders. */
const noop = () => {};

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
    error: boolean;
    hasActiveFilters: boolean;
    onRetry: () => void;
    sortBy: SortOption;
    bulkMode: boolean;
    selectedIds: Set<string>;
    toggleSelection: (id: string) => void;
    debouncedSearchQuery: string;
    onViewReceipt: (path: string) => void;
    onResetFilters: () => void;
    /** Row cap when the query matched more than we fetched; null when complete. */
    truncatedAt?: number | null;
}

export function SearchResultsList({
    transactions, loading, error, hasActiveFilters, onRetry, sortBy, bulkMode, selectedIds, toggleSelection,
    debouncedSearchQuery, onViewReceipt, onResetFilters, truncatedAt = null,
}: Props) {
    const { formatCurrency, convertAmount, currency, userId } = useUserPreferences();
    const { buckets } = useBucketsList();
    const { theme: themeConfig } = useWorkspaceTheme();

    // `buckets.find()` per row is O(rows × buckets), and this list carries up to 300
    // rows. One Map makes each lookup O(1).
    const bucketsById = useMemo(
        () => new Map(buckets.map(b => [b.id, b])),
        [buckets],
    );

    // useCallback, not a bare function: this is passed straight to every row as
    // `renderBucketChip`, so an unstable identity here would defeat the row memo on
    // its own.
    const getBucketChip = useCallback((tx: Transaction) => {
        if (!tx.bucket_id) return null;
        const txBucket = bucketsById.get(tx.bucket_id);
        if (!txBucket) return null;
        const Icon = bucketIcons[txBucket.icon || 'Tag'] || Tag;
        return (
            <span className="flex items-center gap-1.5 text-meta font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                <div className="w-2.5 h-2.5 shrink-0"><Icon className="w-full h-full" /></div>
                {txBucket.name}
            </span>
        );
    }, [bucketsById]);

    const numericQueryActive = parseNumericQuery(debouncedSearchQuery);

    // Stable row callbacks, so each TransactionRow's `memo` can skip when only the
    // parent re-rendered. `renderDescription` intentionally depends on the query:
    // when it changes the identity changes and every row re-renders, which is
    // exactly right — the highlights have to move.
    const renderDescription = useMemo(() => {
        const queryActive = !!debouncedSearchQuery && !numericQueryActive;
        if (!queryActive) return undefined;
        return (tx: Transaction) => highlightMatch(tx.description, debouncedSearchQuery);
    }, [debouncedSearchQuery, numericQueryActive]);

    const handleHistory = useCallback(
        () => toast('History is available from the dashboard'),
        [],
    );
    const handleViewReceipt = useCallback((tx: Transaction) => {
        // The row already gates the affordance on `tx.receipt_path`; this guard keeps
        // the callback identity stable instead of making the prop conditional.
        if (tx.receipt_path) onViewReceipt(tx.receipt_path);
    }, [onViewReceipt]);

    return (
        <div className={cn(
            "space-y-0 overflow-y-auto pr-1 -mr-1 h-full flex-1",
            // Don't dim/blur while the skeleton is showing — it was blurring its own
            // placeholder. The dim is only meaningful over real, stale content.
            loading && "pointer-events-none"
        )}>
            {loading ? (
                <SearchSkeleton />
            ) : error ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <EmptyState
                        size="page"
                        variant="error"
                        eyebrow="Couldn't search"
                        description="We couldn't reach your transactions. This isn't a result — check your connection and try again."
                        accent={accentFromTheme(themeConfig)}
                        action={{ label: 'Try again', onClick: onRetry }}
                    />
                </motion.div>
            ) : (
                // Plain sync mode, not `mode="popLayout"`. popLayout absolutely-positions
                // every exiting child and measures it to hold its place — fine for a
                // reorderable list of a dozen, but this list carries up to 300 rows
                // (search-view's SEARCH_RESULT_LIMIT) and swaps wholesale on each debounced
                // keystroke. There is no reorder to preserve here: results are replaced,
                // not moved. What's left is the exit fade for a row removed in place
                // (bulk delete, recategorise out of the filter), which is worth keeping.
                <AnimatePresence initial={false}>
                    {transactions.length > 0 ? (
                        (() => {
                            const groupByDate = sortBy.startsWith('date');
                            const nodes: React.ReactNode[] = [];
                            let lastDateKey: string | null = null;
                            for (const tx of transactions) {
                                const dateKey = (tx.date || '').slice(0, 10);
                                if (groupByDate && dateKey && dateKey !== lastDateKey) {
                                    lastDateKey = dateKey;
                                    nodes.push(
                                        <div
                                            key={`hdr-${dateKey}`}
                                            className="sticky top-0 z-10 bg-background/85 backdrop-blur px-2 pt-3 pb-1.5 text-eyebrow uppercase text-muted-foreground/70"
                                        >
                                            {format(parseISO(dateKey), 'EEE, MMM d')}
                                        </div>
                                    );
                                }
                                const myShare = calculateUserShare(tx, userId);
                                const showConverted = !!(tx.currency && tx.currency.toUpperCase() !== currency.toUpperCase());
                                const color = CATEGORY_COLORS[tx.category?.toLowerCase()] || CATEGORY_COLORS.uncategorized;
                                const isSelected = selectedIds.has(tx.id);
                                const row = (
                                    <TransactionRow
                                        key={tx.id}
                                        tx={tx}
                                        // A new query replaces the whole list; 300
                                        // simultaneous entrance tweens is not motion, it's
                                        // jank. The skeleton already covers the swap.
                                        animateEntrance={false}
                                        // Up to 300 rows in one pass — this is the list
                                        // that most needs off-screen rows to cost nothing,
                                        // and the only one that never had it.
                                        deferOffscreen
                                        userId={userId}
                                        myShare={myShare}
                                        formattedAmount={formatCurrency(Math.abs(myShare), tx.currency)}
                                        formattedConverted={showConverted ? formatCurrency(convertAmount(Math.abs(myShare), tx.currency || 'USD', currency), currency) : undefined}
                                        showConverted={showConverted}
                                        canEdit={false}
                                        color={color}
                                        renderBucketChip={getBucketChip}
                                        renderDescription={renderDescription}
                                        onHistory={handleHistory}
                                        onEdit={noop}
                                        onDelete={noop}
                                        onViewReceipt={handleViewReceipt}
                                    />
                                );
                                if (!bulkMode) {
                                    nodes.push(row);
                                } else {
                                    nodes.push(
                                        // The whole selection UI was a plain onClick div
                                        // with a pointer-events-none child, so it was
                                        // unreachable by keyboard and exposed no state
                                        // to assistive tech.
                                        <div
                                            key={tx.id}
                                            role="checkbox"
                                            aria-checked={isSelected}
                                            aria-label={`Select ${tx.description}`}
                                            tabIndex={0}
                                            onClick={() => toggleSelection(tx.id)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    toggleSelection(tx.id);
                                                }
                                            }}
                                            className={cn(
                                                "relative flex items-center gap-2 cursor-pointer rounded-xl transition-colors",
                                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                                                isSelected && 'bg-white/[0.04]'
                                            )}
                                        >
                                            <div className="pl-2 shrink-0">
                                                {isSelected
                                                    ? <CheckSquare className={cn("w-5 h-5", themeConfig.text)} aria-hidden="true" />
                                                    : <Square className="w-5 h-5 text-muted-foreground/60" aria-hidden="true" />}
                                            </div>
                                            <div className="flex-1 min-w-0 pointer-events-none">
                                                {row}
                                            </div>
                                        </div>
                                    );
                                }
                            }
                            if (truncatedAt !== null) {
                                // Lives here rather than in the stats hero above, because
                                // that hero only renders once a filter or query is active
                                // and the query that truncates is the empty one.
                                nodes.push(
                                    <p
                                        key="truncation-notice"
                                        role="status"
                                        className="px-2 py-4 text-center text-xs text-muted-foreground/60"
                                    >
                                        Showing the first {truncatedAt}. Narrow the search to see more.
                                    </p>
                                );
                            }
                            return nodes;
                        })()
                    ) : (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            {hasActiveFilters ? (
                                <EmptyState
                                    size="page"
                                    icon={SearchX}
                                    eyebrow="No matches"
                                    description="Try a wider date range or clear some filters."
                                    accent={accentFromTheme(themeConfig)}
                                    secondaryAction={{ label: 'Reset filters', onClick: onResetFilters }}
                                />
                            ) : (
                                // No filters are active, so this isn't a filtered-out result —
                                // the account genuinely has nothing to search yet.
                                <EmptyState
                                    size="page"
                                    icon={Receipt}
                                    eyebrow="Nothing to search yet"
                                    description="Once you add a few expenses, you can search them by description, amount, category or tag."
                                    accent={accentFromTheme(themeConfig)}
                                    action={{ label: 'Add an expense', href: '/add' }}
                                />
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            )}
        </div>
    );
}
