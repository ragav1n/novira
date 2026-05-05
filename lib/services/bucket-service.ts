import { supabase } from '@/lib/supabase';
import { Bucket } from '@/components/providers/buckets-provider';

export interface BucketSpendingRow {
    bucket_id: string;
    category: string;
    currency: string;
    base_currency: string;
    exchange_rate: number;
    share_amount: number;
}

export const BucketService = {
    async getBuckets(userId?: string, workspaceId?: string | null) {
        let query = supabase
            .from('buckets')
            .select('id, user_id, name, type, icon, color, budget, currency, is_archived, start_date, end_date, created_at, allowed_categories, completed_at, completion_notified, group_id')
            .order('created_at', { ascending: false });

        if (workspaceId && workspaceId !== 'personal') {
            query = query.eq('group_id', workspaceId);
        } else if (workspaceId === 'personal' && userId) {
            query = query.eq('user_id', userId).is('group_id', null);
        } else if (userId) {
            query = query.eq('user_id', userId);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data as Bucket[];
    },

    async getBucketSpending(userId?: string, workspaceId?: string | null) {
        if (!userId) return [];
        const { data, error } = await supabase.rpc('compute_user_bucket_spending', {
            p_user_id: userId,
            p_workspace_id: workspaceId ?? null,
        });
        if (error) throw error;
        return data as BucketSpendingRow[];
    },

    /**
     * Fetches every transaction belonging to a bucket plus the contributor profiles,
     * so the detail view can render per-category, per-currency, and per-member breakdowns
     * without further round-trips.
     */
    async getBucketTransactions(bucketId: string) {
        const { data, error } = await supabase
            .from('transactions')
            .select('id, description, amount, category, date, created_at, user_id, currency, exchange_rate, base_currency, bucket_id, group_id, place_name, place_address, place_lat, place_lng, tags, notes, profile:profiles(full_name, avatar_url), splits(user_id, amount, is_paid, profile:profiles(full_name, avatar_url))')
            .eq('bucket_id', bucketId)
            .order('date', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    async createBucket(data: Partial<Bucket> & { group_id?: string | null }, userId: string) {
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
