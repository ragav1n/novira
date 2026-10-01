'use client';

import { useCallback, useState } from 'react';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { supabase } from '@/lib/supabase';
import { toast } from '@/utils/haptics';
import { generateCSV, generatePDF } from '@/utils/export-utils';
import { buildIcs, downloadIcs } from '@/lib/ics-export';
import type { RecurringTemplate } from '@/types/transaction';
import type { SavingsGoal, SavingsDeposit } from '@/types/goal';
import type { Bucket } from '@/types/bucket';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { useBucketsList } from '@/components/providers/buckets-provider';
import { useGroups } from '@/components/providers/groups-provider';
import { useAccounts } from '@/components/providers/accounts-provider';

type ExportType = 'csv' | 'pdf' | null;

export function useDataExport() {
    const { userId, user, currency, convertAmount, formatCurrency, monthlyBudget, avatarUrl } = useUserPreferences();
    const { buckets } = useBucketsList();
    const { groups } = useGroups();
    const { accounts } = useAccounts();

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
            // Include data from every workspace the user is in, not just the
            // active one — the calendar file should reflect their whole picture.
            const userGroupIds = groups.map((g) => g.id);
            const groupClause = userGroupIds.length
                ? `,group_id.in.(${userGroupIds.join(',')})`
                : '';

            const [templatesRes, goalsRes, bucketsRes] = await Promise.all([
                supabase
                    .from('recurring_templates')
                    .select('id, description, amount, currency, frequency, next_occurrence, category, is_active, is_income, created_at, payment_method, group_id, metadata, user_id')
                    .eq('is_active', true)
                    .or(`user_id.eq.${userId}${groupClause}`),
                supabase
                    .from('savings_goals')
                    .select('id, user_id, name, target_amount, current_amount, currency, deadline, icon, color, group_id, created_at')
                    .or(`user_id.eq.${userId}${groupClause}`),
                supabase
                    .from('buckets')
                    .select('id, user_id, name, budget, type, icon, color, is_archived, created_at, start_date, end_date, currency, group_id')
                    .eq('is_archived', false)
                    .or(`user_id.eq.${userId}${groupClause}`),
            ]);

            const templates = (templatesRes.data ?? []) as RecurringTemplate[];
            const goals = (goalsRes.data ?? []) as SavingsGoal[];
            const allBuckets = (bucketsRes.data ?? []) as Bucket[];

            const ics = buildIcs({
                recurringTemplates: templates,
                goals,
                buckets: allBuckets,
                formatAmount: (amount, cur) => formatCurrency(amount, cur),
            });

            const stamp = format(new Date(), 'yyyyMMdd_HHmm');
            downloadIcs(`novira-${stamp}.ics`, ics);
            toast.success('Calendar file ready — import it into your calendar app');
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            console.error('Error building .ics:', error);
            toast.error('Could not build calendar file: ' + msg);
        } finally {
            setLoadingIcs(false);
        }
    }, [userId, groups, formatCurrency]);

    const handleExportConfirm = useCallback(async (dateRange: DateRange | null, bucketId: string | null, groupId: string | 'personal' | null) => {
        if (!userId) return;
        setLoadingExport(true);
        try {
            // PostgREST caps a response at 1,000 rows, so a long range used to
            // export a silently truncated year. Page until a short page comes back.
            const buildTxQuery = () => {
                let query = supabase
                    .from('transactions')
                    .select('id, user_id, description, amount, category, date, payment_method, created_at, currency, bucket_id, group_id, notes, is_recurring, is_settlement, place_name, place_address, place_lat, place_lng, exclude_from_allowance, exchange_rate, base_currency, converted_amount, tags, receipt_path, account_id, is_transfer, transfer_pair_id, is_income, profile:profiles(full_name), splits(user_id, amount, is_paid, profile:profiles(full_name))')
                    .order('date', { ascending: false })
                    .order('id', { ascending: true });
                if (dateRange?.from) query = query.gte('date', format(dateRange.from, 'yyyy-MM-dd'));
                if (dateRange?.to) query = query.lte('date', format(dateRange.to, 'yyyy-MM-dd'));
                if (bucketId) query = query.eq('bucket_id', bucketId);
                if (groupId === 'personal') {
                    query = query.is('group_id', null);
                } else if (groupId) {
                    query = query.eq('group_id', groupId);
                }
                return query;
            };
            const fetchAllTransactions = async () => {
                const PAGE = 1000;
                const rows: NonNullable<Awaited<ReturnType<typeof buildTxQuery>>['data']> = [];
                for (let from = 0; ; from += PAGE) {
                    const { data, error } = await buildTxQuery().range(from, from + PAGE - 1);
                    if (error) return { data: null, error };
                    rows.push(...(data ?? []));
                    if (!data || data.length < PAGE) break;
                }
                return { data: rows, error: null };
            };

            // Recurring templates scoped to the same workspace as the transactions —
            // exported as their own section so backups can recreate the schedule.
            let templatesQuery = supabase
                .from('recurring_templates')
                .select('id, description, category, amount, currency, frequency, next_occurrence, is_active, is_income, payment_method, group_id, metadata')
                .order('next_occurrence', { ascending: true });
            if (groupId === 'personal') {
                templatesQuery = templatesQuery.is('group_id', null).eq('user_id', userId);
            } else if (groupId) {
                templatesQuery = templatesQuery.eq('group_id', groupId);
            } else {
                templatesQuery = templatesQuery.eq('user_id', userId);
            }

            // Goals: scoped the same way as templates (personal vs group).
            let goalsQuery = supabase
                .from('savings_goals')
                .select('id, user_id, name, target_amount, current_amount, currency, deadline, icon, color, group_id, created_at');
            if (groupId === 'personal') {
                goalsQuery = goalsQuery.is('group_id', null).eq('user_id', userId);
            } else if (groupId) {
                goalsQuery = goalsQuery.eq('group_id', groupId);
            } else {
                goalsQuery = goalsQuery.eq('user_id', userId);
            }

            const [txRes, templatesRes, goalsRes] = await Promise.all([
                fetchAllTransactions(),
                templatesQuery,
                goalsQuery,
            ]);

            if (txRes.error) throw txRes.error;
            const transactions = txRes.data;

            if (!transactions || transactions.length === 0) {
                // An empty range is a result, not an error. Closing the modal here threw
                // away the user's preset/scope/bucket picks and made them redo all of it
                // just to widen the date range.
                toast.warning('No transactions in that range — try a wider period');
                return;
            }

            const recurringTemplates = templatesRes.data ?? [];
            const goals = goalsRes.data ?? [];

            // Deposits — only worth fetching when we have goals to attach them to.
            let deposits: SavingsDeposit[] = [];
            if (goals.length > 0) {
                const goalIds = goals.map((g) => g.id);
                const { data: depositRows } = await supabase
                    .from('savings_deposits')
                    .select('id, goal_id, user_id, amount, currency, created_at')
                    .in('goal_id', goalIds)
                    .order('created_at', { ascending: false });
                deposits = (depositRows ?? []) as SavingsDeposit[];
            }

            // Name the scope the user picked in the modal, not whichever workspace
            // happens to be active behind it.
            const workspaceName = groupId === 'personal'
                ? 'Personal'
                : groupId
                    ? groups.find((g) => g.id === groupId)?.name
                    : 'All workspaces';

            const exportContext = {
                email: user?.email,
                avatarUrl,
                workspaceName,
                monthlyBudget,
                accounts,
                goals,
                deposits,
                recurringTemplates,
                isGroupScope: !!groupId && groupId !== 'personal',
            };

            if (exportType === 'csv') {
                generateCSV(transactions, currency, convertAmount, formatCurrency, buckets, groups, dateRange || undefined, exportContext);
                toast.success('CSV Exported successfully');
            } else {
                await generatePDF(transactions, currency, convertAmount, formatCurrency, buckets, groups, dateRange || undefined, exportContext);
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
    }, [userId, user, currency, convertAmount, formatCurrency, monthlyBudget, avatarUrl, buckets, groups, accounts, exportType]);

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
