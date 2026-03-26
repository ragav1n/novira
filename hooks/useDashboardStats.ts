import { useMemo, useCallback } from 'react';
import { differenceInDays, endOfMonth, startOfMonth, format } from 'date-fns';
import type { Transaction } from '@/types/transaction';
import { CATEGORY_COLORS } from '@/lib/categories';
import type { Currency } from '@/components/providers/user-preferences-provider';
import type { Bucket } from '@/components/providers/buckets-provider';

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
    buckets: Bucket[];
}): {
    focusedBucket: Bucket | null;
    displayBudget: number;
    calculateUserShare: (tx: Transaction, currentUserId: string | null) => number;
    totalSpent: number;
    remaining: number;
    progress: number;
    spendingByCategory: Record<string, number>;
    spendingData: SpendingCategory[];
    displayTransactions: Transaction[];
    recentFeed: Transaction[];
    runRateData: {
        dailyAverage: number;
        projectedSpend: number;
        isExceeding: boolean;
        daysInMonth: number;
        currentDayOfMonth: number;
    } | null;
} {
    const focusedBucket = (isBucketFocused && Array.isArray(buckets) ? buckets.find(b => b.id === effectiveFocus) : null) ?? null;
    const displayBudget = isBucketFocused && focusedBucket ? Number(focusedBucket.budget) : (monthlyBudget || 0);

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

    const totalSpent = useMemo(() => {
        if (!Array.isArray(transactions)) return 0;
        return transactions.reduce((acc, tx) => {
            // Filter by context (bucket or monthly allowance)
            if (isBucketFocused) {
                if (tx.bucket_id !== effectiveFocus) return acc;
            } else {
                if (tx.exclude_from_allowance) return acc;
                if (!tx.date.startsWith(currentMonthPrefix)) return acc;
            }

            const myShare = calculateUserShare(tx, userId);
            if (myShare <= 0) return acc;

            const txCurr = (tx.currency || 'USD').toUpperCase();
            const targetCurr = bucketCurrency;
            
            const isSameCurrency = txCurr === targetCurr;
            
            if (!isSameCurrency && tx.exchange_rate && tx.exchange_rate !== 1 && tx.base_currency === targetCurr) {
                return acc + (myShare * Number(tx.exchange_rate));
            }

            return acc + convertAmount(myShare, txCurr, targetCurr);
        }, 0);
    }, [transactions, userId, isBucketFocused, effectiveFocus, calculateUserShare, bucketCurrency, convertAmount, currentMonthPrefix]);

    const remaining = displayBudget - totalSpent;
    const progress = displayBudget > 0 ? Math.min((totalSpent / displayBudget) * 100, 100) : 0;

    const spendingByCategory = useMemo(() => {
        if (!Array.isArray(transactions)) return {};
        return transactions.reduce((acc, tx) => {
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

                const txCurr = (tx.currency || 'USD').toUpperCase();
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
        }, {} as Record<string, number>);
    }, [transactions, userId, isBucketFocused, effectiveFocus, calculateUserShare, currency, convertAmount, currentMonthPrefix, bucketCurrency]);

    const spendingData: SpendingCategory[] = useMemo(() => Object.entries(spendingByCategory).map(([cat, value]) => ({
        name: cat.charAt(0).toUpperCase() + cat.slice(1),
        value: value as number,
        color: CATEGORY_COLORS[cat] || CATEGORY_COLORS.others,
        fill: CATEGORY_COLORS[cat] || CATEGORY_COLORS.others,
    })), [spendingByCategory]);

    const displayTransactions = useMemo(() => {
        if (!Array.isArray(transactions)) return [];
        return transactions.filter(tx => {
            // Filter by context (bucket or monthly allowance)
            if (isBucketFocused) {
                if (tx.bucket_id !== effectiveFocus) return false;
            } else {
                if (tx.exclude_from_allowance) return false;
                if (!tx.date.startsWith(currentMonthPrefix)) return false;
            }

            // Involvement filter
            if (!userId) return true;
            if (tx.user_id === userId) return true;
            if (tx.splits && tx.splits.some(s => s.user_id === userId)) return true;
            return false;
        });
    }, [transactions, userId, isBucketFocused, effectiveFocus, currentMonthPrefix]);

    // All relevant transactions for the feed (preview slice happens in TransactionListSection)
    const recentFeed = useMemo(() => {
        if (isBucketFocused) return displayTransactions;

        if (!Array.isArray(transactions)) return [];

        return transactions
            .filter(tx => tx && !tx.exclude_from_allowance)
            .filter(tx => {
                if (!userId) return true;
                if (tx.user_id === userId) return true;
                if (tx.splits && tx.splits.some(s => s.user_id === userId)) return true;
                return false;
            });
    }, [transactions, isBucketFocused, displayTransactions, userId]);

    // Run Rate Calculation — weighted toward recent 7 days to reflect current spending trend
    const runRateData = useMemo(() => {
        if (isBucketFocused) return null;

        const today = new Date();
        const firstDay = startOfMonth(today);
        const lastDay = endOfMonth(today);
        const daysInMonth = differenceInDays(lastDay, firstDay) + 1;
        const currentDayOfMonth = today.getDate();
        const spentThisMonth = totalSpent;

        // Recent 7-day spend (current month only)
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 6);
        const sevenDaysAgoStr = format(sevenDaysAgo, 'yyyy-MM-dd');
        const todayStr = format(today, 'yyyy-MM-dd');

        const recentSpent = transactions.reduce((acc, tx) => {
            if (tx.exclude_from_allowance) return acc;
            if (!tx.date.startsWith(currentMonthPrefix)) return acc;
            const txDate = tx.date.slice(0, 10);
            if (txDate < sevenDaysAgoStr || txDate > todayStr) return acc;
            const myShare = calculateUserShare(tx, userId);
            if (myShare <= 0) return acc;
            const txCurr = (tx.currency || 'USD').toUpperCase();
            if (tx.exchange_rate && tx.exchange_rate !== 1 && tx.base_currency === bucketCurrency) {
                return acc + myShare * Number(tx.exchange_rate);
            }
            return acc + convertAmount(myShare, txCurr, bucketCurrency);
        }, 0);

        // Blend: 60% recent daily rate + 40% month-to-date daily rate
        const recentDays = Math.min(7, currentDayOfMonth);
        const recentDailyRate = recentDays > 0 ? recentSpent / recentDays : 0;
        const mtdDailyRate = currentDayOfMonth > 0 ? spentThisMonth / currentDayOfMonth : 0;
        const dailyAverage = 0.6 * recentDailyRate + 0.4 * mtdDailyRate;
        const projectedSpend = dailyAverage * daysInMonth;

        return {
            dailyAverage,
            projectedSpend,
            isExceeding: projectedSpend > displayBudget,
            daysInMonth,
            currentDayOfMonth
        };
    }, [isBucketFocused, totalSpent, displayBudget, transactions, currentMonthPrefix, calculateUserShare, userId, bucketCurrency, convertAmount]);

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
        recentFeed,
        runRateData
    };
}
