import type { Transaction, RecurringTemplate } from '@/types/transaction';

export interface RecurringCandidate {
    normalizedKey: string;
    description: string;
    category: string;
    payment_method: string | null;
    currency: string;
    meanAmount: number;
    occurrences: number;
    totalSpend: number;
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    nextEstimatedDate: string;
    sampleTransactionIds: string[];
}

const FREQ_DAYS = {
    daily: 1,
    weekly: 7,
    monthly: 30,
    yearly: 365,
} as const;

function normalize(desc: string): string {
    return desc
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/\s*#?\d{2,}\s*$/g, '')
        .replace(/[*]+\d+/g, '')
        .trim();
}

function classifyInterval(meanDays: number, stdDays: number): RecurringCandidate['frequency'] | null {
    if (stdDays > 5) return null;
    if (meanDays < 2) return 'daily';
    if (meanDays >= 5 && meanDays <= 9) return 'weekly';
    if (meanDays >= 26 && meanDays <= 35) return 'monthly';
    if (meanDays >= 360 && meanDays <= 370) return 'yearly';
    return null;
}

function stddev(values: number[], mean: number): number {
    if (values.length === 0) return 0;
    const sumSq = values.reduce((acc, v) => acc + (v - mean) ** 2, 0);
    return Math.sqrt(sumSq / values.length);
}

export function detectRecurringCandidates(
    transactions: Transaction[],
    existingTemplates: RecurringTemplate[],
    options?: { dismissedKeys?: Set<string>; maxResults?: number },
): RecurringCandidate[] {
    const dismissed = options?.dismissedKeys ?? new Set<string>();
    const maxResults = options?.maxResults ?? 5;

    const existingKeys = new Set(
        existingTemplates
            .filter((t) => t.is_active)
            .map((t) => normalize(t.description)),
    );

    const groups = new Map<string, Transaction[]>();
    for (const tx of transactions) {
        if (tx.is_recurring) continue;
        if (tx.is_settlement) continue;
        if (tx.is_income) continue;
        if (!tx.description) continue;
        const key = normalize(tx.description);
        if (!key || key.length < 2) continue;
        if (existingKeys.has(key)) continue;
        if (dismissed.has(key)) continue;
        const arr = groups.get(key) ?? [];
        arr.push(tx);
        groups.set(key, arr);
    }

    const candidates: RecurringCandidate[] = [];

    for (const [key, txs] of groups) {
        if (txs.length < 3) continue;

        const sorted = [...txs].sort((a, b) => a.date.localeCompare(b.date));
        const amounts = sorted.map((t) => Math.abs(Number(t.amount) || 0));
        const meanAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        if (meanAmount === 0) continue;
        const amountStd = stddev(amounts, meanAmount);
        if (amountStd / meanAmount > 0.05) continue;

        const intervals: number[] = [];
        for (let i = 1; i < sorted.length; i++) {
            const a = new Date(sorted[i - 1].date.slice(0, 10)).getTime();
            const b = new Date(sorted[i].date.slice(0, 10)).getTime();
            const days = (b - a) / 86_400_000;
            if (days > 0) intervals.push(days);
        }
        if (intervals.length === 0) continue;
        const meanDays = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const stdDays = stddev(intervals, meanDays);
        const frequency = classifyInterval(meanDays, stdDays);
        if (!frequency) continue;

        const lastDate = sorted[sorted.length - 1].date.slice(0, 10);
        const nextEstimated = new Date(lastDate);
        nextEstimated.setUTCDate(nextEstimated.getUTCDate() + FREQ_DAYS[frequency]);
        const nextEstimatedDate = nextEstimated.toISOString().slice(0, 10);

        const last = sorted[sorted.length - 1];
        candidates.push({
            normalizedKey: key,
            description: last.description,
            category: last.category,
            payment_method: last.payment_method ?? null,
            currency: last.currency ?? 'USD',
            meanAmount,
            occurrences: sorted.length,
            totalSpend: amounts.reduce((a, b) => a + b, 0),
            frequency,
            nextEstimatedDate,
            sampleTransactionIds: sorted.slice(-3).map((t) => t.id),
        });
    }

    candidates.sort((a, b) => b.totalSpend - a.totalSpend);
    return candidates.slice(0, maxResults);
}

const DISMISS_KEY = 'novira_dismissed_recurring_candidates';

export function loadDismissedKeys(): Set<string> {
    if (typeof window === 'undefined') return new Set();
    try {
        const raw = localStorage.getItem(DISMISS_KEY);
        if (!raw) return new Set();
        const arr = JSON.parse(raw);
        return new Set(Array.isArray(arr) ? arr : []);
    } catch {
        return new Set();
    }
}

export function dismissCandidate(key: string): void {
    if (typeof window === 'undefined') return;
    try {
        const set = loadDismissedKeys();
        set.add(key);
        localStorage.setItem(DISMISS_KEY, JSON.stringify([...set]));
    } catch {
        // noop
    }
}
