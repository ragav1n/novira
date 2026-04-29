import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { TransactionRow } from '@/components/transaction-row';
import { CATEGORY_COLORS } from '@/lib/categories';
import type { Transaction } from '@/types/transaction';
import type { Bucket } from '@/components/providers/buckets-provider';

interface VirtualizedTransactionListProps {
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
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
}

export const VirtualizedTransactionList = React.memo(function VirtualizedTransactionList({
  transactions, userId, currency,
  calculateUserShare, getIconForCategory, formatCurrency,
  convertAmount, setEditingTransaction, setIsEditOpen,
  handleDeleteTransaction, getBucketChip, loadAuditLogs,
  canEditTransaction, hasMore, loadingMore, onLoadMore,
  scrollContainerRef
}: VirtualizedTransactionListProps) {
  const fallbackRef = useRef<HTMLDivElement>(null);
  const scrollRef = scrollContainerRef ?? fallbackRef;

  const virtualizer = useVirtualizer({
    count: transactions.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 72,
    overscan: 8,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/40 text-sm">
        No transactions found.
      </div>
    );
  }

  const items = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  const list = (
    <div className="px-2">
      <div style={{ height: `${totalSize}px`, position: 'relative', width: '100%' }}>
        {items.map((virtualItem) => {
          const tx = transactions[virtualItem.index];
          const myShare = calculateUserShare(tx, userId);
          const showConverted = tx.currency && tx.currency !== currency;
          return (
            <div
              key={tx.id}
              ref={virtualizer.measureElement}
              data-index={virtualItem.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
                paddingTop: 2,
                paddingBottom: 2,
              }}
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
              />
            </div>
          );
        })}
      </div>
      {hasMore && onLoadMore && (
        <button
          onClick={onLoadMore}
          disabled={loadingMore}
          className="w-full py-3 text-sm font-bold text-primary/70 hover:text-primary transition-colors disabled:opacity-50"
        >
          {loadingMore ? 'Loading...' : 'Load more transactions'}
        </button>
      )}
    </div>
  );

  // When the parent supplies a scroll container we virtualize against it.
  // Otherwise wrap in a self-contained scroll area.
  if (scrollContainerRef) return list;
  return (
    <div ref={fallbackRef} className="overflow-auto" style={{ height: '100%' }}>
      {list}
    </div>
  );
});
