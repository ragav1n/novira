'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useUserPreferences } from './user-preferences-provider';
import { toast } from '@/utils/haptics';
import { BucketService } from '@/lib/services/bucket-service';

export interface Bucket {
    id: string;
    user_id: string;
    name: string;
    budget: number;
    type: 'trip' | 'event' | 'project' | 'other';
    icon: string;
    color: string;
    is_archived: boolean;
    created_at: string;
    start_date?: string;
    end_date?: string;
    currency?: string;
    group_id?: string | null;
}

interface BucketsListContextType {
    buckets: Bucket[];
    loading: boolean;
    createBucket: (data: Partial<Bucket>) => Promise<string | null>;
    updateBucket: (id: string, data: Partial<Bucket>) => Promise<void>;
    deleteBucket: (id: string) => Promise<void>;
    archiveBucket: (id: string, archive: boolean) => Promise<void>;
    refreshBuckets: () => Promise<void>;
}

interface BucketSpendingContextType {
    bucketSpending: Record<string, number>;
}

const BucketsListContext = createContext<BucketsListContextType | undefined>(undefined);
const BucketSpendingContext = createContext<BucketSpendingContextType | undefined>(undefined);

interface BucketSplit {
    user_id: string;
    amount: number | string;
}

interface SpendingTx {
    bucket_id: string | null;
    user_id: string;
    amount: number | string;
    currency: string | null;
    exchange_rate: number | null;
    base_currency: string | null;
    splits?: BucketSplit[];
}

function computeBucketSpending(
    spendingData: SpendingTx[],
    buckets: Bucket[],
    userId: string,
    currency: string,
    convertAmount: (amount: number, from: string, to?: string) => number
): Record<string, number> {
    const bucketMap = new Map(buckets.map(b => [b.id, b]));
    const rateCache = new Map<string, number>();
    const getRate = (from: string, to: string): number => {
        if (from === to) return 1;
        const key = `${from}->${to}`;
        const cached = rateCache.get(key);
        if (cached !== undefined) return cached;
        const rate = convertAmount(1, from, to);
        rateCache.set(key, rate);
        return rate;
    };
    const spending: Record<string, number> = {};
    spendingData.forEach(tx => {
        const bId = tx.bucket_id;
        if (!bId) return;
        const bucketConfig = bucketMap.get(bId);
        const bucketCurrency = (bucketConfig?.currency || currency).toUpperCase();
        let shareAmount = Number(tx.amount);
        if (tx.splits && tx.splits.length > 0) {
            if (tx.user_id === userId) {
                const othersOwe = tx.splits.reduce((sum: number, s: BucketSplit) => sum + Number(s.amount || 0), 0);
                shareAmount = Number(tx.amount) - othersOwe;
            } else {
                const mySplit = tx.splits.find((s: BucketSplit) => s.user_id === userId);
                shareAmount = mySplit ? Number(mySplit.amount || 0) : 0;
            }
        } else if (tx.user_id !== userId) {
            shareAmount = 0;
        }
        if (shareAmount <= 0) return;
        const txCurrency = (tx.currency || 'USD').toUpperCase();
        let amountInBucketCurrency: number;
        if (txCurrency === bucketCurrency) {
            amountInBucketCurrency = shareAmount;
        } else if (tx.exchange_rate && (tx.base_currency || '').toUpperCase() === bucketCurrency) {
            amountInBucketCurrency = shareAmount * Number(tx.exchange_rate);
        } else {
            amountInBucketCurrency = shareAmount * getRate(txCurrency, bucketCurrency);
        }
        spending[bId] = (spending[bId] || 0) + amountInBucketCurrency;
    });
    return spending;
}

export function BucketsProvider({ children }: { children: React.ReactNode }) {
    const { userId, currency, convertAmount, activeWorkspaceId } = useUserPreferences();
    const [buckets, setBuckets] = useState<Bucket[]>([]);
    const [bucketSpending, setBucketSpending] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);

    const fetchBuckets = useCallback(async () => {
        if (!userId) return;
        try {
            const [fetchedBuckets, spendingData] = await Promise.all([
                BucketService.getBuckets(userId, activeWorkspaceId),
                BucketService.getBucketSpending(userId, activeWorkspaceId)
            ]);

            setBuckets(fetchedBuckets);

            if (spendingData) {
                setBucketSpending(computeBucketSpending(spendingData, fetchedBuckets, userId, currency, convertAmount));
            }
        } catch (error) {
            console.error('Error fetching buckets:', error);
        } finally {
            setLoading(false);
        }
    }, [userId, activeWorkspaceId, currency, convertAmount]);

    const bucketsRef = useRef<Bucket[]>([]);
    bucketsRef.current = buckets;

    const fetchSpendingOnly = useCallback(async () => {
        if (!userId) return;
        try {
            const spendingData = await BucketService.getBucketSpending(userId, activeWorkspaceId);
            if (spendingData) {
                setBucketSpending(computeBucketSpending(spendingData, bucketsRef.current, userId, currency, convertAmount));
            }
        } catch (error) {
            console.error('Error refreshing bucket spending:', error);
        }
    }, [userId, activeWorkspaceId, currency, convertAmount]);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const spendingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const debouncedFetchBuckets = useCallback(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchBuckets(), 300);
    }, [fetchBuckets]);

    const debouncedFetchSpending = useCallback(() => {
        if (spendingDebounceRef.current) clearTimeout(spendingDebounceRef.current);
        spendingDebounceRef.current = setTimeout(() => fetchSpendingOnly(), 300);
    }, [fetchSpendingOnly]);

    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            if (spendingDebounceRef.current) clearTimeout(spendingDebounceRef.current);
        };
    }, []);

    useEffect(() => {
        if (userId) {
            fetchBuckets();

            const handleExpenseAdded = () => fetchSpendingOnly();
            window.addEventListener('novira:expense-added', handleExpenseAdded);

            const txFilter = activeWorkspaceId && activeWorkspaceId !== 'personal'
                ? `group_id=eq.${activeWorkspaceId}`
                : `user_id=eq.${userId}`;

            const channel = supabase
                .channel(`buckets-updates-${userId}-${activeWorkspaceId || 'personal'}`)
                .on('postgres_changes', {
                    event: '*', schema: 'public', table: 'buckets',
                    filter: `user_id=eq.${userId}`
                }, () => {
                    debouncedFetchBuckets();
                })
                .on('postgres_changes', {
                    event: '*', schema: 'public', table: 'transactions',
                    filter: txFilter
                }, () => {
                    debouncedFetchSpending();
                })
                .on('postgres_changes', {
                    event: '*', schema: 'public', table: 'splits',
                    filter: `user_id=eq.${userId}`
                }, () => {
                    debouncedFetchSpending();
                })
                .subscribe();

            return () => {
                window.removeEventListener('novira:expense-added', handleExpenseAdded);
                supabase.removeChannel(channel);
            };
        } else {
            setBuckets([]);
            setLoading(false);
        }
    }, [userId, activeWorkspaceId, fetchBuckets, fetchSpendingOnly, debouncedFetchBuckets, debouncedFetchSpending]);

    const createBucket = useCallback(async (data: Partial<Bucket>) => {
        if (!userId) {
            toast.error('Not authenticated');
            return null;
        }

        try {
            const bucket = await BucketService.createBucket({
                ...data,
                group_id: activeWorkspaceId && activeWorkspaceId !== 'personal' ? activeWorkspaceId : null
            }, userId);
            toast.success('Bucket created successfully');
            await fetchBuckets();
            return bucket.id;
        } catch (error: any) {
            toast.error(error.message || 'Failed to create bucket');
            return null;
        }
    }, [userId, activeWorkspaceId, fetchBuckets]);

    const updateBucket = useCallback(async (id: string, data: Partial<Bucket>) => {
        try {
            await BucketService.updateBucket(id, data);
            toast.success('Bucket updated');
            await fetchBuckets();
        } catch (error: any) {
            toast.error(error.message || 'Failed to update bucket');
        }
    }, [fetchBuckets]);

    const deleteBucket = useCallback(async (id: string) => {
        try {
            await BucketService.deleteBucket(id);
            toast.success('Bucket deleted');
            await fetchBuckets();
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete bucket');
        }
    }, [fetchBuckets]);

    const archiveBucket = useCallback(async (id: string, archive: boolean) => {
        await updateBucket(id, { is_archived: archive });
    }, [updateBucket]);

    // List context — changes only when buckets/loading/mutators change.
    // Spending updates do NOT invalidate this context value.
    const listValue = useMemo(() => ({
        buckets,
        loading,
        createBucket,
        updateBucket,
        deleteBucket,
        refreshBuckets: fetchBuckets,
        archiveBucket,
    }), [buckets, loading, createBucket, updateBucket, deleteBucket, fetchBuckets, archiveBucket]);

    const spendingValue = useMemo(() => ({ bucketSpending }), [bucketSpending]);

    return (
        <BucketsListContext.Provider value={listValue}>
            <BucketSpendingContext.Provider value={spendingValue}>
                {children}
            </BucketSpendingContext.Provider>
        </BucketsListContext.Provider>
    );
}

export function useBucketsList() {
    const context = useContext(BucketsListContext);
    if (context === undefined) {
        throw new Error('useBucketsList must be used within a BucketsProvider');
    }
    return context;
}

export function useBucketSpending() {
    const context = useContext(BucketSpendingContext);
    if (context === undefined) {
        throw new Error('useBucketSpending must be used within a BucketsProvider');
    }
    return context;
}

// Backwards-compat shim — combines both contexts. Consumers that only need the
// list (or only the spending map) should migrate to the narrower hooks to avoid
// re-rendering when the unrelated half changes.
export function useBuckets() {
    return { ...useBucketsList(), ...useBucketSpending() };
}
