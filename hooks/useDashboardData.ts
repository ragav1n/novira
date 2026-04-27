import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { get } from 'idb-keyval';
import { supabase } from '@/lib/supabase';
import { toast } from '@/utils/haptics';
import type { Transaction, AuditLog } from '@/types/transaction';
import type { SyncPayload } from '@/lib/offline-sync-queue';
import { discardFailedItem, enqueueMutation } from '@/lib/sync-manager';
import { invalidateTransactionCaches } from '@/lib/sw-cache';
import { useTransactionInvalidationListener } from './useTransactionInvalidationListener';

const PAGE_SIZE = 100;
const QUEUE_KEY = 'novira-offline-queue';

function pendingItemToTransaction(
    item: SyncPayload,
    profile?: { full_name: string; avatar_url?: string }
): Transaction | null {
    if (item.type !== 'ADD_FULL_TRANSACTION') return null;
    if (item.status === 'synced') return null;
    const t = item.data?.transaction;
    if (!t) return null;
    const splits = (item.data?.splitRecords ?? []).map((s: { user_id: string; amount: number }) => ({
        user_id: s.user_id,
        amount: s.amount,
    }));
    return {
        id: item.id,
        description: t.description,
        amount: t.amount,
        category: t.category,
        date: t.date,
        created_at: new Date(item.createdAt).toISOString(),
        user_id: t.user_id,
        currency: t.currency,
        exchange_rate: t.exchange_rate,
        base_currency: t.base_currency,
        converted_amount: t.converted_amount,
        is_recurring: t.is_recurring,
        bucket_id: t.bucket_id ?? undefined,
        exclude_from_allowance: t.exclude_from_allowance,
        payment_method: t.payment_method,
        place_name: t.place_name ?? undefined,
        place_address: t.place_address ?? undefined,
        place_lat: t.place_lat ?? undefined,
        place_lng: t.place_lng ?? undefined,
        group_id: t.group_id ?? null,
        splits,
        profile,
        _pending: item.status === 'pending' || item.status === 'syncing',
        _failed: item.status === 'failed',
        _syncError: item.errorReason,
    };
}

export function useDashboardData(
    userId: string | null,
    activeWorkspaceId: string | null = null,
    currentUserProfile?: { full_name: string; avatar_url?: string }
) {
    const [serverTransactions, setServerTransactions] = useState<Transaction[]>([]);
    const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [loadLimit, setLoadLimit] = useState(PAGE_SIZE);

    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);

    const [selectedAuditTx, setSelectedAuditTx] = useState<Transaction | null>(null);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [loadingAudit, setLoadingAudit] = useState(false);

    const loadTxRef = useRef<((uid: string, workspaceId: string | null, limit?: number) => Promise<void>) | null>(null);
    const loadLimitRef = useRef(PAGE_SIZE);
    const mutatingRef = useRef(false);

    const TX_SELECT = 'id, description, amount, category, date, created_at, user_id, group_id, currency, exchange_rate, base_currency, bucket_id, exclude_from_allowance, is_recurring, is_settlement, place_name, place_address, place_lat, place_lng, profile:profiles(full_name, avatar_url), splits(user_id, amount, is_paid)';

    const loadTransactions = useCallback(async (currentUserId: string, workspaceId: string | null = null, limit = loadLimitRef.current) => {
        try {
            let query = supabase
                .from('transactions')
                .select(TX_SELECT)
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

            const { data: txs } = await query;

            if (txs) {
                // Flatten profile and splits if they are arrays (Supabase dynamic returns)
                const formattedTxs = txs.map(tx => ({
                    ...tx,
                    profile: Array.isArray(tx.profile) ? tx.profile[0] : tx.profile,
                    splits: tx.splits || []
                })) as Transaction[];
                setServerTransactions(formattedTxs);
                setHasMore(txs.length >= limit);
            }
        } catch (error) {
            if (process.env.NODE_ENV === 'development') {
                console.error("Error loading transactions:", error);
            }
        }
    }, []);

    loadTxRef.current = loadTransactions;
    loadLimitRef.current = loadLimit;

    const loadPendingFromQueue = useCallback(async () => {
        if (!userId || typeof window === 'undefined') return;
        try {
            const queue = (await get<SyncPayload[]>(QUEUE_KEY)) || [];
            const filtered = queue.filter(item => {
                if (item.type !== 'ADD_FULL_TRANSACTION') return false;
                if (item.status === 'synced') return false;
                const t = item.data?.transaction;
                if (!t) return false;
                if (activeWorkspaceId && activeWorkspaceId !== 'personal') {
                    return t.group_id === activeWorkspaceId;
                }
                if (activeWorkspaceId === 'personal') {
                    return t.group_id == null && t.user_id === userId;
                }
                return t.user_id === userId;
            });
            const pending = filtered
                .map(item => pendingItemToTransaction(item, currentUserProfile))
                .filter((t): t is Transaction => t !== null);
            setPendingTransactions(pending);
        } catch (error) {
            if (process.env.NODE_ENV === 'development') {
                console.error('Error loading pending queue items:', error);
            }
        }
    }, [userId, activeWorkspaceId, currentUserProfile?.full_name, currentUserProfile?.avatar_url]);

    const loadMore = useCallback(async () => {
        if (!userId || loadingMore || !hasMore) return;
        const nextLimit = loadLimitRef.current + PAGE_SIZE;
        setLoadLimit(nextLimit);
        loadLimitRef.current = nextLimit;
        setLoadingMore(true);
        try {
            await loadTxRef.current?.(userId, activeWorkspaceId, nextLimit);
        } finally {
            setLoadingMore(false);
        }
    }, [userId, activeWorkspaceId, loadingMore, hasMore]);

    const txDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const debouncedLoadTx = useCallback((uid: string, workspaceId: string | null = null) => {
        if (txDebounceRef.current) clearTimeout(txDebounceRef.current);
        txDebounceRef.current = setTimeout(() => {
            loadTxRef.current?.(uid, workspaceId);
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
                await Promise.allSettled([
                    loadTxRef.current?.(userId, activeWorkspaceId, PAGE_SIZE),
                    loadPendingFromQueue(),
                ]);
            } finally {
                setLoading(false);
            }
        };

        fetchInitialData();
    }, [userId, activeWorkspaceId, loadPendingFromQueue]);

    // Keep pending list in sync with queue events
    useEffect(() => {
        if (!userId) return;
        const onQueueUpdated = () => loadPendingFromQueue();
        const onMutationSynced = (e: Event) => {
            const detail = (e as CustomEvent<{ id: string; type: string }>).detail;
            // Re-fetch from server so the dashboard catches up immediately. Realtime
            // usually delivers the row, but after a long offline period the websocket
            // can be in a stale state and miss it.
            //
            // For ADD: keep the pending row visible until the fetch completes — otherwise
            // there's a flicker where the row vanishes while we wait for the server roundtrip.
            // For UPDATE/DELETE: the optimistic UI is already on the server's data shape,
            // so we just refresh.
            if (detail?.type === 'ADD_FULL_TRANSACTION') {
                if (userId) {
                    Promise.resolve(loadTxRef.current?.(userId, activeWorkspaceId))
                        .finally(() => {
                            setPendingTransactions(prev => prev.filter(t => t.id !== detail.id));
                        });
                } else {
                    setPendingTransactions(prev => prev.filter(t => t.id !== detail.id));
                }
            } else if (detail?.type === 'UPDATE_TRANSACTION' || detail?.type === 'DELETE_TRANSACTION') {
                if (userId) loadTxRef.current?.(userId, activeWorkspaceId);
            }
        };
        window.addEventListener('novira-queue-updated', onQueueUpdated);
        window.addEventListener('novira-mutation-synced', onMutationSynced);
        return () => {
            window.removeEventListener('novira-queue-updated', onQueueUpdated);
            window.removeEventListener('novira-mutation-synced', onMutationSynced);
        };
    }, [userId, activeWorkspaceId, loadPendingFromQueue]);

    // Fetch a single transaction with full profile/splits joins for surgical state updates
    const fetchFullTransaction = useCallback(async (txId: string): Promise<Transaction | null> => {
        try {
            const { data } = await supabase
                .from('transactions')
                .select(TX_SELECT)
                .eq('id', txId)
                .single();
            if (!data) return null;
            return {
                ...data,
                profile: Array.isArray(data.profile) ? data.profile[0] : data.profile,
                splits: data.splits || []
            } as Transaction;
        } catch {
            return null;
        }
    }, []);

    useEffect(() => {
        if (!userId) return;

        const txFilter = activeWorkspaceId && activeWorkspaceId !== 'personal'
            ? `group_id=eq.${activeWorkspaceId}`
            : `user_id=eq.${userId}`;

        const channel = supabase
            .channel(`dashboard-sync-${userId}-${activeWorkspaceId || 'personal'}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'transactions', filter: txFilter },
                async (payload) => {
                    // Fetch full transaction with profile/splits joins
                    const fullTx = await fetchFullTransaction(payload.new.id);
                    if (fullTx) {
                        setServerTransactions(prev => {
                            // Avoid duplicates (e.g. from optimistic updates)
                            if (prev.some(t => t.id === fullTx.id)) {
                                return prev.map(t => t.id === fullTx.id ? fullTx : t);
                            }
                            // Insert in sorted position (date desc, created_at desc)
                            const inserted = [fullTx, ...prev];
                            inserted.sort((a, b) => {
                                const dateCompare = b.date.localeCompare(a.date);
                                if (dateCompare !== 0) return dateCompare;
                                return b.created_at.localeCompare(a.created_at);
                            });
                            return inserted;
                        });
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'transactions', filter: txFilter },
                async (payload) => {
                    const fullTx = await fetchFullTransaction(payload.new.id);
                    if (fullTx) {
                        setServerTransactions(prev =>
                            prev.map(t => t.id === fullTx.id ? fullTx : t)
                        );
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'transactions', filter: txFilter },
                (payload) => {
                    setServerTransactions(prev => prev.filter(t => t.id !== payload.old.id));
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'splits', filter: `user_id=eq.${userId}` },
                () => { debouncedLoadTx(userId, activeWorkspaceId); }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
                () => { debouncedLoadTx(userId, activeWorkspaceId); }
            )
            .subscribe();

        // Force-reconnect realtime when the device comes back online. Supabase usually
        // recovers on its own, but after a long offline (laptop closed for hours) the
        // websocket can be in a stale state without firing — leaving the dashboard
        // frozen until the user manually refreshes.
        const handleOnline = () => {
            try {
                supabase.realtime.connect();
            } catch (e) {
                if (process.env.NODE_ENV === 'development') {
                    console.warn('[useDashboardData] realtime reconnect failed:', e);
                }
            }
            // Also re-fetch in case mutations from other tabs were missed.
            loadTxRef.current?.(userId, activeWorkspaceId);
        };
        window.addEventListener('online', handleOnline);

        return () => {
            window.removeEventListener('online', handleOnline);
            supabase.removeChannel(channel);
        };
    }, [userId, activeWorkspaceId, debouncedLoadTx, fetchFullTransaction]);

    useEffect(() => {
        if (!userId) return;

        // Handle case where expense was added before this component mounted (post-navigation)
        if (sessionStorage.getItem('novira_expense_added')) {
            sessionStorage.removeItem('novira_expense_added');
            // Inject the optimistic row immediately so the dashboard renders with it
            // before the network fetch lands. Realtime / mount-time refetch reconcile by id.
            try {
                const raw = sessionStorage.getItem('novira_just_created_tx');
                if (raw) {
                    sessionStorage.removeItem('novira_just_created_tx');
                    const stashed = JSON.parse(raw) as Transaction;
                    if (stashed?.id) {
                        const inWorkspace =
                            !activeWorkspaceId
                                ? stashed.user_id === userId
                                : activeWorkspaceId === 'personal'
                                    ? stashed.group_id == null && stashed.user_id === userId
                                    : stashed.group_id === activeWorkspaceId;
                        if (inWorkspace) {
                            setServerTransactions(prev => {
                                if (prev.some(t => t.id === stashed.id)) return prev;
                                const inserted = [stashed, ...prev];
                                inserted.sort((a, b) => {
                                    const dateCompare = b.date.localeCompare(a.date);
                                    if (dateCompare !== 0) return dateCompare;
                                    return b.created_at.localeCompare(a.created_at);
                                });
                                return inserted;
                            });
                        }
                    }
                }
            } catch (error) {
                if (process.env.NODE_ENV === 'development') {
                    console.error('Error injecting stashed transaction:', error);
                }
            }
            loadTxRef.current?.(userId, activeWorkspaceId);
            loadPendingFromQueue();
        }

        const handleExpenseAdded = () => {
            loadTxRef.current?.(userId, activeWorkspaceId);
            loadPendingFromQueue();
        };
        window.addEventListener('novira:expense-added', handleExpenseAdded);
        return () => window.removeEventListener('novira:expense-added', handleExpenseAdded);
    }, [userId, activeWorkspaceId, loadPendingFromQueue]);

    useEffect(() => {
        if (!userId) return;
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                loadTxRef.current?.(userId, activeWorkspaceId);
                loadPendingFromQueue();
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [userId, activeWorkspaceId, loadPendingFromQueue]);

    // Cross-tab cache invalidation. Another tab mutating transactions clears the SW
    // cache for this origin (caches are shared) but each tab's React state is its own —
    // refetch when we hear the broadcast so we don't sit on stale rows.
    useTransactionInvalidationListener(() => {
        if (userId) loadTxRef.current?.(userId, activeWorkspaceId);
    });

    const handleDeleteTransaction = async (tx: Transaction) => {
        // Pending offline transaction — discard the queue entry instead of hitting Supabase.
        if (tx._pending || tx._failed) {
            setPendingTransactions(prev => prev.filter(t => t.id !== tx.id));
            try {
                await discardFailedItem(tx.id);
                toast.success('Transaction deleted');
            } catch {
                toast.error('Failed to remove pending transaction');
                loadPendingFromQueue();
            }
            return;
        }

        if (mutatingRef.current) return;
        mutatingRef.current = true;
        // Optimistic: remove from UI immediately
        const previousServerTransactions = [...serverTransactions];
        setServerTransactions(prev => prev.filter(t => t.id !== tx.id));
        toast.success('Transaction deleted'); // toast.success will trigger light haptic

        // Offline: queue the delete so it reaches the server when we reconnect.
        // Without this branch the direct supabase.delete below would fail offline
        // and the row would snap back into the list — confusing for the user.
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            try {
                await enqueueMutation('DELETE_TRANSACTION', { id: tx.id });
            } catch (error: any) {
                setServerTransactions(previousServerTransactions);
                if (error?.name === 'QueueFullError') {
                    toast.error(error.message);
                } else {
                    toast.error('Failed to queue delete: ' + error.message);
                }
            } finally {
                mutatingRef.current = false;
            }
            return;
        }

        try {
            const { error } = await supabase
                .from('transactions')
                .delete()
                .eq('id', tx.id);

            if (error) throw error;
            invalidateTransactionCaches();

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
            setServerTransactions(previousServerTransactions);
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
        const previousServerTransactions = [...serverTransactions];
        setServerTransactions(prev => prev.map(tx =>
            tx.id === editingTransaction.id
                ? { ...tx, ...editingTransaction }
                : tx
        ));
        toast.success('Transaction updated');
        setIsEditOpen(false);
        const savedEditingTx = editingTransaction;
        setEditingTransaction(null);

        const patch = {
            description: savedEditingTx.description,
            category: savedEditingTx.category,
            amount: savedEditingTx.amount,
            bucket_id: savedEditingTx.bucket_id || null,
            exclude_from_allowance: savedEditingTx.exclude_from_allowance || false,
            place_name: savedEditingTx.place_name || null,
            place_address: savedEditingTx.place_address || null,
            place_lat: savedEditingTx.place_lat || null,
            place_lng: savedEditingTx.place_lng || null,
        };

        // Offline: queue the update; optimistic UI is already applied above.
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            try {
                await enqueueMutation('UPDATE_TRANSACTION', { id: savedEditingTx.id, patch });
            } catch (error: any) {
                setServerTransactions(previousServerTransactions);
                if (error?.name === 'QueueFullError') {
                    toast.error(error.message);
                } else {
                    toast.error('Failed to queue update: ' + error.message);
                }
            } finally {
                mutatingRef.current = false;
            }
            return;
        }

        try {
            const { error } = await supabase
                .from('transactions')
                .update(patch)
                .eq('id', savedEditingTx.id);

            if (error) throw error;
            invalidateTransactionCaches();
        } catch (error: any) {
            // Rollback on failure
            setServerTransactions(previousServerTransactions);
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
            if (process.env.NODE_ENV === 'development') {
                console.error("Error loading audit logs:", error);
            }
            toast.error("Failed to load history");
        } finally {
            setLoadingAudit(false);
        }
    };

    // Merge pending (offline-queued) items on top of server-fetched transactions.
    // Dedupe by id to handle the rare case where a server row arrives with the same id
    // as a still-pending queue entry (e.g. via realtime before the queue event fires).
    const transactions = useMemo<Transaction[]>(() => {
        if (pendingTransactions.length === 0) return serverTransactions;
        const pendingIds = new Set(pendingTransactions.map(t => t.id));
        return [
            ...pendingTransactions,
            ...serverTransactions.filter(t => !pendingIds.has(t.id))
        ];
    }, [pendingTransactions, serverTransactions]);

    return {
        transactions,
        setTransactions: setServerTransactions,
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
