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
    tags?: string[];
    notes?: string;
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
    /**
     * Client-only flags for offline-queued transactions (not from the server).
     * Set when an ADD_FULL_TRANSACTION mutation is queued but not yet synced.
     */
    _pending?: boolean;
    _failed?: boolean;
    _syncError?: string;
};

export type TransactionRecord = {
    user_id: string;
    amount: number;
    description: string;
    category: string;
    date: string;
    payment_method: string;
    notes: string;
    currency: string;
    group_id: string | null;
    bucket_id: string | null;
    exchange_rate: number;
    base_currency: string;
    converted_amount: number;
    is_recurring: boolean;
    exclude_from_allowance: boolean;
    idempotency_key?: string;
    place_name?: string;
    place_address?: string | null;
    place_lat?: number | null;
    place_lng?: number | null;
    tags?: string[];
};

export type SplitRecord = {
    user_id: string;
    amount: number;
    idempotency_key?: string;
};

export type RecurringRecord = {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    next_due_date?: string;
    next_occurrence?: string;
    is_active?: boolean;
    user_id?: string;
    description?: string;
    amount?: number;
    category?: string;
    currency?: string;
    group_id?: string | null;
    payment_method?: string;
    intended_day?: number;
    exclude_from_allowance?: boolean;
    metadata?: Record<string, unknown>;
};

export type RecurringTemplate = {
    id: string;
    description: string;
    amount: number;
    currency: string;
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    next_occurrence: string;
    last_processed: string | null;
    category: string;
    is_active: boolean;
    created_at: string;
    user_id?: string;
    group_id?: string | null;
    payment_method?: string | null;
};

export type AuditLog = {
    id: string;
    action: 'INSERT' | 'UPDATE' | 'DELETE';
    old_data: Record<string, unknown> | null;
    new_data: Record<string, unknown> | null;
    created_at: string;
    changed_by_profile?: {
        full_name: string;
    };
};

