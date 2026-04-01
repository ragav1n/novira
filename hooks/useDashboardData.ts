import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/utils/haptics';
import type { Transaction, AuditLog } from '@/types/transaction';

const PAGE_SIZE = 100;

export function useDashboardData(userId: string | null, activeWorkspaceId: string | null = null) {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [loadLimit, setLoadLimit] = useState(PAGE_SIZE);

    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);

    const [selectedAuditTx, setSelectedAuditTx] = useState<Transaction | null>(null);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [loadingAudit, setLoadingAudit] = useState(false);

    const loadTxRef = useRef<((uid: string, workspaceId: string | null, bypassCache?: boolean, limit?: number) => Promise<void>) | null>(null);
    const loadLimitRef = useRef(PAGE_SIZE);
    const mutatingRef = useRef(false);

    const loadTransactions = async (currentUserId: string, workspaceId: string | null = null, bypassCache = false, limit = loadLimitRef.current) => {
        try {
            let query = supabase
                .from('transactions')
                .select('id, description, amount, category, date, created_at, user_id, group_id, currency, exchange_rate, base_currency, bucket_id, exclude_from_allowance, is_recurring, is_settlement, place_name, place_address, place_lat, place_lng, profile:profiles(full_name, avatar_url), splits(user_id, amount, is_paid)')
                .order('date', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(limit);

            if (workspaceId && workspaceId !== 'personal') {
                query = query.eq('group_id', workspaceId);
            } else if (workspaceId === 'personal') {
                query = query.is('group_id', null).eq('user_id', currentUserId);
            } else {
                query = query.eq('user_id', currentUserId);
            }

            if (bypassCache) {
                 query = query.neq('description', `bypass-${Date.now()}`);
            }

            const { data: txs } = await query;

            if (txs) {
                // Flatten profile and splits if they are arrays (Supabase dynamic returns)
                const formattedTxs = txs.map(tx => ({
                    ...tx,
                    profile: Array.isArray(tx.profile) ? tx.profile[0] : tx.profile,
                    splits: tx.splits || []
                })) as Transaction[];
                setTransactions(formattedTxs);
                setHasMore(txs.length >= limit);
            }
        } catch (error) {
            console.error("Error loading transactions:", error);
        }
    };

    loadTxRef.current = loadTransactions;
    loadLimitRef.current = loadLimit;

    const loadMore = useCallback(async () => {
        if (!userId || loadingMore || !hasMore) return;
        const nextLimit = loadLimitRef.current + PAGE_SIZE;
        setLoadLimit(nextLimit);
        loadLimitRef.current = nextLimit;
        setLoadingMore(true);
        try {
            await loadTxRef.current?.(userId, activeWorkspaceId, false, nextLimit);
        } finally {
            setLoadingMore(false);
        }
    }, [userId, activeWorkspaceId, loadingMore, hasMore]);

    const txDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const debouncedLoadTx = useCallback((uid: string, workspaceId: string | null = null, bypassCache = false) => {
        if (txDebounceRef.current) clearTimeout(txDebounceRef.current);
        txDebounceRef.current = setTimeout(() => {
            loadTxRef.current?.(uid, workspaceId, bypassCache);
        }, 300);
    }, []);

    useEffect(() => {
        return () => {
            if (txDebounceRef.current) clearTimeout(txDebounceRef.current);
        };
    }, []);

    // Reset pagination and re-fetch when user or workspace changes
    useEffect(() => {
        if (!userId) return;
        setLoadLimit(PAGE_SIZE);
        loadLimitRef.current = PAGE_SIZE;

        const fetchInitialData = async () => {
            setLoading(true);
            try {
                await loadTxRef.current?.(userId, activeWorkspaceId, false, PAGE_SIZE);
            } finally {
                setLoading(false);
            }
        };

        fetchInitialData();
    }, [userId, activeWorkspaceId]);

    useEffect(() => {
        if (!userId) return;

        const txFilter = activeWorkspaceId && activeWorkspaceId !== 'personal'
            ? `group_id=eq.${activeWorkspaceId}`
            : `user_id=eq.${userId}`;

        const channel = supabase
            .channel(`dashboard-sync-${userId}-${activeWorkspaceId || 'personal'}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'transactions', filter: txFilter },
                () => { debouncedLoadTx(userId, activeWorkspaceId, true); }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'splits', filter: `user_id=eq.${userId}` },
                () => { debouncedLoadTx(userId, activeWorkspaceId, true); }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
                () => { debouncedLoadTx(userId, activeWorkspaceId, true); }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId, activeWorkspaceId, debouncedLoadTx]);

    useEffect(() => {
        if (!userId) return;

        // Handle case where expense was added before this component mounted (post-navigation)
        if (sessionStorage.getItem('novira_expense_added')) {
            sessionStorage.removeItem('novira_expense_added');
            loadTxRef.current?.(userId, activeWorkspaceId, true);
        }

        const handleExpenseAdded = () => loadTxRef.current?.(userId, activeWorkspaceId, true);
        window.addEventListener('novira:expense-added', handleExpenseAdded);
        return () => window.removeEventListener('novira:expense-added', handleExpenseAdded);
    }, [userId, activeWorkspaceId]);

    useEffect(() => {
        if (!userId) return;
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                loadTxRef.current?.(userId, activeWorkspaceId, true);
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [userId, activeWorkspaceId]);

    const handleDeleteTransaction = async (tx: Transaction) => {
        if (mutatingRef.current) return;
        mutatingRef.current = true;
        // Optimistic: remove from UI immediately
        const previousTransactions = [...transactions];
        setTransactions(prev => prev.filter(t => t.id !== tx.id));
        toast.success('Transaction deleted'); // toast.success will trigger light haptic

        try {
            const { error } = await supabase
                .from('transactions')
                .delete()
                .eq('id', tx.id);

            if (error) throw error;

            // If recurring, ask if user wants to stop future ones
            if (tx.is_recurring) {
                setTimeout(async () => {
                    // Find the matching template first to get a specific ID
                    const { data: templates } = await supabase
                        .from('recurring_templates')
                        .select('id')
                        .eq('user_id', userId)
                        .eq('description', tx.description)
                        .eq('amount', tx.amount)
                        .eq('is_active', true)
                        .limit(1);

                    const templateId = templates?.[0]?.id;
                    if (!templateId) return; // No active template found, nothing to stop

                    toast('This was a recurring expense.', {
                        description: 'Stop future occurrences too?',
                        action: {
                            label: 'Stop Series',
                            onClick: async () => {
                                try {
                                    const { error } = await supabase
                                        .from('recurring_templates')
                                        .update({ is_active: false })
                                        .eq('id', templateId);

                                    if (error) throw error;
                                    toast.success('Recurring series stopped');
                                } catch (err: any) {
                                    toast.error('Failed to stop series: ' + err.message);
                                }
                            }
                        }
                    });
                }, 1000);
            }
        } catch (error: any) {
            // Rollback on failure
            setTransactions(previousTransactions);
            toast.error('Failed to delete: ' + error.message);
        } finally {
            mutatingRef.current = false;
        }
    };

    const handleUpdateTransaction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTransaction) return;
        if (mutatingRef.current) return;
        mutatingRef.current = true;

        // Optimistic: update in UI immediately
        const previousTransactions = [...transactions];
        setTransactions(prev => prev.map(tx =>
            tx.id === editingTransaction.id
                ? { ...tx, ...editingTransaction }
                : tx
        ));
        toast.success('Transaction updated');
        setIsEditOpen(false);
        const savedEditingTx = editingTransaction;
        setEditingTransaction(null);

        try {
            const { error } = await supabase
                .from('transactions')
                .update({
                    description: savedEditingTx.description,
                    category: savedEditingTx.category,
                    amount: savedEditingTx.amount,
                    bucket_id: savedEditingTx.bucket_id || null,
                    exclude_from_allowance: savedEditingTx.exclude_from_allowance || false,
                    place_name: savedEditingTx.place_name || null,
                    place_address: savedEditingTx.place_address || null,
                    place_lat: savedEditingTx.place_lat || null,
                    place_lng: savedEditingTx.place_lng || null,
                })
                .eq('id', savedEditingTx.id);

            if (error) throw error;
        } catch (error: any) {
            // Rollback on failure
            setTransactions(previousTransactions);
            toast.error('Failed to update: ' + error.message);
        } finally {
            mutatingRef.current = false;
        }
    };

    const loadAuditLogs = async (tx: Transaction) => {
        setSelectedAuditTx(tx);
        setLoadingAudit(true);
        try {
            const { data, error } = await supabase
                .from('transaction_history')
                .select('*, changed_by_profile:profiles(full_name)')
                .eq('transaction_id', tx.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setAuditLogs(data || []);
        } catch (error: any) {
            console.error("Error loading audit logs:", error);
            toast.error("Failed to load history");
        } finally {
            setLoadingAudit(false);
        }
    };

    return {
        transactions,
        setTransactions,
        loading,
        setLoading,
        hasMore,
        loadingMore,
        loadMore,
        editingTransaction,
        setEditingTransaction,
        isEditOpen,
        setIsEditOpen,
        selectedAuditTx,
        setSelectedAuditTx,
        auditLogs,
        loadingAudit,
        loadTransactions,
        handleDeleteTransaction,
        handleUpdateTransaction,
        loadAuditLogs
    };
}
