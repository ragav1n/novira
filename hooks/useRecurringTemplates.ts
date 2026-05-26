'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/utils/haptics';
import type { RecurringTemplate } from '@/types/transaction';
import { useTransactionInvalidationListener } from '@/hooks/useTransactionInvalidationListener';

export function useRecurringTemplates(userId: string | null | undefined) {
    const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
    const [loading, setLoading] = useState<boolean>(!!userId);

    const load = useCallback(async (opts: { silent?: boolean } = {}) => {
        if (!userId) {
            setLoading(false);
            return;
        }
        if (!opts.silent) setLoading(true);
        try {
            const { data, error } = await supabase
                .from('recurring_templates')
                .select('id, description, amount, currency, frequency, created_at, next_occurrence, category, is_active, is_income, payment_method, metadata, group_id, user_id')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) {
                // Some columns may not exist yet — retry with minimal columns.
                const { data: fallbackData, error: fallbackError } = await supabase
                    .from('recurring_templates')
                    .select('id, description, amount, currency, frequency, created_at, category, is_active')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false });
                if (fallbackError) throw fallbackError;
                setTemplates(
                    ((fallbackData || []) as RecurringTemplate[])
                        .map((t) => ({ ...t, next_occurrence: t.next_occurrence ?? '' }))
                        .filter((t) => t.is_active)
                );
                return;
            }
            setTemplates((data || []).filter((t) => t.is_active));
        } catch (error) {
            console.warn('Error loading recurring templates:', error);
        } finally {
            if (!opts.silent) setLoading(false);
        }
    }, [userId]);

    const loadRef = useRef(load);
    loadRef.current = load;

    useEffect(() => {
        load();
    }, [load]);

    useTransactionInvalidationListener(() => loadRef.current({ silent: true }));

    useEffect(() => {
        if (!userId) return;
        const channel = supabase
            .channel(`recurring-templates-${userId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'recurring_templates', filter: `user_id=eq.${userId}` },
                (payload) => {
                    const row = payload.new as RecurringTemplate;
                    if (!row?.is_active) return;
                    setTemplates((prev) => prev.some((t) => t.id === row.id) ? prev : [row, ...prev]);
                })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'recurring_templates', filter: `user_id=eq.${userId}` },
                (payload) => {
                    const row = payload.new as RecurringTemplate;
                    setTemplates((prev) => {
                        if (!row.is_active) return prev.filter((t) => t.id !== row.id);
                        const exists = prev.some((t) => t.id === row.id);
                        return exists ? prev.map((t) => t.id === row.id ? { ...t, ...row } : t) : [row, ...prev];
                    });
                })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'recurring_templates', filter: `user_id=eq.${userId}` },
                (payload) => {
                    const oldRow = payload.old as Partial<RecurringTemplate>;
                    if (!oldRow?.id) return;
                    setTemplates((prev) => prev.filter((t) => t.id !== oldRow.id));
                })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [userId]);

    const deleteTemplate = useCallback(async (templateId: string) => {
        try {
            const { error } = await supabase
                .from('recurring_templates')
                .update({ is_active: false })
                .eq('id', templateId);
            if (error) throw error;
            setTemplates((prev) => prev.filter((t) => t.id !== templateId));
            toast.success('Recurring expense stopped');
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            toast.error('Failed to stop recurring expense: ' + msg);
        }
    }, []);

    return { templates, loading, deleteTemplate };
}
