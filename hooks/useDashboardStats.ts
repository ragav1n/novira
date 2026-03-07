import { useMemo, useCallback } from 'react';
import type { Transaction } from '@/types/transaction';
import { CATEGORY_COLORS } from '@/lib/categories';
import type { Currency } from '@/components/providers/user-preferences-provider';

type SpendingCategory = {
    name: string;
    value: number;
    color: string;
    fill: string;
};

export function useDashboardStats({
    transactions,
    userId,
    isBucketFocused,
    effectiveFocus,
    bucketCurrency,
    currency,
    convertAmount,
    monthlyBudget,
    buckets
}: {
    transactions: Transaction[];
    userId: string | null;
    isBucketFocused: boolean;
    effectiveFocus: string;
    bucketCurrency: Currency;
    currency: string;
    convertAmount: (amount: number, fromCurrency: string, toCurrency?: string) => number;
    monthlyBudget: number;
    buckets: any[];
}) {
    const focusedBucket = isBucketFocused ? buckets.find(b => b.id === effectiveFocus) : null;
    const displayBudget = isBucketFocused && focusedBucket ? Number(focusedBucket.budget) : monthlyBudget;

    const currentMonthPrefix = useMemo(() => {
        const d = new Date();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        return `${d.getFullYear()}-${month}`;
    }, []);

    const calculateUserShare = useCallback((tx: Transaction, currentUserId: string | null) => {
        if (!currentUserId) return 0;
        if (tx.user_id === currentUserId) {
            return Number(tx.amount);
        }
        return 0;
    }, []);

    const totalSpent = useMemo(() => transactions.reduce((acc, tx) => {
        if (!userId) return acc;

        if (isBucketFocused) {
            if (tx.bucket_id !== effectiveFocus) return acc;
        } else {
            if (tx.exclude_from_allowance) return acc;
            if (!tx.date.startsWith(currentMonthPrefix)) return acc;
        }

        const myShare = calculateUserShare(tx, userId);
        const txCurr = (tx.currency || 'USD').toUpperCase();
        const targetCurr = bucketCurrency;
        
        const isSameCurrency = txCurr === targetCurr;
        
        if (!isSameCurrency && tx.exchange_rate && tx.exchange_rate !== 1 && tx.base_currency === targetCurr) {
            return acc + (myShare * Number(tx.exchange_rate));
        }

        return acc + convertAmount(myShare, txCurr, targetCurr);
    }, 0), [transactions, userId, isBucketFocused, effectiveFocus, calculateUserShare, bucketCurrency, convertAmount, currentMonthPrefix]);

    const remaining = displayBudget - totalSpent;
    const progress = displayBudget > 0 ? Math.min((totalSpent / displayBudget) * 100, 100) : 0;

    const spendingByCategory = useMemo(() => transactions.reduce((acc, tx) => {
        if (!userId) return acc;

        if (isBucketFocused) {
            if (tx.bucket_id !== effectiveFocus) return acc;
        } else {
            if (tx.exclude_from_allowance) return acc;
            if (!tx.date.startsWith(currentMonthPrefix)) return acc;
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
    }, {} as Record<string, number>), [transactions, userId, isBucketFocused, effectiveFocus, calculateUserShare, currency, convertAmount, currentMonthPrefix]);

    const spendingData: SpendingCategory[] = useMemo(() => Object.entries(spendingByCategory).map(([cat, value]) => ({
        name: cat.charAt(0).toUpperCase() + cat.slice(1),
        value,
        color: CATEGORY_COLORS[cat] || CATEGORY_COLORS.others,
        fill: CATEGORY_COLORS[cat] || CATEGORY_COLORS.others,
    })), [spendingByCategory]);

    const displayTransactions = useMemo(() => transactions.filter(tx => {
        if (tx.user_id === userId) return true;
        if (tx.splits && tx.splits.some(s => s.user_id === userId)) return true;
        return false;
    }), [transactions, userId]);

    return {
        focusedBucket,
        displayBudget,
        calculateUserShare,
        totalSpent,
        remaining,
        progress,
        spendingByCategory,
        spendingData,
        displayTransactions
    };
}
