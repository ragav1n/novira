'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useUserPreferences } from './user-preferences-provider';
import { useAccounts } from './accounts-provider';
import { toast } from '@/utils/haptics';
import { BucketService, type BucketSpendingRow } from '@/lib/services/bucket-service';
import { reportNetworkError } from '@/lib/network-error-bus';

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
    allowed_categories?: string[];
    completed_at?: string | null;
    completion_notified?: boolean;
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

function computeBucketSpending(
    rows: BucketSpendingRow[],
    buckets: Bucket[],
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
    rows.forEach(row => {
        const bucketConfig = bucketMap.get(row.bucket_id);
        const allowed = bucketConfig?.allowed_categories || [];
        if (allowed.length > 0 && !allowed.includes(row.category)) return;
        const share = Number(row.share_amount);
        if (!share || share <= 0) return;
        const bucketCurrency = (bucketConfig?.currency || currency).toUpperCase();
        const txCurrency = (row.currency || 'USD').toUpperCase();
        let amountInBucketCurrency: number;
        if (txCurrency === bucketCurrency) {
            amountInBucketCurrency = share;
        } else if (row.exchange_rate && row.base_currency?.toUpperCase() === bucketCurrency) {
            amountInBucketCurrency = share * Number(row.exchange_rate);
        } else {
            amountInBucketCurrency = share * getRate(txCurrency, bucketCurrency);
        }
        spending[row.bucket_id] = (spending[row.bucket_id] || 0) + amountInBucketCurrency;
    });
    return spending;
}

export function BucketsProvider({ children }: { children: React.ReactNode }) {
    const { userId, currency, convertAmount, activeWorkspaceId } = useUserPreferences();
    const { activeAccountId } = useAccounts();
    // Account filter is personal-only (a shared workspace's spending isn't
    // tied to one member's account).
    const effectiveAccountId = !activeWorkspaceId ? activeAccountId : null;
    const [buckets, setBuckets] = useState<Bucket[]>([]);
    const [bucketSpending, setBucketSpending] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);

    const fetchBucketsRef = useRef<() => Promise<void>>(async () => undefined);
    // Bumped on each workspace/user change so in-flight fetches from a previous
    // workspace can't land their results on top of the new one.
    const fetchGenRef = useRef(0);

    const fetchBuckets = useCallback(async () => {
        if (!userId) return;
        const myGen = fetchGenRef.current;
        try {
            const [fetchedBuckets, spendingData] = await Promise.all([
                BucketService.getBuckets(userId, activeWorkspaceId),
                BucketService.getBucketSpending(userId, activeWorkspaceId, effectiveAccountId)
            ]);

            if (fetchGenRef.current !== myGen) return;
            setBuckets(fetchedBuckets);

            if (spendingData) {
                setBucketSpending(computeBucketSpending(spendingData, fetchedBuckets, currency, convertAmount));
            }
        } catch (error) {
            console.error('Error fetching buckets:', error);
            reportNetworkError({
                message: "Couldn't load buckets",
                source: 'BucketsProvider.fetchBuckets',
                retry: () => { void fetchBucketsRef.current(); },
            });
        } finally {
            if (fetchGenRef.current === myGen) setLoading(false);
        }
    }, [userId, activeWorkspaceId, effectiveAccountId, currency, convertAmount]);

    fetchBucketsRef.current = fetchBuckets;

    const bucketsRef = useRef<Bucket[]>([]);
    bucketsRef.current = buckets;

    const fetchSpendingOnly = useCallback(async () => {
        if (!userId) return;
        const myGen = fetchGenRef.current;
        try {
            const spendingData = await BucketService.getBucketSpending(userId, activeWorkspaceId, effectiveAccountId);
            if (fetchGenRef.current !== myGen) return;
            if (spendingData) {
                setBucketSpending(computeBucketSpending(spendingData, bucketsRef.current, currency, convertAmount));
            }
        } catch (error) {
            console.error('Error refreshing bucket spending:', error);
        }
    }, [userId, activeWorkspaceId, effectiveAccountId, currency, convertAmount]);

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
            fetchGenRef.current++;
            fetchBuckets();

            const handleExpenseAdded = () => fetchSpendingOnly();
            window.addEventListener('novira:expense-added', handleExpenseAdded);

            const txFilter = activeWorkspaceId
                ? `group_id=eq.${activeWorkspaceId}`
                : `user_id=eq.${userId}`;
            // In a shared workspace, partner-created/edited buckets carry their
            // partner's user_id but our group's id — filter by group so realtime
            // catches them. Personal stays user-scoped.
            const bucketFilter = activeWorkspaceId
                ? `group_id=eq.${activeWorkspaceId}`
                : `user_id=eq.${userId}`;

            const channel = supabase
                .channel(`buckets-updates-${userId}-${activeWorkspaceId || 'personal'}`)
                .on('postgres_changes', {
                    event: '*', schema: 'public', table: 'buckets',
                    filter: bucketFilter
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
                group_id: activeWorkspaceId ?? null
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
