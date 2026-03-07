import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { TransactionRow } from '@/components/transaction-row';
import { CATEGORY_COLORS } from '@/lib/categories';
import type { Transaction } from '@/types/transaction';

interface VirtualizedTransactionListProps {
  transactions: Transaction[];
  userId: string | null;
  currency: string;
  buckets: any[];
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
  toast: any;
}

export const VirtualizedTransactionList = React.memo(function VirtualizedTransactionList({
  transactions, userId, currency, buckets,
  calculateUserShare, getIconForCategory, formatCurrency,
  convertAmount, setEditingTransaction, setIsEditOpen,
  handleDeleteTransaction, getBucketChip, loadAuditLogs,
  canEditTransaction, toast
}: VirtualizedTransactionListProps) {
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
