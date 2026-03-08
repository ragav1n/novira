import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/utils/haptics';
import type { Transaction, AuditLog } from '@/types/transaction';

export function useDashboardData(userId: string | null) {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);

    const [selectedAuditTx, setSelectedAuditTx] = useState<Transaction | null>(null);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [loadingAudit, setLoadingAudit] = useState(false);

    const loadTxRef = useRef<((uid: string, bypassCache?: boolean) => Promise<void>) | null>(null);

    const loadTransactions = async (currentUserId: string, bypassCache = false) => {
        try {
            let query = supabase
                .from('transactions')
                .select('id, description, amount, category, date, created_at, user_id, currency, exchange_rate, base_currency, bucket_id, exclude_from_allowance, is_recurring, place_name, place_address, place_lat, place_lng, profile:profiles(full_name, avatar_url), splits(user_id, amount, is_paid)')
                .order('date', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(200);

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
            }
        } catch (error) {
            console.error("Error loading transactions:", error);
        }
    };

    loadTxRef.current = loadTransactions;

    const txDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const debouncedLoadTx = useCallback((uid: string, bypassCache = false) => {
        if (txDebounceRef.current) clearTimeout(txDebounceRef.current);
        txDebounceRef.current = setTimeout(() => {
            loadTxRef.current?.(uid, bypassCache);
        }, 300);
    }, []);

    useEffect(() => {
        return () => {
            if (txDebounceRef.current) clearTimeout(txDebounceRef.current);
        };
    }, []);

    // Initial data fetch
    useEffect(() => {
        if (!userId) return;
        
        const fetchInitialData = async () => {
            setLoading(true);
            try {
                await loadTxRef.current?.(userId, false);
            } finally {
                setLoading(false);
            }
        };

        fetchInitialData();
    }, [userId]);

    useEffect(() => {
        if (!userId) return;

        const channel = supabase
            .channel('db-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'transactions',
                },
                () => {
                    debouncedLoadTx(userId, true);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId, debouncedLoadTx]);

    useEffect(() => {
        if (!userId) return;
        const handleExpenseAdded = () => loadTxRef.current?.(userId, true);
        window.addEventListener('novira:expense-added', handleExpenseAdded);
        return () => window.removeEventListener('novira:expense-added', handleExpenseAdded);
    }, [userId]);

    useEffect(() => {
        if (!userId) return;
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                loadTxRef.current?.(userId, true);
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [userId]);

    const handleDeleteTransaction = async (tx: Transaction) => {
        // Optimistic: remove from UI immediately
        const previousTransactions = [...transactions];
        setTransactions(prev => prev.filter(t => t.id !== tx.id));
        toast.success('Transaction deleted');

        try {
            const { error } = await supabase
                .from('transactions')
                .delete()
                .eq('id', tx.id);

            if (error) throw error;

            // If recurring, ask if user wants to stop future ones
            if (tx.is_recurring) {
                setTimeout(() => {
                    toast('This was a recurring expense.', {
                        description: 'Stop future occurrences too?',
                        action: {
                            label: 'Stop Series',
                            onClick: async () => {
                                try {
                                    const { error } = await supabase
                                        .from('recurring_templates')
                                        .update({ is_active: false })
                                        .eq('user_id', userId)
                                        .eq('description', tx.description)
                                        .eq('amount', tx.amount);

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
        }
    };

    const handleUpdateTransaction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTransaction) return;

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
