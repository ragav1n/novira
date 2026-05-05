import React from 'react';
import { TransactionRow } from '@/components/transaction-row';
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
}

export const TransactionList = React.memo(function TransactionList({
  transactions, userId, currency,
  calculateUserShare, getIconForCategory, formatCurrency,
  convertAmount, setEditingTransaction, setIsEditOpen,
  handleDeleteTransaction, getBucketChip, loadAuditLogs,
  canEditTransaction, hasMore, loadingMore, onLoadMore,
}: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/40 text-sm">
        No transactions found.
      </div>
    );
  }

  return (
    <div className="space-y-1 px-2">
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
            />
          </div>
        );
      })}
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
});
