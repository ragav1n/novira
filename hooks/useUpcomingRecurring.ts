import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { applyWorkspaceFilter } from '@/lib/workspace-filter';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
type UpcomingRow = {
    id: string;
    description: string;
    amount: number;
    currency: string;
    category: string;
    next_occurrence: string;
    is_income?: boolean;
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
    // Bumped on each workspace/user change so in-flight fetches from a previous
    // workspace can't land their results on top of the new one.
    const fetchGenRef = useRef(0);

    const load = useCallback(async () => {
        if (!userId) {
            setItems([]);
            return;
        }
        const myGen = fetchGenRef.current;
        setLoading(true);
        try {
            const today = new Date();
            const todayStr = format(today, 'yyyy-MM-dd');
            const horizon = new Date(today);
            horizon.setDate(today.getDate() + HORIZON_DAYS);
            const horizonStr = format(horizon, 'yyyy-MM-dd');

            const baseQuery = supabase
                .from('recurring_templates')
                .select('id, description, amount, currency, category, next_occurrence, is_active, group_id, user_id')
                .eq('is_active', true)
                .gte('next_occurrence', todayStr)
                .lte('next_occurrence', horizonStr)
                .order('next_occurrence', { ascending: true })
                .limit(20);
            const query = applyWorkspaceFilter(baseQuery, userId, activeWorkspaceId);

            const { data, error } = await query;
            if (fetchGenRef.current !== myGen) return;
            if (error) throw error;

            const mapped: UpcomingCharge[] = ((data ?? []) as UpcomingRow[])
                .filter(t => !t.is_income)
                .map(t => ({
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
            if (fetchGenRef.current !== myGen) return;
            if (process.env.NODE_ENV === 'development') {
                console.error('[useUpcomingRecurring] load failed:', e);
            }
            setItems([]);
        } finally {
            if (fetchGenRef.current === myGen) setLoading(false);
        }
    }, [userId, activeWorkspaceId]);

    useEffect(() => {
        fetchGenRef.current++;
        load();
    }, [load]);

    return { items, loading, reload: load };
}
