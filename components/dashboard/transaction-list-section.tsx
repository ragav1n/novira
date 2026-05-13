'use client';

import React, { useRef } from 'react';
import { Wallet, ChevronRight, Check, Pencil, Clock, ArrowUpRight, ArrowDownLeft, LayoutGrid, MapPin, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Transaction } from '@/types/transaction';
import { TransactionRow } from '@/components/transaction-row';
import { getIconForCategory, CATEGORY_COLORS } from '@/lib/categories';
import { toast } from '@/utils/haptics';
import { Currency } from '@/components/providers/user-preferences-provider';
import { Bucket } from '@/components/providers/buckets-provider';
import { DashboardTransactionsDrawer } from '@/components/dashboard-transactions-drawer';
import { TransactionList } from '@/components/transaction-list';

interface TransactionListSectionProps {
    isBucketFocused: boolean;
    isMapOpen: boolean;
    setIsMapOpen: (open: boolean) => void;
    setIsViewAllOpen: (open: boolean) => void;
    isViewAllOpen: boolean;
    displayTransactions: Transaction[];
    allTransactions?: Transaction[];
    userId: string | null;
    currency: string;
    buckets: Bucket[];
    calculateUserShare: (tx: Transaction, userId: string | null) => number;
    canEditTransaction: (tx: Transaction) => boolean;
    getBucketChip: (tx: Transaction) => React.ReactNode;
    loadAuditLogs: (tx: Transaction) => void;
    setEditingTransaction: (tx: Transaction | null) => void;
    setIsEditOpen: (open: boolean) => void;
    handleDeleteTransaction: (tx: Transaction) => void;
    isCoupleWorkspace: boolean;
    isHomeWorkspace: boolean;
    formatCurrency: (amount: number, currency?: string) => string;
    convertAmount: (amount: number, fromCurrency: string, toCurrency?: string) => number;
    hasMore?: boolean;
    loadingMore?: boolean;
    onLoadMore?: () => void;
    selectedCategory?: string | null;
    onClearCategory?: () => void;
    onViewReceipt?: (tx: Transaction) => void;
}

export function TransactionListSection({
    isBucketFocused,
    isMapOpen,
    setIsMapOpen,
    setIsViewAllOpen,
    isViewAllOpen,
    displayTransactions,
    allTransactions,
    userId,
    currency,
    buckets,
    calculateUserShare,
    canEditTransaction,
    getBucketChip,
    loadAuditLogs,
    setEditingTransaction,
    setIsEditOpen,
    handleDeleteTransaction,
    isCoupleWorkspace,
    isHomeWorkspace,
    formatCurrency,
    convertAmount,
    hasMore,
    loadingMore,
    onLoadMore,
    selectedCategory = null,
    onClearCategory,
    onViewReceipt,
}: TransactionListSectionProps) {
    const drawerScrollRef = useRef<HTMLDivElement>(null);
    // When filtering by category, also exclude settlements AND bound to the pie's
    // scope so the visible rows reconcile with the pie slice value:
    //   - non-bucket: pie covers the current calendar month, so filter rows to the
    //     same `yyyy-MM` prefix.
    //   - bucket focus: pie covers all bucket transactions, so no month bound.
    const currentMonthPrefix = (() => {
        if (!selectedCategory || isBucketFocused) return '';
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    })();
    const filteredRecents = selectedCategory
        ? displayTransactions.filter(tx =>
            !tx.is_settlement &&
            tx.category.toLowerCase() === selectedCategory &&
            (isBucketFocused || tx.date.startsWith(currentMonthPrefix))
        )
        : displayTransactions;
    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <h3 className="text-lg font-bold">{isBucketFocused ? "Mission" : "Recent"} Transactions</h3>
                    {selectedCategory && onClearCategory && (
                        <button
                            type="button"
                            onClick={onClearCategory}
                            className={cn(
                                "inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border transition-colors",
                                isCoupleWorkspace
                                    ? "bg-rose-500/10 text-rose-300 border-rose-500/20 hover:bg-rose-500/15"
                                    : isHomeWorkspace
                                        ? "bg-yellow-500/10 text-yellow-300 border-yellow-500/20 hover:bg-yellow-500/15"
                                        : "bg-primary/10 text-primary border-primary/20 hover:bg-primary/15"
                            )}
                        >
                            <span className="capitalize">{selectedCategory}</span>
                            <X className="w-3 h-3" />
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {filteredRecents.some(tx => tx.place_lat && tx.place_lng) && (
                        <button
                            onClick={() => setIsMapOpen(true)}
                            className="text-xs text-emerald-400 font-bold hover:text-emerald-300 transition-colors uppercase tracking-wider px-2 py-1 flex items-center gap-1"
                        >
                            <MapPin className="w-3 h-3" />
                            Map
                        </button>
                    )}
                    <button
                        onClick={() => setIsViewAllOpen(true)}
                        className={cn(
                            "text-xs font-bold transition-colors uppercase tracking-wider px-2 py-1",
                            isCoupleWorkspace ? "text-rose-400 hover:text-rose-300" : isHomeWorkspace ? "text-yellow-500 hover:text-yellow-400" : "text-primary hover:text-primary/80"
                        )}
                    >
                        View All
                    </button>
                </div>
            </div>

            <div className="space-y-1">
                {filteredRecents.slice(0, 5).map((tx: Transaction) => {
                    const myShare = calculateUserShare(tx, userId);
                    const showConverted = tx.currency && tx.currency.toUpperCase() !== currency.toUpperCase();
                    return (
                        <TransactionRow
                            key={tx.id}
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
                            onEdit={() => { setEditingTransaction(tx); setIsEditOpen(true); }}
                            onDelete={() => {
                                toast('Delete transaction?', {
                                    action: { label: 'Delete', onClick: () => handleDeleteTransaction(tx) }
                                });
                            }}
                            onViewReceipt={onViewReceipt ? () => onViewReceipt(tx) : undefined}
                        />
                    );
                })}
                {filteredRecents.length === 0 && (
                    <div className="text-center text-sm text-muted-foreground/40 py-8">
                        {selectedCategory ? (
                            <>
                                <span className="capitalize">{selectedCategory}</span> has no recent transactions.
                                {onClearCategory && (
                                    <button
                                        type="button"
                                        onClick={onClearCategory}
                                        className="ml-2 text-primary font-bold hover:underline"
                                    >
                                        Clear filter
                                    </button>
                                )}
                            </>
                        ) : (
                            'No recent transactions found.'
                        )}
                    </div>
                )}
            </div>

            <DashboardTransactionsDrawer
                isOpen={isViewAllOpen}
                onOpenChange={setIsViewAllOpen}
                scrollRef={drawerScrollRef}
            >
                <TransactionList
                    transactions={allTransactions ?? displayTransactions}
                    userId={userId}
                    currency={currency}
                    buckets={buckets}
                    calculateUserShare={calculateUserShare}
                    getIconForCategory={getIconForCategory}
                    formatCurrency={formatCurrency}
                    convertAmount={convertAmount}
                    canEditTransaction={canEditTransaction}
                    getBucketChip={getBucketChip}
                    loadAuditLogs={loadAuditLogs}
                    setEditingTransaction={setEditingTransaction}
                    setIsEditOpen={setIsEditOpen}
                    handleDeleteTransaction={handleDeleteTransaction}
                    hasMore={hasMore}
                    loadingMore={loadingMore}
                    onLoadMore={onLoadMore}
                    onViewReceipt={onViewReceipt}
                />
            </DashboardTransactionsDrawer>
        </div>
    );
}
