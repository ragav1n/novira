'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useUserPreferences } from './user-preferences-provider';
import { toast } from '@/utils/haptics';

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
}

interface BucketsContextType {
    buckets: Bucket[];
    loading: boolean;
    createBucket: (data: Partial<Bucket>) => Promise<string | null>;
    updateBucket: (id: string, data: Partial<Bucket>) => Promise<void>;
    deleteBucket: (id: string) => Promise<void>;
    archiveBucket: (id: string, archive: boolean) => Promise<void>;
    refreshBuckets: () => Promise<void>;
    bucketSpending: Record<string, number>;
}

const BucketsContext = createContext<BucketsContextType | undefined>(undefined);

export function BucketsProvider({ children }: { children: React.ReactNode }) {
    const { userId, currency, convertAmount } = useUserPreferences();
    const [buckets, setBuckets] = useState<Bucket[]>([]);
    const [bucketSpending, setBucketSpending] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);

    const fetchBuckets = useCallback(async () => {
        if (!userId) return;
        try {
            // Fire both queries in parallel
            const [bucketsResult, spendingResult] = await Promise.all([
                supabase
                    .from('buckets')
                    .select('*')
                    .order('created_at', { ascending: false }),
                supabase
                    .from('transactions')
                    .select('amount, currency, bucket_id, exchange_rate, base_currency')
                    .not('bucket_id', 'is', null)
            ]);

            if (bucketsResult.error) throw bucketsResult.error;
            const fetchedBuckets = bucketsResult.data || [];
            setBuckets(fetchedBuckets);

            // Process spending with the fetched buckets
            if (!spendingResult.error && spendingResult.data) {
                const spending: Record<string, number> = {};
                spendingResult.data.forEach(tx => {
                    const bId = tx.bucket_id;
                    if (!bId) return;

                    const bucketConfig = fetchedBuckets.find(b => b.id === bId);
                    const bucketCurrency = (bucketConfig?.currency || currency).toUpperCase();

                    let amountInBucketCurrency = 0;
                    if (tx.currency === bucketCurrency) {
                        amountInBucketCurrency = Number(tx.amount);
                    } else if (tx.exchange_rate && tx.base_currency === bucketCurrency) {
                        amountInBucketCurrency = Number(tx.amount) * Number(tx.exchange_rate);
                    } else {
                        amountInBucketCurrency = convertAmount(Number(tx.amount), tx.currency || 'USD', bucketCurrency);
                    }

                    spending[bId] = (spending[bId] || 0) + amountInBucketCurrency;
                });
                setBucketSpending(spending);
            }
        } catch (error) {
            console.error('Error fetching buckets:', error);
        } finally {
            setLoading(false);
        }
    }, [userId, currency, convertAmount]);

    // Debounced refresh to batch rapid realtime events
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const debouncedFetchBuckets = useCallback(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => fetchBuckets(), 300);
    }, [fetchBuckets]);

    // Clean up debounce timer on unmount
    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, []);

    useEffect(() => {
        if (userId) {
            fetchBuckets();

            // Realtime subscription with debounce
            const channel = supabase
                .channel('buckets-changes')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'buckets',
                    filter: `user_id=eq.${userId}`
                }, () => {
                    debouncedFetchBuckets();
                })
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        } else {
            setBuckets([]);
            setLoading(false);
        }
    }, [userId, fetchBuckets, debouncedFetchBuckets]);

    const createBucket = async (data: Partial<Bucket>) => {
        if (!userId) {
            toast.error('Not authenticated');
            return null;
        }

        try {
            const { data: bucket, error } = await supabase
                .from('buckets')
                .insert({
                    ...data,
                    user_id: userId
                })
                .select()
                .single();

            if (error) throw error;
            toast.success('Bucket created successfully');
            await fetchBuckets();
            return bucket.id;
        } catch (error: any) {
            toast.error(error.message || 'Failed to create bucket');
            return null;
        }
    };

    const updateBucket = async (id: string, data: Partial<Bucket>) => {
        try {
            const { error } = await supabase
                .from('buckets')
                .update(data)
                .eq('id', id);

            if (error) throw error;
            toast.success('Bucket updated');
            await fetchBuckets();
        } catch (error: any) {
            toast.error(error.message || 'Failed to update bucket');
        }
    };

    const deleteBucket = async (id: string) => {
        try {
            const { error } = await supabase
                .from('buckets')
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast.success('Bucket deleted');
            await fetchBuckets();
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete bucket');
        }
    };

    const archiveBucket = async (id: string, archive: boolean) => {
        await updateBucket(id, { is_archived: archive });
    };

    const contextValue = useMemo(() => ({
        buckets,
        loading,
        createBucket,
        updateBucket,
        deleteBucket,
        refreshBuckets: fetchBuckets,
        archiveBucket,
        bucketSpending
    }), [buckets, loading, createBucket, updateBucket, deleteBucket, fetchBuckets, archiveBucket, bucketSpending]);

    return (
        <BucketsContext.Provider value={contextValue}>
            {children}
        </BucketsContext.Provider>
    );
}

export function useBuckets() {
    const context = useContext(BucketsContext);
    if (context === undefined) {
        throw new Error('useBuckets must be used within a BucketsProvider');
    }
    return context;
}
