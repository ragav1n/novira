import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, differenceInDays, parseISO, subDays } from 'date-fns';
import { DateRange } from 'react-day-picker';

interface ExportTransaction {
    date: string;
    description: string;
    category: string;
    amount: number;
    currency?: string;
    payment_method: string;
    exchange_rate?: number;
    base_currency?: string;
    converted_amount?: number;
    bucket_id?: string;
    group_id?: string;
    is_recurring?: boolean;
    is_settlement?: boolean;
    exclude_from_allowance?: boolean;
    place_name?: string | null;
    notes?: string | null;
    tags?: string[] | null;
    created_at?: string | null;
}

export interface ExportRecurringTemplate {
    id: string;
    description: string;
    category: string;
    amount: number;
    currency: string;
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    next_occurrence: string;
    is_active: boolean;
    payment_method?: string | null;
    group_id?: string | null;
}

/**
 * Shared analytics computed once, consumed by both CSV and PDF generators.
 * Centralizing this prevents the two outputs from drifting in their numbers,
 * which used to happen when each function re-derived totals separately.
 */
interface ReportStats {
    totalExpenses: number;
    totalIncome: number;
    recurringTotal: number;
    expenseTxCount: number;
    incomeTxCount: number;
    daysCovered: number;
    avgPerTx: number;
    avgPerDay: number;
    avgTxPerDay: number;
    savingsRate: number | null;
    recurringPct: number;
    netCashFlow: number;
    categoryTotals: Record<string, number>;
    incomeCategoryTotals: Record<string, number>;
    methodTotals: Record<string, number>;
    monthlyTotals: Record<string, number>;
    weeklyTotals: { weekStart: string; total: number }[];
    dowTotals: number[];
    dailyTotals: Record<string, number>; // key: yyyy-MM-dd
    locationTotals: Record<string, { count: number; total: number }>;
    bucketTotals: Record<string, { name: string; spent: number; budget: number }>;
    tagTotals: Record<string, { count: number; total: number }>;
    currencyTotals: Record<string, { count: number; nativeTotal: number; convertedTotal: number }>;
    distribution: { min: number; p25: number; median: number; p75: number; max: number; stddev: number };
    biggestSingleDay: { date: string; total: number } | null;
    biggestSingleTx: ExportTransaction | null;
    longestSpendStreak: number;
    longestNoSpendStreak: number;
    firstTxDate: string | null;
    lastTxDate: string | null;
    forecast: { projected: number; vsBudget: null | { budget: number; deltaPct: number } } | null;
    topMerchantsByVisits: { name: string; count: number; total: number }[];
    topCategory: [string, number] | null;
    busiestDay: [string, number] | null;
}

const quantile = (sorted: number[], p: number): number => {
    if (!sorted.length) return 0;
    const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor(sorted.length * p)));
    return sorted[idx];
};

function computeStats(
    transactions: ExportTransaction[],
    currency: string,
    convertAmount: (amount: number, fromCurrency: string) => number,
    buckets: any[],
    reportRange?: DateRange,
    monthlyBudget?: number,
): ReportStats {
    const bucketMap = Object.fromEntries(buckets.map(b => [b.id, b]));

    let totalExpenses = 0, totalIncome = 0, recurringTotal = 0;
    let incomeTxCount = 0;
    const categoryTotals: Record<string, number> = {};
    const incomeCategoryTotals: Record<string, number> = {};
    const methodTotals: Record<string, number> = {};
    const monthlyTotals: Record<string, number> = {};
    const weekKeyTotals: Record<string, number> = {};
    const dowTotals: number[] = [0, 0, 0, 0, 0, 0, 0];
    const dailyTotals: Record<string, number> = {};
    const locationTotals: Record<string, { count: number; total: number }> = {};
    const bucketTotals: Record<string, { name: string; spent: number; budget: number }> = {};
    const tagTotals: Record<string, { count: number; total: number }> = {};
    const currencyTotals: Record<string, { count: number; nativeTotal: number; convertedTotal: number }> = {};
    const expenseAmounts: number[] = [];
    let biggestSingleTx: ExportTransaction | null = null;
    let biggestSingleTxAmt = 0;

    transactions.forEach(tx => {
        const rawAmount = resolveAmount(tx, currency, convertAmount);
        const isIncome = rawAmount < 0 || tx.category === 'income';
        const amount = Math.abs(rawAmount);
        const dateKey = tx.date.slice(0, 10);

        // Currency split — group by source currency before conversion.
        const srcCurr = (tx.currency || currency).toUpperCase();
        if (!currencyTotals[srcCurr]) currencyTotals[srcCurr] = { count: 0, nativeTotal: 0, convertedTotal: 0 };
        currencyTotals[srcCurr].count += 1;
        currencyTotals[srcCurr].nativeTotal += Math.abs(Number(tx.amount));
        currencyTotals[srcCurr].convertedTotal += amount;

        if (isIncome) {
            totalIncome += amount;
            incomeTxCount += 1;
            incomeCategoryTotals[tx.category] = (incomeCategoryTotals[tx.category] || 0) + amount;
            return;
        }
        totalExpenses += amount;
        if (tx.is_recurring) recurringTotal += amount;
        expenseAmounts.push(amount);

        if (amount > biggestSingleTxAmt) {
            biggestSingleTxAmt = amount;
            biggestSingleTx = tx;
        }

        categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + amount;
        methodTotals[tx.payment_method || 'Other'] = (methodTotals[tx.payment_method || 'Other'] || 0) + amount;
        const dt = parseISO(dateKey);
        monthlyTotals[format(dt, 'MMM yyyy')] = (monthlyTotals[format(dt, 'MMM yyyy')] || 0) + amount;
        // ISO week key (year-week) — Monday-anchored regardless of user pref so weekly grouping is stable.
        const weekStart = new Date(dt);
        const day = weekStart.getDay();
        const diff = (day === 0 ? -6 : 1) - day;
        weekStart.setDate(weekStart.getDate() + diff);
        const weekKey = format(weekStart, 'yyyy-MM-dd');
        weekKeyTotals[weekKey] = (weekKeyTotals[weekKey] || 0) + amount;
        dowTotals[dt.getDay()] += amount;
        dailyTotals[dateKey] = (dailyTotals[dateKey] || 0) + amount;

        if (tx.place_name) {
            if (!locationTotals[tx.place_name]) locationTotals[tx.place_name] = { count: 0, total: 0 };
            locationTotals[tx.place_name].count += 1;
            locationTotals[tx.place_name].total += amount;
        }

        if (Array.isArray(tx.tags)) {
            for (const t of tx.tags) {
                if (!t) continue;
                if (!tagTotals[t]) tagTotals[t] = { count: 0, total: 0 };
                tagTotals[t].count += 1;
                tagTotals[t].total += amount;
            }
        }

        if (tx.bucket_id) {
            const bucket = bucketMap[tx.bucket_id];
            if (bucket) {
                if (!bucketTotals[tx.bucket_id]) {
                    const bucketCurr = (bucket.currency || currency).toUpperCase();
                    let effectiveBudget = convertAmount(Number(bucket.budget || 0), bucketCurr);
                    if (bucket.start_date && bucket.end_date && reportRange?.from && reportRange?.to) {
                        const bStart = new Date(bucket.start_date), bEnd = new Date(bucket.end_date);
                        const overlapStart = new Date(Math.max(bStart.getTime(), reportRange.from.getTime()));
                        const overlapEnd = new Date(Math.min(bEnd.getTime(), reportRange.to.getTime()));
                        if (overlapEnd > overlapStart) {
                            const bucketDays = Math.max(1, differenceInDays(bEnd, bStart) + 1);
                            const overlapDays = Math.max(1, differenceInDays(overlapEnd, overlapStart) + 1);
                            effectiveBudget = effectiveBudget * (overlapDays / bucketDays);
                        }
                    }
                    bucketTotals[tx.bucket_id] = { name: bucket.name, spent: 0, budget: effectiveBudget };
                }
                bucketTotals[tx.bucket_id].spent += amount;
            }
        }
    });

    const expenseTxCount = expenseAmounts.length;
    const datesWithSpend = Object.keys(dailyTotals).sort();
    const firstTxDate = datesWithSpend[0] ?? null;
    const lastTxDate = datesWithSpend[datesWithSpend.length - 1] ?? null;
    const daysCovered = reportRange?.from && reportRange?.to
        ? Math.max(1, differenceInDays(reportRange.to, reportRange.from) + 1)
        : firstTxDate && lastTxDate
            ? Math.max(1, differenceInDays(parseISO(lastTxDate), parseISO(firstTxDate)) + 1)
            : 1;
    const avgPerTx = expenseTxCount > 0 ? totalExpenses / expenseTxCount : 0;
    const avgPerDay = totalExpenses / daysCovered;
    const avgTxPerDay = expenseTxCount / daysCovered;
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : null;
    const recurringPct = totalExpenses > 0 ? (recurringTotal / totalExpenses) * 100 : 0;
    const netCashFlow = totalIncome - totalExpenses;
    const sortedAmts = [...expenseAmounts].sort((a, b) => a - b);
    const mean = expenseTxCount > 0 ? totalExpenses / expenseTxCount : 0;
    const variance = expenseTxCount > 1
        ? expenseAmounts.reduce((s, a) => s + (a - mean) ** 2, 0) / (expenseTxCount - 1)
        : 0;
    const distribution = {
        min: sortedAmts[0] ?? 0,
        p25: quantile(sortedAmts, 0.25),
        median: quantile(sortedAmts, 0.5),
        p75: quantile(sortedAmts, 0.75),
        max: sortedAmts[sortedAmts.length - 1] ?? 0,
        stddev: Math.sqrt(variance),
    };

    // Streaks: walk every day from firstTx to lastTx.
    let longestSpendStreak = 0, longestNoSpendStreak = 0;
    if (firstTxDate && lastTxDate) {
        let curSpend = 0, curDry = 0;
        const start = parseISO(firstTxDate), end = parseISO(lastTxDate);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const k = format(d, 'yyyy-MM-dd');
            if (dailyTotals[k] && dailyTotals[k] > 0) {
                curSpend += 1;
                if (curSpend > longestSpendStreak) longestSpendStreak = curSpend;
                curDry = 0;
            } else {
                curDry += 1;
                if (curDry > longestNoSpendStreak) longestNoSpendStreak = curDry;
                curSpend = 0;
            }
        }
    }

    const biggestSingleDayEntry = Object.entries(dailyTotals).sort((a, b) => b[1] - a[1])[0];
    const biggestSingleDay = biggestSingleDayEntry
        ? { date: biggestSingleDayEntry[0], total: biggestSingleDayEntry[1] }
        : null;

    const weeklyTotals = Object.entries(weekKeyTotals)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([weekStart, total]) => ({ weekStart, total }));

    // Forecast — only meaningful for an in-progress month report. If the
    // report range ends on/after today and we're partway through, project
    // month-end based on average daily spend.
    let forecast: ReportStats['forecast'] = null;
    const now = new Date();
    if (reportRange?.from && reportRange?.to && reportRange.from <= now && reportRange.to >= now && expenseTxCount > 0) {
        const elapsed = Math.max(1, differenceInDays(now, reportRange.from) + 1);
        const totalRangeDays = Math.max(elapsed, differenceInDays(reportRange.to, reportRange.from) + 1);
        const projected = (totalExpenses / elapsed) * totalRangeDays;
        forecast = {
            projected,
            vsBudget: monthlyBudget && monthlyBudget > 0
                ? { budget: monthlyBudget, deltaPct: ((projected - monthlyBudget) / monthlyBudget) * 100 }
                : null,
        };
    }

    const topMerchantsByVisits = Object.entries(locationTotals)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 10)
        .map(([name, d]) => ({ name, count: d.count, total: d.total }));

    const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0] ?? null;
    const busiestDay = Object.entries(dailyTotals).sort((a, b) => b[1] - a[1])[0] ?? null;

    return {
        totalExpenses, totalIncome, recurringTotal,
        expenseTxCount, incomeTxCount,
        daysCovered, avgPerTx, avgPerDay, avgTxPerDay,
        savingsRate, recurringPct, netCashFlow,
        categoryTotals, incomeCategoryTotals, methodTotals,
        monthlyTotals, weeklyTotals, dowTotals, dailyTotals,
        locationTotals, bucketTotals, tagTotals, currencyTotals,
        distribution,
        biggestSingleDay,
        biggestSingleTx,
        longestSpendStreak, longestNoSpendStreak,
        firstTxDate, lastTxDate,
        forecast,
        topMerchantsByVisits,
        topCategory: topCategory as [string, number] | null,
        busiestDay: busiestDay as [string, number] | null,
    };
}

/**
 * Resolves a transaction's display amount in the report's target currency.
 * Priority:
 *  1. tx.currency === displayCurrency → use tx.amount directly (no conversion, exact)
 *  2. tx.converted_amount stored in displayCurrency (base_currency matches) → use it (historical rate)
 *  3. tx.exchange_rate available → reconstruct amount in stored base_currency, then convert if needed
 *  4. Fallback: live-rate convertAmount
 */
function resolveAmount(
    tx: ExportTransaction,
    currency: string,
    convertAmount: (amount: number, fromCurrency: string) => number
): number {
    const txCurr = (tx.currency || currency).toUpperCase();
    const displayCurr = currency.toUpperCase();

    if (txCurr === displayCurr) return Number(tx.amount);

    if (tx.converted_amount && tx.base_currency?.toUpperCase() === displayCurr) {
        return tx.converted_amount;
    }

    if (tx.exchange_rate && tx.base_currency) {
        const amtInStoredBase = Number(tx.amount) * tx.exchange_rate;
        const storedBaseCurr = tx.base_currency.toUpperCase();
        if (storedBaseCurr === displayCurr) return amtInStoredBase;
        return convertAmount(amtInStoredBase, storedBaseCurr);
    }

    return convertAmount(Number(tx.amount), txCurr);
}

const CATEGORY_COLORS: Record<string, [number, number, number]> = {
    food: [138, 43, 226],
    groceries: [16, 185, 129],
    transport: [255, 107, 107],
    fashion: [244, 114, 182],
    bills: [78, 205, 196],
    shopping: [249, 199, 79],
    healthcare: [255, 159, 28],
    entertainment: [255, 20, 147],
    rent: [99, 102, 241],
    education: [132, 204, 22],
    income: [16, 185, 129],
    others: [45, 212, 191],
    uncategorized: [99, 102, 241],
};

const getCategoryColor = (category: string): [number, number, number] =>
    CATEGORY_COLORS[category.toLowerCase()] || [150, 150, 150];

const METHOD_COLORS: Record<string, [number, number, number]> = {
    cash: [74, 222, 128],
    card: [96, 165, 250],
    online: [248, 113, 113],
    other: [156, 163, 175],
    'credit card': [96, 165, 250],
    'debit card': [129, 140, 248],
    'bank transfer': [6, 182, 212],
    upi: [138, 43, 226],
};

const getMethodColor = (method: string): [number, number, number] =>
    METHOD_COLORS[(method || 'Other').toLowerCase()] || METHOD_COLORS.other;

const drawPieChart = (doc: jsPDF, data: { label: string, value: number, color: [number, number, number] }[], x: number, y: number, radius: number) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    if (total <= 0) {
        doc.setFontSize(8); doc.setTextColor(150, 150, 150);
        doc.text('No data', x, y, { align: 'center' });
        return;
    }
    let startAngle = 0;
    data.forEach((item) => {
        if (item.value <= 0) return;
        const sliceAngle = (item.value / total) * 2 * Math.PI;
        doc.setFillColor(item.color[0], item.color[1], item.color[2]);
        const segments = 30, step = sliceAngle / segments;
        for (let i = 0; i < segments; i++) {
            const a1 = startAngle + i * step, a2 = startAngle + (i + 1) * step;
            doc.triangle(x, y, x + radius * Math.cos(a1), y + radius * Math.sin(a1), x + radius * Math.cos(a2), y + radius * Math.sin(a2), 'F');
        }
        startAngle += sliceAngle;
    });
    let legendY = y - radius;
    data.filter(i => i.value > 0).slice(0, 6).forEach((item, i) => {
        doc.setFillColor(item.color[0], item.color[1], item.color[2]);
        doc.rect(x + radius + 5, legendY + (i * 6), 3, 3, 'F');
        doc.setFontSize(7); doc.setTextColor(50, 50, 50);
        const pct = ((item.value / total) * 100).toFixed(0);
        const label = item.label.length > 12 ? item.label.substring(0, 10) + '..' : item.label;
        doc.text(`${label} (${pct}%)`, x + radius + 10, legendY + (i * 6) + 2.5);
    });
};

const drawBarChart = (doc: jsPDF, data: { label: string, value: number }[], x: number, y: number, width: number, height: number, color: [number, number, number]) => {
    if (data.length === 0) return;
    const maxValue = Math.max(...data.map(d => d.value), 1);
    const barWidth = Math.min((width / data.length) * 0.7, 15);
    const spacing = data.length > 1 ? (width - barWidth * data.length) / (data.length - 1) : 0;
    const totalContentWidth = barWidth * data.length + spacing * (data.length - 1);
    const startX = x + (width - totalContentWidth) / 2;
    doc.setDrawColor(200, 200, 200);
    doc.line(x, y + height, x + width, y + height);
    data.forEach((item, i) => {
        const bh = (item.value / maxValue) * height;
        doc.setFillColor(color[0], color[1], color[2]);
        doc.rect(startX + i * (barWidth + spacing), y + height - bh, barWidth, bh, 'F');
        doc.setFontSize(6); doc.setTextColor(100, 100, 100);
        doc.text(item.label, startX + i * (barWidth + spacing) + barWidth / 2, y + height + 5, { align: 'center' });
    });
};

const drawProgressBar = (doc: jsPDF, percent: number, x: number, y: number, width: number, height: number, color: [number, number, number]) => {
    doc.setFillColor(240, 240, 240);
    doc.rect(x, y, width, height, 'F');
    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(x, y, Math.min(width, (percent / 100) * width), height, 'F');
};

const drawInsightBox = (doc: jsPDF, x: number, y: number, w: number, h: number, label: string, value: string, color: [number, number, number]) => {
    doc.setFillColor(color[0], color[1], color[2]);
    doc.setGState(new (doc as any).GState({ opacity: 0.08 }));
    doc.rect(x, y, w, h, 'F');
    doc.setGState(new (doc as any).GState({ opacity: 1 }));
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.setLineWidth(0.4);
    doc.rect(x, y, w, h);
    doc.setLineWidth(0.2);
    doc.setFontSize(6.5); doc.setTextColor(100, 100, 100);
    doc.text(label.toUpperCase(), x + 3, y + 5);
    doc.setFontSize(9); doc.setFont('helvetica', 'bold');
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(value, x + 3, y + 11);
    doc.setFont('helvetica', 'normal');
};

export const generateCSV = (
    transactions: ExportTransaction[],
    currency: string,
    convertAmount: (amount: number, fromCurrency: string) => number,
    formatCurrency: (amount: number, currency?: string) => string,
    buckets: any[] = [],
    groups: any[] = [],
    reportRange?: DateRange,
    ownerInfo?: { email?: string; workspaceName?: string; monthlyBudget?: number },
    recurringTemplates: ExportRecurringTemplate[] = []
) => {
    // RFC 4180-compliant quoting — always quote strings
    const q = (val: string | number | null | undefined): string => {
        if (val === null || val === undefined) return '';
        if (typeof val === 'number') return String(val);
        return `"${String(val).replace(/"/g, '""')}"`;
    };
    const row = (...cols: (string | number | null | undefined)[]) => cols.map(q).join(',');
    const blank = () => '';
    const heading = (title: string) => `${q(title)}`;

    const bucketMap = Object.fromEntries(buckets.map(b => [b.id, b]));
    const groupMap = Object.fromEntries(groups.map(g => [g.id, g]));
    // Drop rows that would produce NaN/undefined in the report
    transactions = transactions.filter(tx => tx.date && tx.amount != null && !isNaN(Number(tx.amount)));
    const sorted = [...transactions].sort((a, b) => parseISO(a.date.slice(0, 10)).getTime() - parseISO(b.date.slice(0, 10)).getTime());

    const stats = computeStats(transactions, currency, convertAmount, buckets, reportRange, ownerInfo?.monthlyBudget);
    const {
        totalExpenses, totalIncome, recurringTotal,
        expenseTxCount, incomeTxCount,
        daysCovered, avgPerTx, avgPerDay, avgTxPerDay,
        savingsRate, recurringPct, netCashFlow,
        categoryTotals, incomeCategoryTotals, methodTotals,
        monthlyTotals, weeklyTotals, dowTotals, locationTotals,
        bucketTotals, tagTotals, currencyTotals,
        distribution, biggestSingleDay, biggestSingleTx,
        longestSpendStreak, longestNoSpendStreak,
        firstTxDate, lastTxDate, forecast,
        topCategory,
    } = stats;

    const dowLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const lines: string[] = [];

    // ── Section 1: Report Info ─────────────────────────────────────────────────
    lines.push(heading('NOVIRA FINANCIAL REPORT'));
    if (ownerInfo?.workspaceName) lines.push(row('Workspace', ownerInfo.workspaceName));
    if (ownerInfo?.email)         lines.push(row('Account', ownerInfo.email));
    if (reportRange?.from) {
        const period = reportRange.to
            ? `${format(reportRange.from, 'MMM d, yyyy')} – ${format(reportRange.to, 'MMM d, yyyy')}`
            : `From ${format(reportRange.from, 'MMM d, yyyy')}`;
        lines.push(row('Period', period));
    }
    if (firstTxDate && lastTxDate) {
        lines.push(row('Data Range', `${firstTxDate} – ${lastTxDate}`));
    }
    lines.push(row('Generated', format(new Date(), 'PPP p')));
    lines.push(row('All amounts in', currency));
    lines.push(blank());

    // ── Section 2: Financial Summary ──────────────────────────────────────────
    lines.push(heading('FINANCIAL SUMMARY'));
    lines.push(row('Metric', 'Value'));
    lines.push(row('Total Expenses', totalExpenses.toFixed(2)));
    lines.push(row('Total Income', totalIncome.toFixed(2)));
    lines.push(row('Net Cash Flow', netCashFlow.toFixed(2)));
    lines.push(row('Expense Transactions', expenseTxCount));
    lines.push(row('Income Transactions', incomeTxCount));
    lines.push(row('Avg Per Transaction', avgPerTx.toFixed(2)));
    lines.push(row('Avg Daily Spend', avgPerDay.toFixed(2)));
    lines.push(row('Avg Transactions Per Day', avgTxPerDay.toFixed(2)));
    lines.push(row('Days Covered', daysCovered));
    lines.push(row('Savings Rate', savingsRate !== null ? `${savingsRate.toFixed(1)}%` : 'N/A'));
    lines.push(row('Recurring Spend', `${recurringPct.toFixed(1)}% of total`));
    lines.push(row('Recurring Total', recurringTotal.toFixed(2)));
    if (topCategory) lines.push(row('Top Category', `${topCategory[0]} (${((topCategory[1] / totalExpenses) * 100).toFixed(1)}%)`));
    lines.push(blank());

    // ── Section 2b: Spending Distribution ─────────────────────────────────────
    if (expenseTxCount > 0) {
        lines.push(heading('SPENDING DISTRIBUTION (per expense)'));
        lines.push(row('Statistic', `Amount (${currency})`));
        lines.push(row('Smallest', distribution.min.toFixed(2)));
        lines.push(row('25th Percentile', distribution.p25.toFixed(2)));
        lines.push(row('Median', distribution.median.toFixed(2)));
        lines.push(row('75th Percentile', distribution.p75.toFixed(2)));
        lines.push(row('Largest', distribution.max.toFixed(2)));
        lines.push(row('Std. Deviation', distribution.stddev.toFixed(2)));
        lines.push(blank());
    }

    // ── Section 2c: Streaks & Highlights ──────────────────────────────────────
    lines.push(heading('STREAKS & HIGHLIGHTS'));
    lines.push(row('Metric', 'Value'));
    lines.push(row('Longest Spending Streak', `${longestSpendStreak} day${longestSpendStreak === 1 ? '' : 's'}`));
    lines.push(row('Longest No-Spend Streak', `${longestNoSpendStreak} day${longestNoSpendStreak === 1 ? '' : 's'}`));
    if (biggestSingleDay) {
        lines.push(row('Biggest Spending Day', `${biggestSingleDay.date} (${biggestSingleDay.total.toFixed(2)} ${currency})`));
    }
    if (biggestSingleTx) {
        lines.push(row('Largest Single Transaction', `${biggestSingleTx.description} — ${Math.abs(resolveAmount(biggestSingleTx, currency, convertAmount)).toFixed(2)} ${currency} on ${biggestSingleTx.date.slice(0, 10)}`));
    }
    lines.push(blank());

    // ── Section 2d: Forecast (if applicable) ──────────────────────────────────
    if (forecast) {
        lines.push(heading('FORECAST (PERIOD-END PROJECTION)'));
        lines.push(row('Metric', 'Value'));
        lines.push(row('Projected Total', forecast.projected.toFixed(2)));
        if (forecast.vsBudget) {
            const sign = forecast.vsBudget.deltaPct >= 0 ? '+' : '';
            lines.push(row('Monthly Budget', forecast.vsBudget.budget.toFixed(2)));
            lines.push(row('Projected vs Budget', `${sign}${forecast.vsBudget.deltaPct.toFixed(1)}%`));
        }
        lines.push(blank());
    }

    // ── Section 3: Category Breakdown ─────────────────────────────────────────
    lines.push(heading('CATEGORY BREAKDOWN'));
    lines.push(row('Category', `Amount (${currency})`, '% of Total'));
    Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1])
        .forEach(([cat, amt]) => {
            const pct = totalExpenses > 0 ? ((amt / totalExpenses) * 100).toFixed(1) : '0.0';
            lines.push(row(cat.charAt(0).toUpperCase() + cat.slice(1), amt.toFixed(2), `${pct}%`));
        });
    lines.push(blank());

    // ── Section 3b: Income by Category ────────────────────────────────────────
    if (Object.keys(incomeCategoryTotals).length > 0) {
        lines.push(heading('INCOME BY CATEGORY'));
        lines.push(row('Category', `Amount (${currency})`, '% of Income'));
        Object.entries(incomeCategoryTotals)
            .sort((a, b) => b[1] - a[1])
            .forEach(([cat, amt]) => {
                const pct = totalIncome > 0 ? ((amt / totalIncome) * 100).toFixed(1) : '0.0';
                lines.push(row(cat.charAt(0).toUpperCase() + cat.slice(1), amt.toFixed(2), `${pct}%`));
            });
        lines.push(blank());
    }

    // ── Section 4: Payment Method Breakdown ───────────────────────────────────
    lines.push(heading('PAYMENT METHOD BREAKDOWN'));
    lines.push(row('Method', `Amount (${currency})`, '% of Total'));
    Object.entries(methodTotals)
        .sort((a, b) => b[1] - a[1])
        .forEach(([method, amt]) => {
            const pct = totalExpenses > 0 ? ((amt / totalExpenses) * 100).toFixed(1) : '0.0';
            lines.push(row(method, amt.toFixed(2), `${pct}%`));
        });
    lines.push(blank());

    // ── Section 4b: Currency Mix (only if multi-currency) ─────────────────────
    if (Object.keys(currencyTotals).length > 1) {
        lines.push(heading('CURRENCY MIX'));
        lines.push(row('Currency', 'Transactions', 'Native Total', `Converted (${currency})`));
        Object.entries(currencyTotals)
            .sort((a, b) => b[1].convertedTotal - a[1].convertedTotal)
            .forEach(([curr, d]) => {
                lines.push(row(curr, d.count, d.nativeTotal.toFixed(2), d.convertedTotal.toFixed(2)));
            });
        lines.push(blank());
    }

    // ── Section 5: Spending by Day of Week ────────────────────────────────────
    lines.push(heading('SPENDING BY DAY OF WEEK'));
    lines.push(row('Day', `Total Spent (${currency})`));
    dowLabels.forEach((day, i) => lines.push(row(day, dowTotals[i].toFixed(2))));
    lines.push(blank());

    // ── Section 5b: Weekly Recap ──────────────────────────────────────────────
    if (weeklyTotals.length > 1) {
        lines.push(heading('WEEKLY RECAP (week of)'));
        lines.push(row('Week Starting', `Total Spent (${currency})`));
        weeklyTotals.forEach(({ weekStart, total }) => lines.push(row(weekStart, total.toFixed(2))));
        lines.push(blank());
    }

    // ── Section 6: Monthly Recap ──────────────────────────────────────────────
    if (Object.keys(monthlyTotals).length > 1) {
        lines.push(heading('MONTHLY RECAP'));
        lines.push(row('Month', `Total Spent (${currency})`));
        Object.entries(monthlyTotals)
            .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
            .forEach(([month, amt]) => lines.push(row(month, amt.toFixed(2))));
        lines.push(blank());
    }

    // ── Section 7: Bucket Performance ─────────────────────────────────────────
    if (Object.keys(bucketTotals).length > 0) {
        lines.push(heading('BUCKET PERFORMANCE'));
        lines.push(row('Bucket', `Spent (${currency})`, `Budget (${currency})`, '% Used', 'Status'));
        Object.values(bucketTotals).forEach(({ name, spent, budget }) => {
            const hasBudget = budget > 0;
            const pct = hasBudget ? (spent / budget) * 100 : null;
            const status = !hasBudget ? 'No Budget' : pct! > 100 ? 'Over Budget' : pct! > 80 ? 'Near Limit' : 'On Track';
            lines.push(row(name, spent.toFixed(2), hasBudget ? budget.toFixed(2) : '', pct !== null ? `${pct.toFixed(1)}%` : '', status));
        });
        lines.push(blank());
    }

    // ── Section 7b: Tags Breakdown ────────────────────────────────────────────
    if (Object.keys(tagTotals).length > 0) {
        lines.push(heading('TAGS BREAKDOWN'));
        lines.push(row('Tag', 'Transactions', `Total Spent (${currency})`, '% of Total'));
        Object.entries(tagTotals)
            .sort((a, b) => b[1].total - a[1].total)
            .forEach(([tag, d]) => {
                const pct = totalExpenses > 0 ? ((d.total / totalExpenses) * 100).toFixed(1) : '0.0';
                lines.push(row(tag, d.count, d.total.toFixed(2), `${pct}%`));
            });
        lines.push(blank());
    }

    // ── Section 8: Top Locations ──────────────────────────────────────────────
    const topLocations = Object.entries(locationTotals).sort((a, b) => b[1].count - a[1].count).slice(0, 10);
    if (topLocations.length > 0) {
        lines.push(heading('TOP LOCATIONS'));
        lines.push(row('Location', 'Visits', `Total Spent (${currency})`, `Avg Per Visit (${currency})`));
        topLocations.forEach(([name, data]) => {
            lines.push(row(name, data.count, data.total.toFixed(2), (data.total / data.count).toFixed(2)));
        });
        lines.push(blank());
    }

    // ── Section 8b: Recurring Templates ───────────────────────────────────────
    if (recurringTemplates.length > 0) {
        lines.push(heading('RECURRING TEMPLATES'));
        lines.push(row(
            'Description', 'Category', 'Amount', 'Currency',
            'Frequency', 'Next Occurrence', 'Active', 'Group', 'Payment Method'
        ));
        const sortedTemplates = [...recurringTemplates].sort((a, b) => a.next_occurrence.localeCompare(b.next_occurrence));
        sortedTemplates.forEach(t => {
            const group = t.group_id ? groupMap[t.group_id] : null;
            lines.push(row(
                t.description,
                t.category.charAt(0).toUpperCase() + t.category.slice(1),
                Number(t.amount).toFixed(2),
                t.currency,
                t.frequency.charAt(0).toUpperCase() + t.frequency.slice(1),
                t.next_occurrence,
                t.is_active ? 'Yes' : 'No',
                group?.name || '',
                t.payment_method || '',
            ));
        });
        lines.push(blank());
    }

    // ── Section 9: Transaction Details ────────────────────────────────────────
    lines.push(heading('TRANSACTION DETAILS'));
    lines.push(row(
        'Date', 'Description', 'Category', 'Type',
        'Bucket', 'Group', 'Payment Method',
        `Amount (Original)`, 'Original Currency',
        `Converted Amount (${currency})`,
        'Location', 'Tags', 'Notes', 'Recurring', 'Excluded from Allowance'
    ));
    sorted.forEach(tx => {
        const converted = resolveAmount(tx, currency, convertAmount);
        const isIncome = converted < 0 || tx.category === 'income';
        const bucket = tx.bucket_id ? bucketMap[tx.bucket_id] : null;
        const group = tx.group_id ? groupMap[tx.group_id] : null;
        const dateObj = parseISO(tx.date.slice(0, 10));
        lines.push(row(
            format(dateObj, 'yyyy-MM-dd'),
            tx.description,
            tx.is_settlement ? 'Settlement' : tx.category.charAt(0).toUpperCase() + tx.category.slice(1),
            tx.is_settlement ? 'Settlement' : isIncome ? 'Income' : 'Expense',
            bucket?.name || '',
            group?.name || '',
            tx.payment_method || '',
            Number(tx.amount).toFixed(2),
            tx.currency || currency,
            Math.abs(converted).toFixed(2),
            tx.place_name || '',
            Array.isArray(tx.tags) && tx.tags.length ? tx.tags.join('; ') : '',
            tx.notes || '',
            tx.is_recurring ? 'Yes' : 'No',
            tx.exclude_from_allowance ? 'Yes' : 'No',
        ));
    });

    // UTF-8 BOM ensures Excel opens the file with correct encoding (fixes €, ₹, etc.)
    const BOM = '\uFEFF';
    const csvContent = BOM + lines.join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `novira_export_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

const loadImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });

export const generatePDF = async (
    transactions: ExportTransaction[],
    currency: string,
    convertAmount: (amount: number, fromCurrency: string) => number,
    formatCurrency: (amount: number, currency?: string) => string,
    buckets: any[] = [],
    groups: any[] = [],
    reportRange?: DateRange,
    ownerInfo?: { email?: string; avatarUrl?: string | null; workspaceName?: string; monthlyBudget?: number },
    recurringTemplates: ExportRecurringTemplate[] = []
) => {
    const doc = new jsPDF({ putOnlyUsedFonts: true, compress: true });
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;

    const bucketMap = Object.fromEntries(buckets.map(b => [b.id, b]));

    // Drop rows that would produce NaN/undefined in the report
    transactions = transactions.filter(tx => tx.date && tx.amount != null && !isNaN(Number(tx.amount)));

    const sortedTx = [...transactions].sort(
        (a, b) => parseISO(a.date.slice(0, 10)).getTime() - parseISO(b.date.slice(0, 10)).getTime()
    );

    const formatForPDF = (amount: number, cur?: string) =>
        formatCurrency(amount, cur)
            .replace('₹', 'Rs. ').replace('₫', ' VND ').replace('₩', ' KRW ')
            .replace('¥', ' JPY ').replace('฿', ' THB ').replace('₱', ' PHP ')
            .replace('NT$', ' TWD ').replace('S$', ' SGD ').replace('HK$', ' HKD ')
            .replace('Mex$', ' MXN ').replace('C$', ' CAD ').replace('A$', ' AUD ')
            .replace('RM', ' MYR ').replace('R$', ' BRL ').replace('Rp', ' IDR ');

    const stats = computeStats(transactions, currency, convertAmount, buckets, reportRange, ownerInfo?.monthlyBudget);
    const {
        totalExpenses, totalIncome, recurringTotal,
        expenseTxCount, incomeTxCount,
        daysCovered, avgPerTx: avgPerTransaction, avgPerDay, avgTxPerDay,
        savingsRate, recurringPct, netCashFlow,
        categoryTotals, incomeCategoryTotals, methodTotals,
        monthlyTotals, weeklyTotals, dowTotals, dailyTotals,
        bucketTotals, tagTotals, currencyTotals,
        distribution, biggestSingleDay, biggestSingleTx,
        longestSpendStreak, longestNoSpendStreak,
        firstTxDate, lastTxDate, forecast,
        topMerchantsByVisits,
        topCategory, busiestDay,
    } = stats;

    const topExpenses = [...transactions]
        .filter(tx => resolveAmount(tx, currency, convertAmount) > 0 && tx.category !== 'income')
        .map(tx => ({ ...tx, converted: resolveAmount(tx, currency, convertAmount) }))
        .sort((a, b) => b.converted - a.converted)
        .slice(0, 5);

    const topLocations = topMerchantsByVisits.slice(0, 5).map(m => [m.name, { count: m.count, total: m.total }] as [string, { count: number; total: number }]);

    // ── PAGE 1 ────────────────────────────────────────────────────────────────
    doc.setFillColor(138, 43, 226);
    doc.rect(0, 0, pageWidth, 44, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22); doc.setFont('helvetica', 'bold');
    doc.text('Expense Audit Report', 14, 18);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);

    if (ownerInfo?.workspaceName) {
        doc.setTextColor(220, 200, 255);
        doc.setFontSize(10); doc.setFont('helvetica', 'bold');
        doc.text(ownerInfo.workspaceName, 14, 26);
        doc.setFont('helvetica', 'normal');
    }

    doc.setTextColor(200, 185, 240); doc.setFontSize(8);
    doc.text(`Generated: ${format(new Date(), 'PPP')}`, 14, 33);

    if (reportRange?.from) {
        const rangeText = reportRange.to
            ? `Period: ${format(reportRange.from, 'MMM d, yyyy')} – ${format(reportRange.to, 'MMM d, yyyy')}`
            : `From: ${format(reportRange.from, 'MMM d, yyyy')}`;
        doc.setTextColor(220, 200, 255);
        doc.text(rangeText, 14, 39);
    }

    // Currency disclaimer — top-right of header
    doc.setTextColor(200, 185, 240); doc.setFontSize(7.5);
    doc.text(`All amounts in ${currency}`, pageWidth - 14, 33, { align: 'right' });

    if (ownerInfo) {
        if (ownerInfo.avatarUrl) {
            try {
                const img = await loadImage(ownerInfo.avatarUrl);
                doc.addImage(img, 'JPEG', pageWidth - 28, 8, 14, 14, undefined, 'FAST');
            } catch (err) {
                console.error('[export] avatar load failed', ownerInfo.avatarUrl, err);
            }
        }
        doc.setFontSize(8); doc.setTextColor(200, 185, 240);
        doc.text(ownerInfo.email || '', pageWidth - 14, 39, { align: 'right' });
    }

    // ── Summary row 1: Spent / Income / Net ──────────────────────────────────
    doc.setTextColor(50, 50, 50); doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text('Financial Overview', 14, 55);
    doc.setFont('helvetica', 'normal');

    const box = (bx: number, label: string, value: string, rgb: [number, number, number]) => {
        doc.setDrawColor(230, 230, 230); doc.rect(bx, 59, 56, 22);
        doc.setFontSize(7); doc.setTextColor(120, 120, 120);
        doc.text(label, bx + 3, 66);
        doc.setFontSize(11); doc.setFont('helvetica', 'bold');
        doc.setTextColor(rgb[0], rgb[1], rgb[2]);
        doc.text(value, bx + 3, 76);
        doc.setFont('helvetica', 'normal');
    };
    box(14,  'TOTAL SPENT',    formatForPDF(totalExpenses, currency), [138, 43, 226]);
    box(73,  'TOTAL INCOME',   formatForPDF(totalIncome, currency),   [16, 185, 129]);
    box(132, 'NET CASH FLOW',  formatForPDF(netCashFlow, currency),   netCashFlow >= 0 ? [16, 185, 129] : [255, 107, 107]);

    // ── Summary row 2: Count / Avg tx / Avg day ───────────────────────────────
    const sbox = (bx: number, label: string, value: string) => {
        doc.setDrawColor(240, 240, 240); doc.rect(bx, 84, 56, 18);
        doc.setFontSize(7); doc.setTextColor(130, 130, 130);
        doc.text(label, bx + 3, 90);
        doc.setFontSize(10); doc.setFont('helvetica', 'bold');
        doc.setTextColor(80, 80, 80);
        doc.text(value, bx + 3, 98);
        doc.setFont('helvetica', 'normal');
    };
    sbox(14,  'TRANSACTIONS',        `${expenseTxCount} expenses`);
    sbox(73,  'AVG PER TRANSACTION', formatForPDF(avgPerTransaction, currency));
    sbox(132, 'AVG DAILY SPEND',     formatForPDF(avgPerDay, currency));

    // ── Pie Charts ────────────────────────────────────────────────────────────
    doc.setTextColor(50, 50, 50); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('Category Breakdown', 14, 116);
    doc.text('Payment Methods', 110, 116);
    doc.setFont('helvetica', 'normal');

    const pieData = Object.entries(categoryTotals).map(([label, value]) => ({
        label: label.charAt(0).toUpperCase() + label.slice(1), value, color: getCategoryColor(label)
    })).sort((a, b) => b.value - a.value);
    drawPieChart(doc, pieData, 35, 140, 20);

    const methodData = Object.entries(methodTotals).map(([label, value]) => ({
        label: label.charAt(0).toUpperCase() + label.slice(1), value, color: getMethodColor(label)
    })).sort((a, b) => b.value - a.value);
    drawPieChart(doc, methodData, 130, 140, 20);

    // ── Spending Trend + Top Expenses ─────────────────────────────────────────
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('Spending Trend (Last 7 Days)', 14, 176);
    doc.text('Top 5 Expenses', 110, 176);
    doc.setFont('helvetica', 'normal');

    // Last 7 calendar days (anchored to report end or today), including zero days.
    const trendEnd = reportRange?.to ?? new Date();
    const barData: { label: string, value: number }[] = [];
    for (let i = 6; i >= 0; i--) {
        const d = subDays(trendEnd, i);
        const key = format(d, 'yyyy-MM-dd');
        barData.push({ label: format(d, 'EEEEE'), value: dailyTotals[key] || 0 });
    }
    drawBarChart(doc, barData, 14, 182, 85, 38, [138, 43, 226]);

    topExpenses.forEach((tx, i) => {
        const y = 184 + i * 9;
        const desc = (tx.is_recurring ? `${tx.description} (R)` : tx.description);
        doc.setFontSize(8); doc.setTextColor(80, 80, 80);
        doc.text(desc.length > 26 ? desc.substring(0, 24) + '..' : desc, 110, y);
        doc.setTextColor(138, 43, 226);
        doc.text(formatForPDF(tx.converted, currency), pageWidth - 14, y, { align: 'right' });
        doc.setDrawColor(245, 245, 245);
        doc.line(110, y + 2, pageWidth - 14, y + 2);
    });

    // ── Top Locations (bottom of page 1, if data exists) ─────────────────────
    if (topLocations.length > 0) {
        doc.setFontSize(10); doc.setFont('helvetica', 'bold');
        doc.text('Top Locations', 14, 232);
        doc.setFont('helvetica', 'normal');
        topLocations.forEach(([name, data], i) => {
            const y = 239 + i * 8;
            doc.setFontSize(8); doc.setTextColor(80, 80, 80);
            const shortName = name.length > 28 ? name.substring(0, 26) + '..' : name;
            doc.text(shortName, 14, y);
            doc.setTextColor(100, 100, 100);
            const avgVisit = data.count > 0 ? data.total / data.count : 0;
            doc.text(`${data.count}x · avg ${formatForPDF(avgVisit, currency)}/visit`, 120, y);
            doc.setTextColor(138, 43, 226);
            doc.text(formatForPDF(data.total, currency), pageWidth - 14, y, { align: 'right' });
            doc.setDrawColor(245, 245, 245);
            doc.line(14, y + 2, pageWidth - 14, y + 2);
        });
    }

    // ── PAGE 2 ────────────────────────────────────────────────────────────────
    doc.addPage();

    // ── Spending Insights ─────────────────────────────────────────────────────
    doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(50, 50, 50);
    doc.text('Spending Insights', 14, 18);
    doc.setFont('helvetica', 'normal');

    const insightW = 42, insightH = 16, insightGap = 3;
    const insightStartX = 14;

    drawInsightBox(doc, insightStartX,                         22, insightW, insightH, 'Top Category',
        topCategory ? `${topCategory[0].charAt(0).toUpperCase() + topCategory[0].slice(1)} (${((topCategory[1] / totalExpenses) * 100).toFixed(0)}%)` : 'N/A',
        [138, 43, 226]);

    drawInsightBox(doc, insightStartX + insightW + insightGap, 22, insightW, insightH, 'Busiest Day',
        busiestDay ? `${busiestDay[0]} — ${formatForPDF(busiestDay[1], currency)}` : 'N/A',
        [255, 107, 107]);

    drawInsightBox(doc, insightStartX + (insightW + insightGap) * 2, 22, insightW, insightH, 'Recurring Spend',
        `${recurringPct.toFixed(0)}% of total`,
        [78, 205, 196]);

    drawInsightBox(doc, insightStartX + (insightW + insightGap) * 3, 22, insightW, insightH,
        savingsRate !== null ? 'Savings Rate' : 'Period Covered',
        savingsRate !== null ? `${savingsRate.toFixed(1)}%` : `${daysCovered} days`,
        [16, 185, 129]);

    // ── Day-of-Week Pattern ───────────────────────────────────────────────────
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(50, 50, 50);
    doc.text('Spending by Day of Week', 14, 50);
    doc.setFont('helvetica', 'normal');
    const dowLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dowData = dowLabels.map((label, i) => ({ label, value: dowTotals[i] }));
    drawBarChart(doc, dowData, 14, 56, 85, 30, [138, 43, 226]);

    // ── Bucket Performance ────────────────────────────────────────────────────
    doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(50, 50, 50);
    doc.text('Bucket Performance', 110, 50);
    doc.setFont('helvetica', 'normal');

    let bucketY = 57;
    const bucketEntries = Object.values(bucketTotals);
    if (bucketEntries.length === 0) {
        doc.setFontSize(9); doc.setTextColor(150, 150, 150);
        doc.text('No buckets in this report.', 110, bucketY);
        bucketY += 10;
    } else {
        bucketEntries.forEach((data) => {
            if (bucketY > 88) return;
            const hasBudget = data.budget > 0;
            const pct = hasBudget ? (data.spent / data.budget) * 100 : 0;
            const name = data.name;

            // Name + % used
            doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(50, 50, 50);
            doc.text(name.length > 20 ? name.substring(0, 18) + '..' : name, 110, bucketY);
            if (hasBudget) {
                doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(130, 130, 130);
                doc.text(`${pct.toFixed(1)}% used`, pageWidth - 14, bucketY, { align: 'right' });
            }

            // Spent / Budget on second line
            doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
            doc.setTextColor(80, 80, 80);
            doc.text(`Spent: ${formatForPDF(data.spent, currency)}`, 110, bucketY + 5);
            if (hasBudget) {
                doc.setTextColor(120, 120, 120);
                doc.text(`Budget: ${formatForPDF(data.budget, currency)}`, pageWidth - 14, bucketY + 5, { align: 'right' });
            }

            // Progress bar
            const progressColor: [number, number, number] = !hasBudget ? [200, 200, 200] : (pct > 100 ? [255, 107, 107] : [74, 222, 128]);
            drawProgressBar(doc, hasBudget ? pct : 100, 110, bucketY + 7, pageWidth - 124, 3, progressColor);

            if (hasBudget && pct > 100) {
                doc.setTextColor(255, 107, 107); doc.setFontSize(6.5);
                doc.text(`Over budget by ${formatForPDF(data.spent - data.budget, currency)}`, 110, bucketY + 14);
            }
            bucketY += hasBudget && pct > 100 ? 20 : 15;
        });
    }

    // ── Category Breakdown Table ──────────────────────────────────────────────
    let tableStartY = 100;
    const categoryRows = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, amt]) => {
            const pct = totalExpenses > 0 ? ((amt / totalExpenses) * 100).toFixed(1) : '0.0';
            return [cat.charAt(0).toUpperCase() + cat.slice(1), formatForPDF(amt, currency), `${pct}%`];
        });
    if (categoryRows.length > 0) {
        doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(50, 50, 50);
        doc.text('Category Breakdown', 14, tableStartY);
        doc.setFont('helvetica', 'normal');
        autoTable(doc as any, {
            head: [['Category', 'Amount', '% of Total']],
            body: categoryRows,
            startY: tableStartY + 4,
            theme: 'striped',
            headStyles: { fillColor: [138, 43, 226], textColor: [255, 255, 255] },
            styles: { fontSize: 8 },
            columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
            tableWidth: 'auto',
            margin: { left: 14, right: pageWidth / 2 + 5 },
        });
        tableStartY = (doc as any).lastAutoTable.finalY + 10;
    }

    // ── Monthly Recap ─────────────────────────────────────────────────────────
    if (Object.keys(monthlyTotals).length > 1) {
        doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(50, 50, 50);
        doc.text('Monthly Recap', 14, tableStartY);
        doc.setFont('helvetica', 'normal');
        const monthRows = Object.entries(monthlyTotals)
            .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
            .map(([month, amount]) => [month, formatForPDF(amount, currency)]);
        autoTable(doc as any, {
            head: [['Month', 'Total Spent']],
            body: monthRows,
            startY: tableStartY + 4,
            theme: 'striped',
            headStyles: { fillColor: [138, 43, 226], textColor: [255, 255, 255] },
            styles: { fontSize: 8 },
            tableWidth: 80,
        });
        tableStartY = (doc as any).lastAutoTable.finalY + 10;
    }

    // ── PAGE 3: Distribution, Streaks, Tags, Currency Mix ─────────────────────
    const hasExtras = expenseTxCount > 0 || Object.keys(tagTotals).length > 0
        || Object.keys(currencyTotals).length > 1
        || Object.keys(incomeCategoryTotals).length > 0
        || forecast !== null;

    if (hasExtras) {
        doc.addPage();
        let y = 18;
        doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(50, 50, 50);
        doc.text('Spending Distribution & Highlights', 14, y);
        doc.setFont('helvetica', 'normal');
        y += 6;

        if (expenseTxCount > 0) {
            const cellW = 42, cellH = 16, gap = 3;
            // Row 1: distribution
            drawInsightBox(doc, 14,                     y, cellW, cellH, 'Smallest', formatForPDF(distribution.min, currency), [78, 205, 196]);
            drawInsightBox(doc, 14 + (cellW + gap) * 1, y, cellW, cellH, 'Median',   formatForPDF(distribution.median, currency), [138, 43, 226]);
            drawInsightBox(doc, 14 + (cellW + gap) * 2, y, cellW, cellH, '75th %ile', formatForPDF(distribution.p75, currency), [255, 159, 28]);
            drawInsightBox(doc, 14 + (cellW + gap) * 3, y, cellW, cellH, 'Largest',  formatForPDF(distribution.max, currency), [255, 107, 107]);
            y += cellH + 4;

            // Row 2: streaks + biggest day
            drawInsightBox(doc, 14,                     y, cellW, cellH, 'Spend Streak', `${longestSpendStreak}d`, [16, 185, 129]);
            drawInsightBox(doc, 14 + (cellW + gap) * 1, y, cellW, cellH, 'No-Spend Streak', `${longestNoSpendStreak}d`, [99, 102, 241]);
            const biggestDayLabel = biggestSingleDay
                ? `${format(parseISO(biggestSingleDay.date), 'MMM d')} ${formatForPDF(biggestSingleDay.total, currency)}`
                : '—';
            drawInsightBox(doc, 14 + (cellW + gap) * 2, y, cellW, cellH, 'Biggest Day', biggestDayLabel, [255, 20, 147]);
            drawInsightBox(doc, 14 + (cellW + gap) * 3, y, cellW, cellH, 'Avg Tx/Day', avgTxPerDay.toFixed(2), [78, 205, 196]);
            y += cellH + 8;
        }

        // Forecast box
        if (forecast) {
            doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(50, 50, 50);
            doc.text('Period-End Forecast', 14, y);
            doc.setFont('helvetica', 'normal');
            y += 5;
            doc.setFontSize(8); doc.setTextColor(80, 80, 80);
            doc.text(`Projected total: ${formatForPDF(forecast.projected, currency)} (extrapolated from current daily run-rate)`, 14, y);
            y += 4;
            if (forecast.vsBudget) {
                const sign = forecast.vsBudget.deltaPct >= 0 ? '+' : '';
                const overBudget = forecast.vsBudget.deltaPct > 0;
                doc.setTextColor(overBudget ? 255 : 16, overBudget ? 107 : 185, overBudget ? 107 : 129);
                doc.text(
                    `Budget ${formatForPDF(forecast.vsBudget.budget, currency)} · projected ${sign}${forecast.vsBudget.deltaPct.toFixed(1)}% ${overBudget ? 'over' : 'under'}`,
                    14, y,
                );
            }
            y += 8;
        }

        // Currency Mix (only if multi-currency)
        if (Object.keys(currencyTotals).length > 1) {
            doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(50, 50, 50);
            doc.text('Currency Mix', 14, y);
            doc.setFont('helvetica', 'normal');
            y += 4;
            const currencyRows = Object.entries(currencyTotals)
                .sort((a, b) => b[1].convertedTotal - a[1].convertedTotal)
                .map(([curr, d]) => [
                    curr,
                    String(d.count),
                    `${d.nativeTotal.toFixed(2)} ${curr}`,
                    formatForPDF(d.convertedTotal, currency),
                ]);
            autoTable(doc as any, {
                head: [['Currency', 'Tx', 'Native Total', `Converted (${currency})`]],
                body: currencyRows,
                startY: y,
                theme: 'striped',
                headStyles: { fillColor: [138, 43, 226], textColor: [255, 255, 255] },
                styles: { fontSize: 8 },
                columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
                tableWidth: 'auto',
                margin: { left: 14, right: pageWidth / 2 + 5 },
            });
            y = (doc as any).lastAutoTable.finalY + 8;
        }

        // Income by category
        if (Object.keys(incomeCategoryTotals).length > 0) {
            doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(50, 50, 50);
            doc.text('Income by Category', 14, y);
            doc.setFont('helvetica', 'normal');
            y += 4;
            const incomeRows = Object.entries(incomeCategoryTotals)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, amt]) => {
                    const pct = totalIncome > 0 ? ((amt / totalIncome) * 100).toFixed(1) : '0.0';
                    return [
                        cat.charAt(0).toUpperCase() + cat.slice(1),
                        formatForPDF(amt, currency),
                        `${pct}%`,
                    ];
                });
            autoTable(doc as any, {
                head: [['Category', 'Amount', '% of Income']],
                body: incomeRows,
                startY: y,
                theme: 'striped',
                headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255] },
                styles: { fontSize: 8 },
                columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
                tableWidth: 'auto',
                margin: { left: 14, right: pageWidth / 2 + 5 },
            });
            y = (doc as any).lastAutoTable.finalY + 8;
        }

        // Tags Breakdown — full-width below preceding sections so it can't
        // collide with the distribution insight row at the top.
        if (Object.keys(tagTotals).length > 0) {
            // If Y has crept too low, page-break before rendering.
            if (y > pageHeight - 40) {
                doc.addPage();
                y = 18;
            }
            doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(50, 50, 50);
            doc.text('Top Tags', 14, y);
            doc.setFont('helvetica', 'normal');
            y += 4;
            const tagRows = Object.entries(tagTotals)
                .sort((a, b) => b[1].total - a[1].total)
                .slice(0, 12)
                .map(([tag, d]) => {
                    const pct = totalExpenses > 0 ? ((d.total / totalExpenses) * 100).toFixed(1) : '0.0';
                    return [tag, String(d.count), formatForPDF(d.total, currency), `${pct}%`];
                });
            autoTable(doc as any, {
                head: [['Tag', 'Tx', 'Total', '%']],
                body: tagRows,
                startY: y,
                theme: 'striped',
                headStyles: { fillColor: [138, 43, 226], textColor: [255, 255, 255] },
                styles: { fontSize: 8 },
                columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
                tableWidth: 100,
                margin: { left: 14 },
            });
        }
    }

    // ── Recurring Templates (own page so it doesn't fight the transaction list) ──
    if (recurringTemplates.length > 0) {
        doc.addPage();
        doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(50, 50, 50);
        doc.text('Recurring Templates', 14, 18);
        doc.setFont('helvetica', 'normal');

        const sortedTemplates = [...recurringTemplates].sort((a, b) => a.next_occurrence.localeCompare(b.next_occurrence));
        const templateRows = sortedTemplates.map(t => [
            t.description.length > 24 ? t.description.substring(0, 22) + '..' : t.description,
            t.category.charAt(0).toUpperCase() + t.category.slice(1),
            t.frequency.charAt(0).toUpperCase() + t.frequency.slice(1),
            t.next_occurrence,
            formatForPDF(Number(t.amount), t.currency),
            t.is_active ? 'Active' : 'Paused',
        ]);

        autoTable(doc as any, {
            head: [['Description', 'Category', 'Frequency', 'Next Due', 'Amount', 'Status']],
            body: templateRows,
            startY: 24,
            theme: 'striped',
            headStyles: { fillColor: [138, 43, 226], textColor: [255, 255, 255] },
            styles: { fontSize: 8, cellPadding: 2 },
            columnStyles: { 4: { halign: 'right' } },
            margin: { top: 20 },
        });
    }

    // ── Transaction Details (always on a fresh page so it can paginate cleanly) ──
    doc.addPage();
    doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(50, 50, 50);
    doc.text('Transaction Details', 14, 18);
    doc.setFont('helvetica', 'normal');

    const hasNotes = transactions.some(tx => tx.notes);
    const hasTags = transactions.some(tx => Array.isArray(tx.tags) && tx.tags.length > 0);
    const tableColumns = ['Date', 'Description', 'Category', 'Bucket', 'Payment', 'Amount'];
    if (hasTags) tableColumns.push('Tags');
    if (hasNotes) tableColumns.push('Notes');

    const tableRows = sortedTx.map(tx => {
        const bucket = tx.bucket_id ? bucketMap[tx.bucket_id] : null;
        const rawAmount = resolveAmount(tx, currency, convertAmount);
        const isIncome = rawAmount < 0 || tx.category === 'income';
        const displayAmount = isIncome
            ? `+${formatForPDF(Math.abs(rawAmount), currency)}`
            : formatForPDF(rawAmount, currency);
        const row = [
            format(parseISO(tx.date.slice(0, 10)), 'MMM d, yy'),
            (tx.is_settlement ? '[S] ' : tx.is_recurring ? '[R] ' : '') + (tx.description.length > 22 ? tx.description.substring(0, 20) + '..' : tx.description),
            tx.is_settlement ? 'Settlement' : tx.category.charAt(0).toUpperCase() + tx.category.slice(1),
            bucket?.name || '-',
            tx.payment_method || '-',
            displayAmount,
        ];
        if (hasTags) {
            const t = Array.isArray(tx.tags) && tx.tags.length ? tx.tags.join(', ') : '';
            row.push(t.length > 18 ? t.substring(0, 16) + '..' : t);
        }
        if (hasNotes) row.push(tx.notes ? (tx.notes.length > 20 ? tx.notes.substring(0, 18) + '..' : tx.notes) : '');
        return row;
    });

    autoTable(doc as any, {
        head: [tableColumns],
        body: tableRows,
        startY: 24,
        theme: 'striped',
        headStyles: { fillColor: [138, 43, 226], textColor: [255, 255, 255] },
        styles: { fontSize: 7.5, cellPadding: 2 },
        columnStyles: { 5: { halign: 'right' } },
        margin: { top: 20 },
    });

    // ── Footnotes below transaction table ─────────────────────────────────────
    const footnotesY = (doc as any).lastAutoTable.finalY + 5;
    const hasMultiCurrency = transactions.some(tx => tx.currency && tx.currency !== currency);
    const footnotes: string[] = [
        '[R] = Recurring transaction · [S] = Settlement',
        'Income rows are shown with a + prefix',
    ];
    if (hasMultiCurrency) footnotes.push(`* Amounts converted to ${currency} using rates at time of import`);

    doc.setFontSize(7); doc.setTextColor(150, 150, 150);
    footnotes.forEach((note, i) => {
        doc.text(note, 14, footnotesY + i * 5);
    });

    // ── Page numbers ──────────────────────────────────────────────────────────
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFontSize(7.5); doc.setTextColor(180, 180, 180);
        doc.text(
            `Page ${p} of ${totalPages}  ·  Novira Financial Audit`,
            pageWidth / 2,
            doc.internal.pageSize.height - 6,
            { align: 'center' }
        );
    }

    doc.save(`novira_financial_audit_${format(new Date(), 'yyyyMMdd')}.pdf`);
};
