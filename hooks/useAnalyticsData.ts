import { useMemo } from 'react';
import { format, startOfMonth, endOfMonth, subMonths, parseISO, getDay, differenceInCalendarDays } from 'date-fns';
import { CATEGORY_COLORS, getCategoryLabel } from '@/lib/categories';
import type { Transaction } from '@/types/transaction';

export type DateRange = '1M' | 'LM' | '3M' | '6M' | '1Y' | 'ALL' | 'CUSTOM';

const PAYMENT_COLORS: Record<string, string> = {
    cash: '#22C55E',
    'debit card': '#3B82F6',
    'credit card': '#A855F7',
    upi: '#F59E0B',
    'bank transfer': '#06B6D4',
    other: '#EC4899',
};

type TrendBucket = { month: string; rawDate: Date; prior_total: number; [cat: string]: number | string | Date };

type BreakdownItem = {
    name: string;
    rawKey: string;
    amount: number;
    value: number;
    color: string;
    fill: string;
    stroke: string;
};

type PaymentItem = Omit<BreakdownItem, 'rawKey'>;

type LargestTx = {
    id: string;
    description: string;
    amount: number;
    date: string;
    category: string;
    place_name?: string;
};

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function computeShare(tx: Transaction, userId: string): number {
    if (tx.splits && tx.splits.length > 0) {
        if (tx.user_id === userId) {
            const othersOwe = tx.splits.reduce((sum, s) => sum + Number(s.amount), 0);
            return Number(tx.amount) - othersOwe;
        }
        const mySplit = tx.splits.find(s => s.user_id === userId);
        return mySplit ? Number(mySplit.amount) : 0;
    }
    if (tx.user_id !== userId) return 0;
    return Number(tx.amount);
}

function convertOnce(
    tx: Transaction,
    share: number,
    currency: string,
    convertAmount: (amount: number, fromCurrency: string, toCurrency?: string) => number,
): { amount: number; converted: boolean } {
    const txCurr = (tx.currency || 'USD').toUpperCase();
    const baseCurr = (tx.base_currency || '').toUpperCase();
    if (txCurr === currency.toUpperCase()) return { amount: share, converted: false };
    if (tx.exchange_rate && baseCurr === currency.toUpperCase()) {
        return { amount: share * Number(tx.exchange_rate), converted: false };
    }
    return { amount: convertAmount(share, txCurr), converted: true };
}

export function useAnalyticsData(opts: {
    transactions: Transaction[];
    priorTransactions: Transaction[];
    /** First day of the prior comparison window (local date). Null when no prior is available (ALL view). */
    priorStart: Date | null;
    dateRange: DateRange;
    currency: string;
    userId: string | null;
    convertAmount: (amount: number, fromCurrency: string, toCurrency?: string) => number;
}) {
    const { transactions, priorTransactions, priorStart, dateRange, currency, userId, convertAmount } = opts;

    return useMemo(() => {
        const empty = {
            categoryTrendData: [] as TrendBucket[],
            categoryBreakdown: [] as BreakdownItem[],
            paymentBreakdown: [] as PaymentItem[],
            totalSpentInRange: 0,
            activeCategories: [] as string[],
            topMerchants: [] as Array<{ name: string; count: number; amount: number }>,
            top3Largest: [] as LargestTx[],
            weekdayTotals: WEEKDAY_LABELS.map(label => ({ label, total: 0 })),
            txCount: 0,
            avgPerDay: 0,
            busiestLabel: null as string | null,
            priorTotal: 0,
            priorMTDTotal: 0,
            newMerchantsCount: 0,
            usedConversion: false,
        };
        if (!transactions.length || !userId) return empty;

        const now = new Date();
        const monthsMap: Record<string, TrendBucket> = {};

        let monthsBack = 5;
        if (dateRange === '1M' || dateRange === 'LM') monthsBack = -2;
        else if (dateRange === '3M') monthsBack = 2;
        else if (dateRange === '6M') monthsBack = 5;
        else if (dateRange === '1Y') monthsBack = 11;
        else if (dateRange === 'ALL' || dateRange === 'CUSTOM') monthsBack = -1;

        const initBucket = (key: string, rawDate: Date) => {
            const b: TrendBucket = { month: key, rawDate, prior_total: 0 };
            Object.keys(CATEGORY_COLORS).forEach(cat => { b[cat] = 0; });
            monthsMap[key] = b;
        };

        if (monthsBack !== -1 && monthsBack !== -2) {
            for (let i = monthsBack; i >= 0; i--) {
                const d = subMonths(now, i);
                initBucket(format(d, 'MMM yyyy'), d);
            }
        }
        if (monthsBack === -2) {
            const start = dateRange === 'LM' ? startOfMonth(subMonths(now, 1)) : startOfMonth(now);
            const endRange = endOfMonth(start);
            const current = new Date(start);
            while (current <= endRange) {
                initBucket(format(current, 'd MMM'), new Date(current));
                current.setDate(current.getDate() + 1);
            }
        }

        // --- Current period aggregation
        const breakdownMap: Record<string, number> = {};
        const paymentMap: Record<string, number> = {};
        const merchantMap: Record<string, { count: number; amount: number }> = {};
        const bucketTotals: Record<string, number> = {};
        const weekdaySum = new Array(7).fill(0); // 0=Mon .. 6=Sun
        const largest: LargestTx[] = [];
        let total = 0;
        let count = 0;
        let usedConversion = false;

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const keyForTx = (dateStr: string): string => {
            if (dateRange === '1M' || dateRange === 'LM') {
                return format(parseISO(dateStr.slice(0, 10)), 'd MMM');
            }
            const yyyymm = dateStr.slice(0, 7);
            const m = parseInt(yyyymm.slice(5, 7), 10);
            return `${monthNames[m - 1]} ${yyyymm.slice(0, 4)}`;
        };

        transactions.forEach(tx => {
            const myShare = computeShare(tx, userId);
            if (myShare <= 0) return;

            const { amount, converted } = convertOnce(tx, myShare, currency, convertAmount);
            if (converted) usedConversion = true;

            const cat = tx.category.toLowerCase();
            const timeKey = keyForTx(tx.date);

            if (monthsBack === -1 && !monthsMap[timeKey]) {
                initBucket(timeKey, parseISO(tx.date.slice(0, 10)));
            }

            const bucket = monthsMap[timeKey];
            if (bucket) {
                bucket[cat] = ((bucket[cat] as number) || 0) + amount;
                bucketTotals[timeKey] = (bucketTotals[timeKey] || 0) + amount;
            }

            breakdownMap[cat] = (breakdownMap[cat] || 0) + amount;
            const method = (tx.payment_method || 'Other').toLowerCase();
            paymentMap[method] = (paymentMap[method] || 0) + amount;

            const place = tx.place_name?.trim();
            if (place) {
                if (!merchantMap[place]) merchantMap[place] = { count: 0, amount: 0 };
                merchantMap[place].count += 1;
                merchantMap[place].amount += amount;
            }

            // date-fns getDay → 0=Sun..6=Sat. Remap to 0=Mon..6=Sun.
            const dayDate = parseISO(tx.date.slice(0, 10));
            const idx = (getDay(dayDate) + 6) % 7;
            weekdaySum[idx] += amount;

            largest.push({
                id: tx.id,
                description: tx.description,
                amount,
                date: tx.date,
                category: tx.category,
                place_name: tx.place_name,
            });

            total += amount;
            count += 1;
        });

        // --- Sort current trend buckets first so we can write prior totals into them by position.
        const sortedTrendData = Object.values(monthsMap).sort(
            (a, b) => (a.rawDate as Date).getTime() - (b.rawDate as Date).getTime()
        );

        // --- Prior period aggregation (for comparison line, MoM, new merchants).
        // Each prior tx is mapped to a *position* within the prior window, then written
        // into sortedTrendData[position].prior_total — so April 30 lands at May 30, not May 1.
        const priorMerchantSet = new Set<string>();
        let priorTotal = 0;
        let priorMTDTotal = 0;
        const todayDom = new Date().getDate();

        const positionForPriorTx = (tx: Transaction): number | null => {
            const dt = parseISO(tx.date.slice(0, 10));
            if (dateRange === '1M' || dateRange === 'LM') {
                // Day-of-month maps directly: prior day N → index N-1 of sortedTrendData
                const dom = parseInt(tx.date.slice(8, 10), 10);
                return isNaN(dom) ? null : dom - 1;
            }
            if (dateRange === '3M' || dateRange === '6M' || dateRange === '1Y') {
                if (!priorStart) return null;
                return (dt.getFullYear() - priorStart.getFullYear()) * 12
                    + (dt.getMonth() - priorStart.getMonth());
            }
            if (dateRange === 'CUSTOM') {
                if (!priorStart) return null;
                return differenceInCalendarDays(dt, priorStart);
            }
            return null; // ALL view has no prior
        };

        priorTransactions.forEach(tx => {
            const myShare = computeShare(tx, userId);
            if (myShare <= 0) return;
            const { amount, converted } = convertOnce(tx, myShare, currency, convertAmount);
            if (converted) usedConversion = true;

            priorTotal += amount;

            if (dateRange === '1M') {
                const dom = parseInt(tx.date.slice(8, 10), 10);
                if (!isNaN(dom) && dom <= todayDom) priorMTDTotal += amount;
            }

            const place = tx.place_name?.trim();
            if (place) priorMerchantSet.add(place);

            const pos = positionForPriorTx(tx);
            if (pos !== null && pos >= 0 && pos < sortedTrendData.length) {
                sortedTrendData[pos].prior_total = (sortedTrendData[pos].prior_total || 0) + amount;
            }
        });

        const displayTrendData: TrendBucket[] = sortedTrendData.map((item) => ({
            ...item,
            month: dateRange === '1Y' || dateRange === 'ALL' || dateRange === 'CUSTOM'
                ? format(item.rawDate as Date, 'MMM yy')
                : (dateRange === '1M' || dateRange === 'LM' ? format(item.rawDate as Date, 'MMM d') : format(item.rawDate as Date, 'MMM'))
        }));

        // --- Breakdown lists
        const breakdownData: BreakdownItem[] = Object.entries(breakdownMap).map(([rawKey, amount]) => ({
            name: getCategoryLabel(rawKey),
            rawKey,
            amount,
            value: total > 0 ? (amount / total) * 100 : 0,
            color: CATEGORY_COLORS[rawKey] || CATEGORY_COLORS.others,
            fill: CATEGORY_COLORS[rawKey] || CATEGORY_COLORS.others,
            stroke: CATEGORY_COLORS[rawKey] || CATEGORY_COLORS.others,
        })).sort((a, b) => b.amount - a.amount);

        const paymentData: PaymentItem[] = Object.entries(paymentMap).map(([name, amount]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            amount,
            value: total > 0 ? (amount / total) * 100 : 0,
            color: PAYMENT_COLORS[name] || PAYMENT_COLORS.other,
            fill: PAYMENT_COLORS[name] || PAYMENT_COLORS.other,
            stroke: PAYMENT_COLORS[name] || PAYMENT_COLORS.other,
        })).sort((a, b) => b.amount - a.amount);

        const activeCats = Object.entries(breakdownMap)
            .filter(([, amt]) => amt > 0)
            .sort((a, b) => b[1] - a[1])
            .map(([k]) => k);

        const merchantList = Object.entries(merchantMap)
            .map(([name, { count: c, amount: a }]) => ({ name, count: c, amount: a }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 5);

        const top3Largest = largest.sort((a, b) => b.amount - a.amount).slice(0, 3);

        const weekdayTotals = WEEKDAY_LABELS.map((label, i) => ({ label, total: weekdaySum[i] }));

        const bucketKeys = Object.keys(bucketTotals);
        const bucketCount = bucketKeys.length || 1;
        const avg = total / bucketCount;
        let busiest: string | null = null;
        if (bucketKeys.length > 0) {
            busiest = bucketKeys.reduce((a, b) => (bucketTotals[a] >= bucketTotals[b] ? a : b));
        }

        // New merchants this period: those not seen in prior
        const newMerchantsCount = Object.keys(merchantMap).filter(name => !priorMerchantSet.has(name)).length;

        return {
            categoryTrendData: displayTrendData,
            categoryBreakdown: breakdownData,
            paymentBreakdown: paymentData,
            totalSpentInRange: total,
            activeCategories: activeCats,
            topMerchants: merchantList,
            top3Largest,
            weekdayTotals,
            txCount: count,
            avgPerDay: avg,
            busiestLabel: busiest,
            priorTotal,
            priorMTDTotal,
            newMerchantsCount,
            usedConversion,
        };
    }, [transactions, priorTransactions, priorStart, dateRange, currency, userId, convertAmount]);
}
