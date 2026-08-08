import React, { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Receipt, CheckSquare } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { ROW } from '@/lib/motion';
import { TransactionRow } from '@/components/transaction-row';
import { BulkActionBar } from '@/components/bulk-action-bar';
import { CATEGORY_COLORS } from '@/lib/categories';
import type { Transaction } from '@/types/transaction';
import type { Bucket } from '@/components/providers/buckets-provider';
import { useAccounts } from '@/components/providers/accounts-provider';
import { EmptyState } from '@/components/ui/empty-state';

interface TransactionListProps {
  transactions: Transaction[];
  userId: string | null;
  currency: string;
  buckets: Bucket[];
  calculateUserShare: (tx: Transaction, currentUserId: string | null) => number;
  formatCurrency: (amount: number, currencyCode?: string) => string;
  convertAmount: (amount: number, fromCurrency: string, toCurrency?: string) => number;
  setEditingTransaction: (tx: Transaction) => void;
  setIsEditOpen: (open: boolean) => void;
  handleDeleteTransaction: (tx: Transaction) => void;
  getBucketChip: (tx: Transaction) => React.ReactNode;
  loadAuditLogs: (tx: Transaction) => void;
  canEditTransaction: (tx: Transaction) => boolean;
  /** Suppresses the empty state while the list is still being fetched. Without it a
   *  user with hundreds of transactions is told to "Add your first expense". */
  loading?: boolean;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  onViewReceipt?: (tx: Transaction) => void;
  onBulkDelete?: (txs: Transaction[]) => Promise<{ count: number }>;
  onBulkUpdate?: (txs: Transaction[], patch: { category?: string; bucket_id?: string | null; account_id?: string | null }) => Promise<{ count: number }>;
}

export const TransactionList = React.memo(function TransactionList({
  transactions, userId, currency, buckets,
  calculateUserShare, formatCurrency,
  convertAmount, setEditingTransaction, setIsEditOpen,
  handleDeleteTransaction, getBucketChip, loadAuditLogs,
  canEditTransaction, loading, hasMore, loadingMore, onLoadMore, onViewReceipt,
  onBulkDelete, onBulkUpdate,
}: TransactionListProps) {
  const router = useRouter();
  const { accounts: allAccounts } = useAccounts();
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const bulkAvailable = !!onBulkDelete && !!onBulkUpdate;

  const eligibleForSelect = useMemo(
    () => transactions.filter(t => canEditTransaction(t) && !t._pending && !t._failed),
    [transactions, canEditTransaction],
  );

  const toggleId = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Stable adapters so every TransactionRow below receives the same function
  // identity on each render and its `memo` can actually skip. These used to be
  // inline arrows, which is why the memo never hit and ticking one checkbox
  // re-rendered the whole list.
  const handleToggleSelect = useCallback((tx: Transaction) => toggleId(tx.id), [toggleId]);
  const handleEdit = useCallback((tx: Transaction) => {
    setEditingTransaction(tx);
    setIsEditOpen(true);
  }, [setEditingTransaction, setIsEditOpen]);

  const exitSelect = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(eligibleForSelect.map(t => t.id)));
  }, [eligibleForSelect]);

  const selectedTxs = useMemo(
    () => transactions.filter(t => selectedIds.has(t.id)),
    [transactions, selectedIds],
  );

  // For the picker dialogs: if every selected row shares the same bucket /
  // category, surface that as "current" so the picker can highlight it and
  // skip a no-op write. Mixed selection → undefined (no highlight).
  const sharedBucketId = useMemo<string | null | undefined>(() => {
    if (selectedTxs.length === 0) return undefined;
    const first = selectedTxs[0].bucket_id ?? null;
    for (let i = 1; i < selectedTxs.length; i++) {
      const next = selectedTxs[i].bucket_id ?? null;
      if (next !== first) return undefined;
    }
    return first;
  }, [selectedTxs]);

  const sharedCategory = useMemo<string | undefined>(() => {
    if (selectedTxs.length === 0) return undefined;
    const first = selectedTxs[0].category;
    for (let i = 1; i < selectedTxs.length; i++) {
      if (selectedTxs[i].category !== first) return undefined;
    }
    return first;
  }, [selectedTxs]);

  const sharedAccountId = useMemo<string | null | undefined>(() => {
    if (selectedTxs.length === 0) return undefined;
    const first = selectedTxs[0].account_id ?? null;
    for (let i = 1; i < selectedTxs.length; i++) {
      const next = selectedTxs[i].account_id ?? null;
      if (next !== first) return undefined;
    }
    return first;
  }, [selectedTxs]);

  const handleBulkDeleteClick = useCallback(async () => {
    if (!onBulkDelete || selectedTxs.length === 0) return;
    const result = await onBulkDelete(selectedTxs);
    if (result.count > 0) exitSelect();
  }, [onBulkDelete, selectedTxs, exitSelect]);

  const handleRecategorize = useCallback(async (categoryId: string) => {
    if (!onBulkUpdate || selectedTxs.length === 0) return;
    const result = await onBulkUpdate(selectedTxs, { category: categoryId });
    if (result.count > 0) exitSelect();
  }, [onBulkUpdate, selectedTxs, exitSelect]);

  const handleMoveToBucket = useCallback(async (bucketId: string | null) => {
    if (!onBulkUpdate || selectedTxs.length === 0) return;
    const result = await onBulkUpdate(selectedTxs, { bucket_id: bucketId });
    if (result.count > 0) exitSelect();
  }, [onBulkUpdate, selectedTxs, exitSelect]);

  const handleMoveToAccount = useCallback(async (accountId: string) => {
    if (!onBulkUpdate || selectedTxs.length === 0) return;
    const result = await onBulkUpdate(selectedTxs, { account_id: accountId });
    if (result.count > 0) exitSelect();
  }, [onBulkUpdate, selectedTxs, exitSelect]);

  if (loading && transactions.length === 0) {
    return (
      <div className="space-y-2 py-2" role="status" aria-label="Loading transactions">
        <div className="h-16 rounded-xl bg-secondary/10 animate-pulse" />
        <div className="h-16 rounded-xl bg-secondary/10 animate-pulse" />
        <div className="h-16 rounded-xl bg-secondary/10 animate-pulse" />
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <EmptyState
        size="page"
        iconVariant="tile"
        icon={Receipt}
        title="No transactions yet"
        description="Add your first expense to start seeing patterns and insights."
        action={{ label: 'Add expense', onClick: () => router.push('/add') }}
      />
    );
  }

  const allSelected = eligibleForSelect.length > 0 && selectedIds.size === eligibleForSelect.length;

  return (
    <div className="space-y-1 px-2">
      {bulkAvailable && (
        <div className="flex items-center justify-between gap-2 px-2 py-2 sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
          {!selectMode ? (
            <>
              <span className="text-meta text-muted-foreground/60 font-medium">
                {transactions.length} transaction{transactions.length === 1 ? '' : 's'}
              </span>
              <button
                type="button"
                onClick={() => setSelectMode(true)}
                disabled={eligibleForSelect.length === 0}
                className="flex items-center gap-1.5 text-meta font-semibold text-primary hover:text-primary/80 disabled:opacity-50 disabled:cursor-not-allowed px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-colors"
              >
                <CheckSquare className="w-3 h-3" />
                Select
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={allSelected ? () => setSelectedIds(new Set()) : selectAll}
                className="text-meta font-semibold text-primary hover:text-primary/80"
              >
                {allSelected ? 'Clear' : 'Select all'}
              </button>
              <span className="text-meta text-muted-foreground/60 font-medium tabular-nums">
                {selectedIds.size} / {eligibleForSelect.length}
              </span>
            </>
          )}
        </div>
      )}

      <AnimatePresence initial={false}>
        {transactions.map((tx) => {
          const myShare = calculateUserShare(tx, userId);
          const showConverted = tx.currency && tx.currency.toUpperCase() !== currency.toUpperCase();
          return (
            <motion.div
              key={tx.id}
              initial={false}
              // `height`/`marginTop` are layout properties, but this exit only runs
              // for a single deleted row — without the collapse the list snaps shut
              // after the fade. Kept deliberately; don't copy it to bulk-swap lists.
              exit={{ opacity: 0, height: 0, marginTop: 0, scale: 0.97 }}
              transition={ROW}
              // `overflow: hidden` is what lets the height-collapse exit above read as
              // a collapse rather than a clip-less jump. The content-visibility pair
              // that used to sit here moved onto TransactionRow itself, so every list
              // gets it — search included, which never had it.
              style={{ overflow: 'hidden' }}
            >
              <TransactionRow
                tx={tx}
                userId={userId}
                myShare={myShare}
                formattedAmount={formatCurrency(Math.abs(myShare), tx.currency)}
                formattedConverted={
                  showConverted
                    ? formatCurrency(convertAmount(Math.abs(myShare), tx.currency || 'USD', currency), currency)
                    : undefined
                }
                showConverted={!!showConverted}
                canEdit={canEditTransaction(tx)}
                // Grows unbounded via "Load more" (100 at a time).
                deferOffscreen
                color={CATEGORY_COLORS[tx.category.toLowerCase()] || CATEGORY_COLORS.uncategorized}
                renderBucketChip={getBucketChip}
                onHistory={loadAuditLogs}
                onEdit={handleEdit}
                onDelete={handleDeleteTransaction}
                onViewReceipt={onViewReceipt}
                selectable={selectMode}
                selected={selectedIds.has(tx.id)}
                onToggleSelect={handleToggleSelect}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
      {hasMore && onLoadMore && !selectMode && (
        <button
          onClick={onLoadMore}
          disabled={loadingMore}
          className="w-full py-3 text-sm font-bold text-primary/70 hover:text-primary transition-colors disabled:opacity-50"
        >
          {loadingMore ? 'Loading...' : 'Load more transactions'}
        </button>
      )}

      <AnimatePresence>
        {selectMode && bulkAvailable && (
          <BulkActionBar
            count={selectedIds.size}
            buckets={buckets}
            accounts={allAccounts.filter(a => !a.archived_at)}
            onCancel={exitSelect}
            onDelete={handleBulkDeleteClick}
            onRecategorize={handleRecategorize}
            onMoveToBucket={handleMoveToBucket}
            onMoveToAccount={handleMoveToAccount}
            currentBucketId={sharedBucketId}
            currentCategory={sharedCategory}
            currentAccountId={sharedAccountId ?? undefined}
          />
        )}
      </AnimatePresence>
    </div>
  );
});
