import type { RecurringTemplate, SubscriptionMetadata } from '@/types/transaction';

export type Tpl = RecurringTemplate;
export type Frequency = Tpl['frequency'];
export type SortBy = 'next' | 'amount' | 'name' | 'category';
export type BucketState = 'all' | 'with' | 'without';

export const INACTIVE_PAGE_SIZE = 5;
export const ALL_FREQUENCIES: Frequency[] = ['daily', 'weekly', 'monthly', 'yearly'];

export const SORT_LABELS: Record<SortBy, string> = {
    next: 'Next due',
    amount: 'Amount (high → low)',
    name: 'Name (A → Z)',
    category: 'Category',
};

export function freqToMonthly(amount: number, freq: Frequency): number {
    if (freq === 'yearly') return amount / 12;
    if (freq === 'weekly') return amount * 4.33;
    if (freq === 'daily') return amount * 30;
    return amount;
}

export function getMeta(t: Tpl): SubscriptionMetadata {
    return (t.metadata && typeof t.metadata === 'object' ? t.metadata : {}) as SubscriptionMetadata;
}

export type PriceChange = { lastAmount: number; lastDate: string; pctChange: number; templateAmount: number };
export type LastCharge = { lastAmount: number; lastDate: string; pctChange: number };
