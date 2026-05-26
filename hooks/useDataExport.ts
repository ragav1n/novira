'use client';

import { useCallback, useState } from 'react';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { supabase } from '@/lib/supabase';
import { toast } from '@/utils/haptics';
import { generateCSV, generatePDF } from '@/utils/export-utils';
import { buildIcs, downloadIcs } from '@/lib/ics-export';
import type { RecurringTemplate } from '@/types/transaction';
import type { SavingsGoal } from '@/types/goal';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { useBucketsList } from '@/components/providers/buckets-provider';
import { useGroups } from '@/components/providers/groups-provider';

type ExportType = 'csv' | 'pdf' | null;

export function useDataExport() {
    const { userId, user, currency, convertAmount, formatCurrency, monthlyBudget, avatarUrl, activeWorkspaceId } = useUserPreferences();
    const { buckets } = useBucketsList();
    const { groups } = useGroups();

    const [loadingExport, setLoadingExport] = useState(false);
    const [loadingIcs, setLoadingIcs] = useState(false);
    const [exportModalOpen, setExportModalOpen] = useState(false);
    const [exportType, setExportType] = useState<ExportType>(null);

    const handleExportClick = useCallback((type: 'csv' | 'pdf') => {
        setExportType(type);
        setExportModalOpen(true);
    }, []);

    const handleExportICS = useCallback(async () => {
        if (!userId) {
            toast.error('You must be signed in to export your calendar');
            return;
        }
        setLoadingIcs(true);
        try {
            const [templatesRes, goalsRes] = await Promise.all([
                supabase
                    .from('recurring_templates')
                    .select('id, description, amount, currency, frequency, next_occurrence, category, is_active, created_at, payment_method, group_id, metadata')
                    .eq('user_id', userId)
                    .eq('is_active', true),
                supabase
                    .from('savings_goals')
                    .select('id, user_id, name, target_amount, current_amount, currency, deadline, icon, color, group_id, created_at')
                    .eq('user_id', userId),
            ]);

            const templates = (templatesRes.data ?? []) as RecurringTemplate[];
            const goals = (goalsRes.data ?? []) as SavingsGoal[];

            const ics = buildIcs({
                recurringTemplates: templates,
                goals,
                buckets,
                formatAmount: (amount, cur) => formatCurrency(amount, cur),
            });

            const stamp = new Date().toISOString().slice(0, 10);
            downloadIcs(`novira-${stamp}.ics`, ics);
            toast.success('Calendar file ready — import it into your calendar app');
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            console.error('Error building .ics:', error);
            toast.error('Could not build calendar file: ' + msg);
        } finally {
            setLoadingIcs(false);
        }
    }, [userId, buckets, formatCurrency]);

    const handleExportConfirm = useCallback(async (dateRange: DateRange | null, bucketId: string | null, groupId: string | 'personal' | null) => {
        if (!userId) return;
        setLoadingExport(true);
        try {
            let query = supabase
                .from('transactions')
                .select('id, description, amount, category, date, payment_method, created_at, currency, bucket_id, group_id, notes, is_recurring, is_settlement, place_name, exclude_from_allowance, exchange_rate, base_currency, converted_amount, tags')
                .order('date', { ascending: false });

            if (dateRange?.from) query = query.gte('date', format(dateRange.from, 'yyyy-MM-dd'));
            if (dateRange?.to) query = query.lte('date', format(dateRange.to, 'yyyy-MM-dd'));
            if (bucketId) query = query.eq('bucket_id', bucketId);
            if (groupId === 'personal') {
                query = query.is('group_id', null);
            } else if (groupId) {
                query = query.eq('group_id', groupId);
            }

            const { data: transactions, error } = await query;
            if (error) throw error;

            if (!transactions || transactions.length === 0) {
                toast.error('No transactions found for the selected period');
                setExportModalOpen(false);
                return;
            }

            // Recurring templates scoped to the same workspace as the transactions —
            // exported as their own section so backups can recreate the schedule.
            let templatesQuery = supabase
                .from('recurring_templates')
                .select('id, description, category, amount, currency, frequency, next_occurrence, is_active, payment_method, group_id')
                .order('next_occurrence', { ascending: true });
            if (groupId === 'personal') {
                templatesQuery = templatesQuery.is('group_id', null).eq('user_id', userId);
            } else if (groupId) {
                templatesQuery = templatesQuery.eq('group_id', groupId);
            } else {
                templatesQuery = templatesQuery.eq('user_id', userId);
            }
            const { data: recurringTemplates } = await templatesQuery;

            const workspaceName = activeWorkspaceId
                ? groups.find((g) => g.id === activeWorkspaceId)?.name
                : 'Personal';

            if (exportType === 'csv') {
                generateCSV(transactions, currency, convertAmount, formatCurrency, buckets, groups, dateRange || undefined, {
                    email: user?.email,
                    workspaceName,
                    monthlyBudget,
                }, recurringTemplates ?? []);
                toast.success('CSV Exported successfully');
            } else {
                await generatePDF(transactions, currency, convertAmount, formatCurrency, buckets, groups, dateRange || undefined, {
                    email: user?.email,
                    avatarUrl,
                    workspaceName,
                    monthlyBudget,
                }, recurringTemplates ?? []);
                toast.success('PDF Exported successfully');
            }
            setExportModalOpen(false);
        } catch (error) {
            const e = error as { message?: string; details?: string; hint?: string; code?: string; stack?: string };
            console.error('Export failed details:', {
                message: e?.message,
                details: e?.details,
                hint: e?.hint,
                code: e?.code,
                stack: e?.stack,
                error,
            });
            toast.error('Failed to export data: ' + (e?.message || 'Unknown error'));
        } finally {
            setLoadingExport(false);
        }
    }, [userId, user, currency, convertAmount, formatCurrency, monthlyBudget, avatarUrl, activeWorkspaceId, buckets, groups, exportType]);

    return {
        loadingExport,
        loadingIcs,
        exportModalOpen,
        setExportModalOpen,
        exportType,
        handleExportClick,
        handleExportICS,
        handleExportConfirm,
    };
}
