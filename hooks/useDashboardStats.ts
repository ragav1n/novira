import { useMemo, useCallback } from 'react';
import { differenceInDays, endOfMonth, startOfMonth } from 'date-fns';
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
        if (!currentUserId) return Number(tx.amount); // For workspaces/full-view, return full amount
        
        if (tx.splits && tx.splits.length > 0) {
            if (tx.user_id === currentUserId) {
                // If I paid, my share is total minus what others owe me
                const othersOwe = tx.splits.reduce((sum, s) => sum + Number(s.amount), 0);
                return Number(tx.amount) - othersOwe;
            } else {
                // If someone else paid, my share is my split amount
                const mySplit = tx.splits.find(s => s.user_id === currentUserId);
                return mySplit ? Number(mySplit.amount) : 0;
            }
        }

        // Standard non-split logic
        if (tx.user_id === currentUserId) {
            return Number(tx.amount);
        }
        return 0;
    }, []);

    const totalSpent = useMemo(() => transactions.reduce((acc, tx) => {
        // Filter by context (bucket or monthly allowance)
        if (isBucketFocused) {
            if (tx.bucket_id !== effectiveFocus) return acc;
        } else {
            if (tx.exclude_from_allowance) return acc;
            if (!tx.date.startsWith(currentMonthPrefix)) return acc;
        }

        const myShare = calculateUserShare(tx, userId);
        if (myShare === 0) return acc;

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
        // Filter by context (bucket or monthly allowance)
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
            // When bucket focused, we should probably convert to bucketCurrency for the pie chart
            const targetCurr = isBucketFocused ? bucketCurrency : currency;
            const isSameCurrency = txCurr === targetCurr;

            if (!isSameCurrency && tx.exchange_rate && tx.exchange_rate !== 1 && tx.base_currency === targetCurr) {
                acc[cat] += (myShare * Number(tx.exchange_rate));
            } else {
                acc[cat] += convertAmount(myShare, txCurr, targetCurr);
            }
        }
        return acc;
    }, {} as Record<string, number>), [transactions, userId, isBucketFocused, effectiveFocus, calculateUserShare, currency, convertAmount, currentMonthPrefix, bucketCurrency]);

    const spendingData: SpendingCategory[] = useMemo(() => Object.entries(spendingByCategory).map(([cat, value]) => ({
        name: cat.charAt(0).toUpperCase() + cat.slice(1),
        value,
        color: CATEGORY_COLORS[cat] || CATEGORY_COLORS.others,
        fill: CATEGORY_COLORS[cat] || CATEGORY_COLORS.others,
    })), [spendingByCategory]);

    const displayTransactions = useMemo(() => transactions.filter(tx => {
        // Filter by context (bucket or monthly allowance)
        if (isBucketFocused) {
            if (tx.bucket_id !== effectiveFocus) return false;
        } else {
            if (tx.exclude_from_allowance) return false;
            // No date filter for allowanceTransactions here to show "Recent" across months?
            // Actually, for allowance, we should probably stick to current month for consistency 
            // unless the user wants "Recent" to be truly recent regardless of month.
            // But usually allowance is monthly strictly. 
            // Let's keep date filter for allowance for now to match totalSpent.
            if (!tx.date.startsWith(currentMonthPrefix)) return false;
        }

        // Involvement filter
        if (!userId) return true;
        if (tx.user_id === userId) return true;
        if (tx.splits && tx.splits.some(s => s.user_id === userId)) return true;
        return false;
    }), [transactions, userId, isBucketFocused, effectiveFocus, currentMonthPrefix]);

    // Run Rate Calculation
    const runRateData = useMemo(() => {
        if (isBucketFocused) return null; // Run rate is only for monthly allowance right now

        const today = new Date();
        const firstDay = startOfMonth(today);
        const lastDay = endOfMonth(today);
        const daysInMonth = differenceInDays(lastDay, firstDay) + 1;
        const currentDayOfMoth = today.getDate();

        // Calculate total spend strictly for this month (excluding future scheduled ones if any)
        const spentThisMonth = totalSpent;

        // Daily average spend so far
        const dailyAverage = currentDayOfMoth > 0 ? spentThisMonth / currentDayOfMoth : 0;

        // Projected spend for the entire month
        const projectedSpend = dailyAverage * daysInMonth;

        return {
            dailyAverage,
            projectedSpend,
            isExceeding: projectedSpend > displayBudget,
            daysInMonth,
            currentDayOfMoth
        };
    }, [isBucketFocused, totalSpent, displayBudget]);

    return {
        focusedBucket,
        displayBudget,
        calculateUserShare,
        totalSpent,
        remaining,
        progress,
        spendingByCategory,
        spendingData,
        displayTransactions,
        runRateData
    };
}
