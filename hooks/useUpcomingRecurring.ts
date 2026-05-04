import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
type UpcomingRow = {
    id: string;
    description: string;
    amount: number;
    currency: string;
    category: string;
    next_occurrence: string;
};

const HORIZON_DAYS = 7;

export type UpcomingCharge = {
    id: string;
    description: string;
    amount: number;
    currency: string;
    category: string;
    nextOccurrence: string;
    daysUntil: number;
};

export function useUpcomingRecurring(
    userId: string | null,
    activeWorkspaceId: string | null
) {
    const [items, setItems] = useState<UpcomingCharge[]>([]);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        if (!userId) {
            setItems([]);
            return;
        }
        setLoading(true);
        try {
            const today = new Date();
            const todayStr = format(today, 'yyyy-MM-dd');
            const horizon = new Date(today);
            horizon.setDate(today.getDate() + HORIZON_DAYS);
            const horizonStr = format(horizon, 'yyyy-MM-dd');

            let query = supabase
                .from('recurring_templates')
                .select('id, description, amount, currency, category, next_occurrence, is_active, group_id, user_id')
                .eq('is_active', true)
                .gte('next_occurrence', todayStr)
                .lte('next_occurrence', horizonStr)
                .order('next_occurrence', { ascending: true })
                .limit(20);

            if (activeWorkspaceId && activeWorkspaceId !== 'personal') {
                query = query.eq('group_id', activeWorkspaceId);
            } else if (activeWorkspaceId === 'personal') {
                query = query.is('group_id', null).eq('user_id', userId);
            } else {
                query = query.eq('user_id', userId);
            }

            const { data, error } = await query;
            if (error) throw error;

            const mapped: UpcomingCharge[] = ((data ?? []) as UpcomingRow[]).map(t => ({
                id: t.id,
                description: t.description,
                amount: Number(t.amount),
                currency: t.currency,
                category: t.category,
                nextOccurrence: t.next_occurrence,
                daysUntil: Math.max(0, differenceInCalendarDays(parseISO(t.next_occurrence), today)),
            }));
            setItems(mapped);
        } catch (e) {
            if (process.env.NODE_ENV === 'development') {
                console.error('[useUpcomingRecurring] load failed:', e);
            }
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [userId, activeWorkspaceId]);

    useEffect(() => {
        load();
    }, [load]);

    return { items, loading, reload: load };
}
