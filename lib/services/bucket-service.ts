import { supabase } from '@/lib/supabase';
import { Bucket } from '@/components/providers/buckets-provider';

export const BucketService = {
    async getBuckets() {
        const { data, error } = await supabase
            .from('buckets')
            .select('id, user_id, name, type, icon, color, budget, currency, is_archived, start_date, end_date, created_at')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data as Bucket[];
    },

    async getBucketSpending() {
        const { data, error } = await supabase
            .from('transactions')
            .select('amount, currency, bucket_id, exchange_rate, base_currency')
            .not('bucket_id', 'is', null);

        if (error) throw error;
        return data;
    },

    async createBucket(data: Partial<Bucket>, userId: string) {
        const { data: bucket, error } = await supabase
            .from('buckets')
            .insert({
                ...data,
                user_id: userId
            })
            .select()
            .single();

        if (error) throw error;
        return bucket;
    },

    async updateBucket(id: string, data: Partial<Bucket>) {
        const { error } = await supabase
            .from('buckets')
            .update(data)
            .eq('id', id);

        if (error) throw error;
    },

    async deleteBucket(id: string) {
        const { error } = await supabase
            .from('buckets')
            .delete()
            .eq('id', id);

        if (error) throw error;
    }
};
