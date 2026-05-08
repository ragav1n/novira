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

export type TagAgg = { tag: string; amount: number; count: number };

export type LocationCluster = {
    key: string;
    lat: number;
    lng: number;
    label: string;
    amount: number;
    count: number;
};

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Same snap precision as useMapData.ts so clusters here match the map view.
const LOCATION_SNAP_PRECISION = 5000;

// Approximate length of the prior-comparison window in 30-day units.
function priorWindowMonths(dateRange: DateRange): number {
    if (dateRange === '1M' || dateRange === 'LM') return 1;
    if (dateRange === '3M') return 3;
    if (dateRange === '6M') return 6;
    if (dateRange === '1Y') return 12;
    return 1;
}

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
    return { amount: convertAmount(share, txCurr, currency), converted: true };
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
    /** Tags the user has selected to filter by (AND semantics). */
    activeTags?: string[];
}) {
    const { transactions, priorTransactions, priorStart, dateRange, currency, userId, convertAmount } = opts;
    const activeTags = opts.activeTags || [];

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
            recurringTotal: 0,
            discretionaryTotal: 0,
            recurringTopCategories: [] as Array<{ category: string; amount: number }>,
            discretionaryTopCategories: [] as Array<{ category: string; amount: number }>,
            recurringTopItems: [] as Array<{ label: string; amount: number; count: number }>,
            discretionaryTopItems: [] as Array<{ label: string; amount: number; count: number }>,
            tagBreakdown: [] as TagAgg[],
            categoryAnomalies: {} as Record<string, { pct: number }>,
            dailyTotals: {} as Record<string, number>,
            locationClusters: [] as LocationCluster[],
            geoTxCount: 0,
        };
        if (!transactions.length || !userId) return empty;

        // Pre-filter by active tags (AND semantics — every selected tag must be present).
        const filteredTransactions = activeTags.length === 0
            ? transactions
            : transactions.filter(tx => {
                const txTags = tx.tags || [];
                return activeTags.every(t => txTags.includes(t));
            });

        // Build tag breakdown over the *unfiltered* set so chips don't disappear once selected.
        const tagMap: Record<string, { amount: number; count: number }> = {};
        transactions.forEach(tx => {
            const myShare = computeShare(tx, userId);
            if (myShare <= 0) return;
            const { amount } = convertOnce(tx, myShare, currency, convertAmount);
            for (const t of tx.tags || []) {
                if (!t) continue;
                if (!tagMap[t]) tagMap[t] = { amount: 0, count: 0 };
                tagMap[t].amount += amount;
                tagMap[t].count += 1;
            }
        });
        const tagBreakdown: TagAgg[] = Object.entries(tagMap)
            .map(([tag, { amount, count }]) => ({ tag, amount, count }))
            .sort((a, b) => b.amount - a.amount);

        if (!filteredTransactions.length) {
            return { ...empty, tagBreakdown };
        }

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
        const dailyTotals: Record<string, number> = {};
        const clusterMap: Record<string, { lat: number; lng: number; amount: number; count: number; labelCounts: Record<string, number> }> = {};
        let total = 0;
        let count = 0;
        let usedConversion = false;
        let recurringTotal = 0;
        let discretionaryTotal = 0;
        let geoTxCount = 0;
        const recurringByCategory: Record<string, number> = {};
        const discretionaryByCategory: Record<string, number> = {};
        const recurringByItem: Record<string, { amount: number; count: number }> = {};
        const discretionaryByItem: Record<string, { amount: number; count: number }> = {};

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const keyForTx = (dateStr: string): string => {
            if (dateRange === '1M' || dateRange === 'LM') {
                return format(parseISO(dateStr.slice(0, 10)), 'd MMM');
            }
            const yyyymm = dateStr.slice(0, 7);
            const m = parseInt(yyyymm.slice(5, 7), 10);
            return `${monthNames[m - 1]} ${yyyymm.slice(0, 4)}`;
        };

        filteredTransactions.forEach(tx => {
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

            // Geo cluster — snapped lat/lng key matches the precision used by useMapData.
            if (typeof tx.place_lat === 'number' && typeof tx.place_lng === 'number') {
                const lat = (Math.round(tx.place_lat * LOCATION_SNAP_PRECISION) / LOCATION_SNAP_PRECISION);
                const lng = (Math.round(tx.place_lng * LOCATION_SNAP_PRECISION) / LOCATION_SNAP_PRECISION);
                const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
                if (!clusterMap[key]) {
                    clusterMap[key] = { lat, lng, amount: 0, count: 0, labelCounts: {} };
                }
                clusterMap[key].amount += amount;
                clusterMap[key].count += 1;
                if (place) {
                    clusterMap[key].labelCounts[place] = (clusterMap[key].labelCounts[place] || 0) + 1;
                }
                geoTxCount += 1;
            }

            // Daily totals for calendar heatmap.
            const dayKey = tx.date.slice(0, 10);
            dailyTotals[dayKey] = (dailyTotals[dayKey] || 0) + amount;

            // Recurring vs discretionary split + top contributors per side.
            const itemLabel = (tx.description || place || tx.category || 'Unknown').trim() || 'Unknown';
            if (tx.is_recurring) {
                recurringTotal += amount;
                recurringByCategory[cat] = (recurringByCategory[cat] || 0) + amount;
                if (!recurringByItem[itemLabel]) recurringByItem[itemLabel] = { amount: 0, count: 0 };
                recurringByItem[itemLabel].amount += amount;
                recurringByItem[itemLabel].count += 1;
            } else {
                discretionaryTotal += amount;
                discretionaryByCategory[cat] = (discretionaryByCategory[cat] || 0) + amount;
                if (!discretionaryByItem[itemLabel]) discretionaryByItem[itemLabel] = { amount: 0, count: 0 };
                discretionaryByItem[itemLabel].amount += amount;
                discretionaryByItem[itemLabel].count += 1;
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
        const priorByCategory: Record<string, number> = {};
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
            // Apply the same tag filter to the prior set so anomaly comparison is apples-to-apples.
            if (activeTags.length > 0) {
                const txTags = tx.tags || [];
                if (!activeTags.every(t => txTags.includes(t))) return;
            }
            const { amount, converted } = convertOnce(tx, myShare, currency, convertAmount);
            if (converted) usedConversion = true;

            priorTotal += amount;
            const cat = tx.category.toLowerCase();
            priorByCategory[cat] = (priorByCategory[cat] || 0) + amount;

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

        // Category anomaly detection — flag categories whose per-month rate exceeds the
        // prior-window's per-month rate by ≥30%. Skips ALL view (no prior) and skips
        // categories with no prior history.
        const currentMonthsSpan = priorWindowMonths(dateRange);
        const priorMonthsSpan = priorWindowMonths(dateRange);
        const categoryAnomalies: Record<string, { pct: number }> = {};
        if (dateRange !== 'ALL' && priorTotal > 0) {
            Object.entries(breakdownMap).forEach(([cat, currentAmt]) => {
                const priorAmt = priorByCategory[cat] || 0;
                if (priorAmt <= 0) return;
                const priorRate = priorAmt / Math.max(priorMonthsSpan, 1);
                const currentRate = currentAmt / Math.max(currentMonthsSpan, 1);
                if (currentRate > priorRate * 1.3) {
                    categoryAnomalies[cat] = {
                        pct: ((currentRate - priorRate) / priorRate) * 100,
                    };
                }
            });
        }

        // Finalize location clusters: pick most-frequent place_name as the label.
        const locationClusters: LocationCluster[] = Object.entries(clusterMap)
            .map(([key, c]) => {
                const labels = Object.entries(c.labelCounts);
                const label = labels.length > 0
                    ? labels.sort((a, b) => b[1] - a[1])[0][0]
                    : `${c.lat.toFixed(3)}, ${c.lng.toFixed(3)}`;
                return { key, lat: c.lat, lng: c.lng, label, amount: c.amount, count: c.count };
            })
            .sort((a, b) => b.amount - a.amount);

        const toCategoryList = (m: Record<string, number>) =>
            Object.entries(m)
                .map(([category, amount]) => ({ category: getCategoryLabel(category), amount }))
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 4);

        const toItemList = (m: Record<string, { amount: number; count: number }>) =>
            Object.entries(m)
                .map(([label, { amount, count }]) => ({ label, amount, count }))
                .sort((a, b) => b.amount - a.amount)
                .slice(0, 4);

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
            recurringTotal,
            discretionaryTotal,
            recurringTopCategories: toCategoryList(recurringByCategory),
            discretionaryTopCategories: toCategoryList(discretionaryByCategory),
            recurringTopItems: toItemList(recurringByItem),
            discretionaryTopItems: toItemList(discretionaryByItem),
            tagBreakdown,
            categoryAnomalies,
            dailyTotals,
            locationClusters,
            geoTxCount,
        };
    }, [transactions, priorTransactions, priorStart, dateRange, currency, userId, convertAmount, activeTags]);
}
