'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useUserPreferences } from './user-preferences-provider';
import { toast } from 'sonner';

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

    const fetchBucketSpending = useCallback(async () => {
        if (!userId) return;
        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('amount, currency, bucket_id, exchange_rate, base_currency')
                .not('bucket_id', 'is', null);

            if (error) throw error;

            const spending: Record<string, number> = {};
            data?.forEach(tx => {
                const bId = tx.bucket_id;
                if (!bId) return;

                let amountInUserCurrency = 0;
                if (tx.exchange_rate && tx.base_currency === currency) {
                    amountInUserCurrency = Number(tx.amount) * Number(tx.exchange_rate);
                } else {
                    amountInUserCurrency = convertAmount(Number(tx.amount), tx.currency || 'USD');
                }

                spending[bId] = (spending[bId] || 0) + amountInUserCurrency;
            });
            setBucketSpending(spending);
        } catch (error) {
            console.error('Error fetching bucket spending:', error);
        }
    }, [userId, currency, convertAmount]);

    const fetchBuckets = useCallback(async () => {
        if (!userId) return;
        try {
            const { data, error } = await supabase
                .from('buckets')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setBuckets(data || []);
            await fetchBucketSpending();
        } catch (error) {
            console.error('Error fetching buckets:', error);
        } finally {
            setLoading(false);
        }
    }, [userId, fetchBucketSpending]);

    useEffect(() => {
        if (userId) {
            fetchBuckets();

            // Realtime subscription
            const channel = supabase
                .channel('buckets-changes')
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'buckets',
                    filter: `user_id=eq.${userId}`
                }, () => {
                    fetchBuckets();
                })
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        } else {
            setBuckets([]);
            setLoading(false);
        }
    }, [userId, fetchBuckets]);

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

    return (
        <BucketsContext.Provider value={{
            buckets,
            loading,
            createBucket,
            updateBucket,
            deleteBucket,
            refreshBuckets: fetchBuckets,
            archiveBucket,
            bucketSpending
        }}>
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
