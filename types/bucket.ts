/**
 * Strict type definition for Buckets.
 */
export type BucketType = 'trip' | 'event' | 'project' | 'other';

export interface Bucket {
    id: string;
    user_id: string;
    name: string;
    budget: number;
    type: BucketType;
    icon: string;
    color: string;
    is_archived: boolean;
    created_at: string;
    start_date?: string;
    end_date?: string;
    currency?: string;
}
