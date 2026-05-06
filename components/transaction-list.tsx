import React from 'react';
import { useRouter } from 'next/navigation';
import { Receipt } from 'lucide-react';
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
  const router = useRouter();
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
