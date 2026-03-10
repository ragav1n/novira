/**
 * Shared Transaction type used across dashboard, analytics, search, and map views.
 * This is the canonical definition — import from here instead of redefining locally.
 */
export type Transaction = {
    id: string;
    description: string;
    amount: number;
    category: string;
    date: string;
    created_at: string;
    user_id: string;
    currency?: string;
    exchange_rate?: number;
    base_currency?: string;
    converted_amount?: number;
    is_settlement?: boolean;
    is_recurring?: boolean;
    bucket_id?: string;
    exclude_from_allowance?: boolean;
    payment_method?: string;
    place_name?: string;
    place_address?: string;
    place_lat?: number;
    place_lng?: number;
    splits?: {
        user_id: string;
        amount: number;
        is_paid?: boolean;
    }[];
    profile?: {
        full_name: string;
        avatar_url?: string;
    };
    group_id?: string | null;
};

export type AuditLog = {
    id: string;
    action: 'INSERT' | 'UPDATE' | 'DELETE';
    old_data: any;
    new_data: any;
    created_at: string;
    changed_by_profile?: {
        full_name: string;
    };
};

