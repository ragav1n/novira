import React, { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Receipt, CheckSquare } from 'lucide-react';
import { TransactionRow } from '@/components/transaction-row';
import { BulkActionBar } from '@/components/bulk-action-bar';
import { CATEGORY_COLORS } from '@/lib/categories';
import type { Transaction } from '@/types/transaction';
import type { Bucket } from '@/components/providers/buckets-provider';

interface TransactionListProps {
  transactions: Transaction[];
  userId: string | null;
  currency: string;
  buckets: Bucket[];
  calculateUserShare: (tx: Transaction, currentUserId: string | null) => number;
  getIconForCategory: (category: string, className?: string) => React.ReactNode;
  formatCurrency: (amount: number, currencyCode?: string) => string;
  convertAmount: (amount: number, fromCurrency: string, toCurrency?: string) => number;
  setEditingTransaction: (tx: Transaction) => void;
  setIsEditOpen: (open: boolean) => void;
  handleDeleteTransaction: (tx: Transaction) => void;
  getBucketChip: (tx: Transaction) => React.ReactNode;
  loadAuditLogs: (tx: Transaction) => void;
  canEditTransaction: (tx: Transaction) => boolean;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  onViewReceipt?: (tx: Transaction) => void;
  onBulkDelete?: (txs: Transaction[]) => Promise<{ count: number }>;
  onBulkUpdate?: (txs: Transaction[], patch: { category?: string; bucket_id?: string | null }) => Promise<{ count: number }>;
}

export const TransactionList = React.memo(function TransactionList({
  transactions, userId, currency, buckets,
  calculateUserShare, getIconForCategory, formatCurrency,
  convertAmount, setEditingTransaction, setIsEditOpen,
  handleDeleteTransaction, getBucketChip, loadAuditLogs,
  canEditTransaction, hasMore, loadingMore, onLoadMore, onViewReceipt,
  onBulkDelete, onBulkUpdate,
}: TransactionListProps) {
  const router = useRouter();
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

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-secondary/20 border border-white/5 flex items-center justify-center mb-3">
          <Receipt className="w-6 h-6 text-muted-foreground/50" strokeWidth={1.75} />
        </div>
        <p className="text-sm font-bold text-muted-foreground/80">No transactions yet</p>
        <p className="text-xs text-muted-foreground/50 mt-1 max-w-[220px]">
          Add your first expense to start seeing patterns and insights.
        </p>
        <button
          onClick={() => router.push('/add')}
          className="mt-4 text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary transition-colors"
        >
          Add expense
        </button>
      </div>
    );
  }

  const allSelected = eligibleForSelect.length > 0 && selectedIds.size === eligibleForSelect.length;

  return (
    <div className="space-y-1 px-2">
      {bulkAvailable && (
        <div className="flex items-center justify-between gap-2 px-2 py-2 sticky top-0 z-10 bg-background/95 backdrop-blur-sm">
          {!selectMode ? (
            <>
              <span className="text-[11px] text-muted-foreground/60 font-medium">
                {transactions.length} transaction{transactions.length === 1 ? '' : 's'}
              </span>
              <button
                type="button"
                onClick={() => setSelectMode(true)}
                disabled={eligibleForSelect.length === 0}
                className="flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:text-primary/80 disabled:opacity-50 disabled:cursor-not-allowed px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-colors"
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
                className="text-[11px] font-semibold text-primary hover:text-primary/80"
              >
                {allSelected ? 'Clear' : 'Select all'}
              </button>
              <span className="text-[11px] text-muted-foreground/60 font-medium tabular-nums">
                {selectedIds.size} / {eligibleForSelect.length}
              </span>
            </>
          )}
        </div>
      )}

      {transactions.map((tx) => {
        const myShare = calculateUserShare(tx, userId);
        const showConverted = tx.currency && tx.currency.toUpperCase() !== currency.toUpperCase();
        return (
          <div
            key={tx.id}
            style={{ contentVisibility: 'auto', containIntrinsicSize: '0 64px' }}
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
              icon={getIconForCategory(tx.category, 'w-4 h-4')}
              color={CATEGORY_COLORS[tx.category.toLowerCase()] || CATEGORY_COLORS.uncategorized}
              bucketChip={getBucketChip(tx)}
              onHistory={() => loadAuditLogs(tx)}
              onEdit={() => {
                setEditingTransaction(tx);
                setIsEditOpen(true);
              }}
              onDelete={() => handleDeleteTransaction(tx)}
              onViewReceipt={onViewReceipt ? () => onViewReceipt(tx) : undefined}
              selectable={selectMode}
              selected={selectedIds.has(tx.id)}
              onToggleSelect={() => toggleId(tx.id)}
            />
          </div>
        );
      })}
      {hasMore && onLoadMore && !selectMode && (
        <button
          onClick={onLoadMore}
          disabled={loadingMore}
          className="w-full py-3 text-sm font-bold text-primary/70 hover:text-primary transition-colors disabled:opacity-50"
        >
          {loadingMore ? 'Loading...' : 'Load more transactions'}
        </button>
      )}

      {selectMode && bulkAvailable && (
        <BulkActionBar
          count={selectedIds.size}
          buckets={buckets}
          onCancel={exitSelect}
          onDelete={handleBulkDeleteClick}
          onRecategorize={handleRecategorize}
          onMoveToBucket={handleMoveToBucket}
        />
      )}
    </div>
  );
});
