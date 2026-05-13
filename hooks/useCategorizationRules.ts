'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { CategorizationRule } from '@/lib/categorization-rules';

/**
 * Hydrates the user's categorization rules and keeps them in sync via realtime.
 * Multiple consumers (form, import view) call this hook independently — fine,
 * Supabase realtime channels dedupe per-table; we just pay one fetch each.
 */
export function useCategorizationRules(userId: string | null | undefined) {
    const [rules, setRules] = useState<CategorizationRule[]>([]);
    const [loading, setLoading] = useState<boolean>(!!userId);

    useEffect(() => {
        if (!userId) {
            setRules([]);
            setLoading(false);
            return;
        }
        let cancelled = false;

        const fetchRules = async () => {
            const { data, error } = await supabase
                .from('categorization_rules')
                .select('*')
                .eq('user_id', userId)
                .order('priority', { ascending: false })
                .order('created_at', { ascending: false });
            if (cancelled) return;
            if (error) {
                console.error('[useCategorizationRules] fetch failed', error);
                setRules([]);
            } else {
                setRules((data as CategorizationRule[]) ?? []);
            }
            setLoading(false);
        };

        setLoading(true);
        fetchRules();

        const channel = supabase
            .channel(`categorization-rules-${userId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'categorization_rules', filter: `user_id=eq.${userId}` },
                () => { fetchRules(); }
            )
            .subscribe();

        return () => {
            cancelled = true;
            supabase.removeChannel(channel);
        };
    }, [userId]);

    return { rules, loading };
}
