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
    cashflowForecast: {
        series: { day: number; actual: number | null; forecast: number | null; budget: number }[];
        currentDayOfMonth: number;
        daysInMonth: number;
        projectedSpend: number;
        budget: number;
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

    // Single pre-filtered pass — all downstream computations derive from this
    const filteredTransactions = useMemo(() => {
        if (!Array.isArray(transactions)) return [];
        return transactions.filter(tx => {
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

    // Single pass over filteredTransactions producing totalSpent + spendingByCategory + recentSpent
    // (the run-rate window). Avoids three independent O(n) walks with redundant conversions.
    const aggregates = useMemo(() => {
        const today = new Date();
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 6);
        const sevenDaysAgoStr = format(sevenDaysAgo, 'yyyy-MM-dd');
        const todayStr = format(today, 'yyyy-MM-dd');

        let totalSpent = 0;
        let recentSpent = 0;
        const byCategory: Record<string, number> = {};
        const categoryTarget = isBucketFocused ? bucketCurrency : currency;

        for (const tx of filteredTransactions) {
            const myShare = calculateUserShare(tx, userId);
            if (myShare <= 0) continue;

            const txCurr = (tx.currency || 'USD').toUpperCase();
            const baseCurr = (tx.base_currency || '').toUpperCase();
            const hasExchange = !!tx.exchange_rate && tx.exchange_rate !== 1;

            // Total + run-rate use bucketCurrency
            const totalAmount = txCurr === bucketCurrency
                ? myShare
                : (hasExchange && baseCurr === bucketCurrency ? myShare * Number(tx.exchange_rate) : convertAmount(myShare, txCurr, bucketCurrency));
            totalSpent += totalAmount;

            const txDate = tx.date.slice(0, 10);
            if (txDate >= sevenDaysAgoStr && txDate <= todayStr) {
                recentSpent += totalAmount;
            }

            // Category breakdown — target currency depends on focus
            const cat = tx.category.toLowerCase();
            const catAmount = txCurr === categoryTarget
                ? myShare
                : (hasExchange && baseCurr === categoryTarget ? myShare * Number(tx.exchange_rate) : convertAmount(myShare, txCurr, categoryTarget));
            byCategory[cat] = (byCategory[cat] ?? 0) + catAmount;
        }

        return { totalSpent, recentSpent, byCategory };
    }, [filteredTransactions, userId, calculateUserShare, bucketCurrency, currency, isBucketFocused, convertAmount]);

    const totalSpent = aggregates.totalSpent;
    const spendingByCategory = aggregates.byCategory;

    const remaining = displayBudget - totalSpent;
    const progress = displayBudget > 0 ? Math.min((totalSpent / displayBudget) * 100, 100) : 0;

    const spendingData: SpendingCategory[] = useMemo(() => Object.entries(spendingByCategory).map(([cat, value]) => ({
        name: cat.charAt(0).toUpperCase() + cat.slice(1),
        value: value as number,
        color: CATEGORY_COLORS[cat] || CATEGORY_COLORS.others,
        fill: CATEGORY_COLORS[cat] || CATEGORY_COLORS.others,
    })), [spendingByCategory]);

    // displayTransactions is now just the pre-filtered set
    const displayTransactions = filteredTransactions;

    // All relevant transactions for the feed (preview slice happens in TransactionListSection)
    const recentFeed = useMemo(() => {
        if (isBucketFocused) return displayTransactions;

        if (!Array.isArray(transactions)) return [];

        return transactions.filter(tx => {
            if (!tx || tx.exclude_from_allowance) return false;
            if (!userId) return true;
            if (tx.user_id === userId) return true;
            if (tx.splits && tx.splits.some(s => s.user_id === userId)) return true;
            return false;
        });
    }, [transactions, isBucketFocused, displayTransactions, userId]);

    // Run Rate Calculation — weighted toward recent 7 days to reflect current spending trend.
    // recentSpent is computed in the single aggregate pass above.
    const runRateData = useMemo(() => {
        if (isBucketFocused) return null;

        const today = new Date();
        const firstDay = startOfMonth(today);
        const lastDay = endOfMonth(today);
        const daysInMonth = differenceInDays(lastDay, firstDay) + 1;
        const currentDayOfMonth = today.getDate();

        const recentDays = Math.min(7, currentDayOfMonth);
        const recentDailyRate = recentDays > 0 ? aggregates.recentSpent / recentDays : 0;
        const mtdDailyRate = currentDayOfMonth > 0 ? totalSpent / currentDayOfMonth : 0;
        const dailyAverage = 0.6 * recentDailyRate + 0.4 * mtdDailyRate;
        const remainingDays = Math.max(0, daysInMonth - currentDayOfMonth);
        const projectedSpend = totalSpent + remainingDays * dailyAverage;

        return {
            dailyAverage,
            projectedSpend,
            isExceeding: displayBudget > 0 && projectedSpend > displayBudget,
            daysInMonth,
            currentDayOfMonth
        };
    }, [isBucketFocused, totalSpent, displayBudget, aggregates.recentSpent]);

    // Build per-day cumulative actuals for the current month (only non-bucket view).
    // Forecast is the extrapolated trajectory from today through end-of-month using
    // the same dailyAverage that powers runRateData, so the chart stays consistent
    // with the "Month Forecasting" widget.
    const cashflowForecast = useMemo(() => {
        if (isBucketFocused || !runRateData) return null;
        if (runRateData.currentDayOfMonth < 1) return null;

        const { daysInMonth, currentDayOfMonth, dailyAverage, projectedSpend } = runRateData;

        const dailyTotals = new Array(daysInMonth + 1).fill(0); // 1-indexed
        for (const tx of filteredTransactions) {
            const myShare = calculateUserShare(tx, userId);
            if (myShare <= 0) continue;
            const txCurr = (tx.currency || 'USD').toUpperCase();
            const baseCurr = (tx.base_currency || '').toUpperCase();
            const hasExchange = !!tx.exchange_rate && tx.exchange_rate !== 1;
            const amt = txCurr === bucketCurrency
                ? myShare
                : (hasExchange && baseCurr === bucketCurrency ? myShare * Number(tx.exchange_rate) : convertAmount(myShare, txCurr, bucketCurrency));
            const day = parseInt(tx.date.slice(8, 10), 10);
            if (!isNaN(day) && day >= 1 && day <= daysInMonth) {
                dailyTotals[day] += amt;
            }
        }

        const series: { day: number; actual: number | null; forecast: number | null; budget: number }[] = [];
        let cumulative = 0;
        for (let d = 1; d <= daysInMonth; d++) {
            const isPast = d <= currentDayOfMonth;
            if (isPast) cumulative += dailyTotals[d];
            const actual = isPast ? cumulative : null;
            // Forecast line starts from today's cumulative and extends straight through
            // end-of-month at the dailyAverage rate. Shows "today" twice so actual + forecast
            // share an anchor point and render as one continuous line.
            const forecast = d >= currentDayOfMonth
                ? cumulative + Math.max(0, d - currentDayOfMonth) * dailyAverage
                : null;
            series.push({ day: d, actual, forecast, budget: displayBudget });
        }

        return {
            series,
            currentDayOfMonth,
            daysInMonth,
            projectedSpend,
            budget: displayBudget
        };
    }, [
        isBucketFocused,
        runRateData,
        filteredTransactions,
        userId,
        calculateUserShare,
        bucketCurrency,
        convertAmount,
        displayBudget
    ]);

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
        runRateData,
        cashflowForecast
    };
}
