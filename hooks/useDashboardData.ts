import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/utils/haptics';
import type { Transaction, AuditLog } from '@/types/transaction';
import type { SyncPayload } from '@/lib/offline-sync-queue';
import { discardQueuedAdd, enqueueMutation, getCurrentQueue } from '@/lib/sync-manager';
import { invalidateTransactionCaches } from '@/lib/sw-cache';
import { deleteReceipt } from '@/lib/receipt-storage';
import { useAccounts } from '@/components/providers/accounts-provider';
import { reportNetworkError } from '@/lib/network-error-bus';
import { getErrorMessage, getErrorName } from '@/lib/error-utils';
import { applyWorkspaceFilter } from '@/lib/workspace-filter';
import { useTransactionInvalidationListener } from './useTransactionInvalidationListener';
import { format, startOfMonth, subMonths, subDays } from 'date-fns';

const PAGE_SIZE = 100;
// PostgREST caps a response at 1,000 rows, so the stats window is read in pages.
const STATS_PAGE = 1000;
const STATS_MAX_PAGES = 20;

/**
 * First date the dashboard's stats look at: the start of last month (carryover,
 * last-month comparison) or 30 days back (weekday pattern), whichever is earlier.
 */
function statsWindowStart(today = new Date()): string {
    const lastMonth = startOfMonth(subMonths(today, 1));
    const thirtyDays = subDays(today, 29);
    return format(lastMonth < thirtyDays ? lastMonth : thirtyDays, 'yyyy-MM-dd');
}

type QueuedOverlay = { deletes: Set<string>; patches: Map<string, Partial<Transaction>> };
const EMPTY_OVERLAY: QueuedOverlay = { deletes: new Set(), patches: new Map() };

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
    // Month-bounded rows for the stats. The list is paginated at 100, so last
    // month's total, the carryover and the weekday pattern used to be computed from
    // whatever happened to fit in the newest 100 rows.
    const [statsServerTransactions, setStatsServerTransactions] = useState<Transaction[]>([]);
    // Offline DELETE/UPDATE mutations still in the queue. Only queued ADDs used to
    // be overlaid, so a visibility refetch (served from the SW cache while offline)
    // put a deleted row back and reverted an edit.
    const [queuedOverlay, setQueuedOverlay] = useState<QueuedOverlay>(EMPTY_OVERLAY);
    // Rows deleted from this device. Removing them from the list state isn't enough
    // once the stats keep their own copy, and a refetch that races the delete would
    // otherwise briefly re-add them.
    const [locallyRemoved, setLocallyRemoved] = useState<Set<string>>(() => new Set());
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [loadLimit, setLoadLimit] = useState(PAGE_SIZE);

    const { activeAccountId } = useAccounts();
    const activeAccountIdRef = useRef<string | null>(activeAccountId);
    activeAccountIdRef.current = activeAccountId;

    // Read profile through a ref so the pending-queue loader doesn't recreate
    // when the user edits their avatar/name. Without this, every profile edit
    // bumps loadPendingFromQueue's identity, which cascades into the fetch
    // effect below and triggers a full transaction refetch.
    const currentUserProfileRef = useRef(currentUserProfile);
    currentUserProfileRef.current = currentUserProfile;

    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);

    const [selectedAuditTx, setSelectedAuditTx] = useState<Transaction | null>(null);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [loadingAudit, setLoadingAudit] = useState(false);

    const loadTxRef = useRef<((uid: string, workspaceId: string | null, limit?: number) => Promise<void>) | null>(null);
    const loadStatsRef = useRef<((uid: string, workspaceId: string | null) => Promise<void>) | null>(null);
    const loadLimitRef = useRef(PAGE_SIZE);
    const mutatingRef = useRef(false);
    const recurringToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Bumped on each workspace/user change so in-flight fetches from a previous
    // workspace can't land their results on top of the new one.
    const fetchGenRef = useRef(0);

    const TX_SELECT = 'id, description, amount, category, date, created_at, user_id, group_id, currency, exchange_rate, base_currency, converted_amount, bucket_id, exclude_from_allowance, is_recurring, is_settlement, is_income, place_name, place_address, place_lat, place_lng, tags, receipt_path, account_id, is_transfer, transfer_pair_id, profile:profiles(full_name, avatar_url), splits(user_id, amount, is_paid)';

    // Loads overlap (realtime, visibility, loadMore each fire one); only the
    // newest may land, or an older page set resurrects a row deleted since.
    const statsSeqRef = useRef(0);
    const loadStats = useCallback(async (currentUserId: string, workspaceId: string | null = null) => {
        const myGen = fetchGenRef.current;
        const mySeq = ++statsSeqRef.current;
        const since = statsWindowStart();
        try {
            const rows: Transaction[] = [];
            for (let page = 0; page < STATS_MAX_PAGES; page++) {
                const from = page * STATS_PAGE;
                const baseQuery = supabase
                    .from('transactions')
                    .select(TX_SELECT)
                    .gte('date', since)
                    .order('date', { ascending: false })
                    .order('id', { ascending: true })
                    .range(from, from + STATS_PAGE - 1);
                let query = applyWorkspaceFilter(baseQuery, currentUserId, workspaceId);
                const accountFilter = activeAccountIdRef.current;
                if (!workspaceId && accountFilter) query = query.eq('account_id', accountFilter);
                const { data, error } = await query;
                if (error) throw error;
                if (fetchGenRef.current !== myGen || statsSeqRef.current !== mySeq) return;
                for (const tx of data ?? []) {
                    rows.push({
                        ...tx,
                        profile: Array.isArray(tx.profile) ? tx.profile[0] : tx.profile,
                        splits: tx.splits || [],
                    } as Transaction);
                }
                if (!data || data.length < STATS_PAGE) break;
            }
            if (fetchGenRef.current !== myGen || statsSeqRef.current !== mySeq) return;
            setStatsServerTransactions(rows);
        } catch (error) {
            // The list's own loader reports network failures; the stats fall back to
            // the list rows merged in below, so there's nothing more to show here.
            console.error('[useDashboardData] stats window load failed:', error);
        }
    }, []);
    loadStatsRef.current = loadStats;

    const loadTransactions = useCallback(async (currentUserId: string, workspaceId: string | null = null, limit = loadLimitRef.current) => {
        const myGen = fetchGenRef.current;
        // Every list refresh trigger (realtime, visibility, sync, expense added) is
        // also a stats refresh trigger. Not awaited: the list mustn't wait on it.
        loadStatsRef.current?.(currentUserId, workspaceId);
        try {
            // Fetch one extra row so we can distinguish "exactly `limit` rows total"
            // from "more available" — otherwise hasMore stays true at exact multiples
            // of PAGE_SIZE and the "Load more" button fetches a no-op page.
            const baseQuery = supabase
                .from('transactions')
                .select(TX_SELECT)
                .order('date', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(limit + 1);
            let query = applyWorkspaceFilter(baseQuery, currentUserId, workspaceId);
            // Account filter is a personal-workspace concept — in a shared
            // workspace each member's tx is on their own account, filtering
            // by one account_id would exclude partners' rows confusingly.
            const accountFilter = activeAccountIdRef.current;
            if (!workspaceId && accountFilter) {
                query = query.eq('account_id', accountFilter);
            }

            const { data: txs } = await query;

            if (fetchGenRef.current !== myGen) return;
            if (txs) {
                const more = txs.length > limit;
                const visible = more ? txs.slice(0, limit) : txs;
                // Flatten profile and splits if they are arrays (Supabase dynamic returns)
                const formattedTxs = visible.map(tx => ({
                    ...tx,
                    profile: Array.isArray(tx.profile) ? tx.profile[0] : tx.profile,
                    splits: tx.splits || []
                })) as Transaction[];
                setServerTransactions(formattedTxs);
                setHasMore(more);
            }
        } catch (error) {
            if (process.env.NODE_ENV === 'development') {
                console.error("Error loading transactions:", error);
            }
            reportNetworkError({
                message: "Couldn't load transactions",
                source: 'useDashboardData.loadTransactions',
                retry: () => loadTxRef.current?.(currentUserId, workspaceId, limit),
            });
        }
    }, []);

    loadTxRef.current = loadTransactions;
    loadLimitRef.current = loadLimit;

    const loadPendingFromQueue = useCallback(async () => {
        if (!userId || typeof window === 'undefined') return;
        const myGen = fetchGenRef.current;
        try {
            const queue = await getCurrentQueue();
            if (fetchGenRef.current !== myGen) return;
            const deletes = new Set<string>();
            const patches = new Map<string, Partial<Transaction>>();
            for (const item of queue) {
                if (item.status !== 'pending' && item.status !== 'syncing') continue;
                if (item.type === 'DELETE_TRANSACTION' && item.data?.id) deletes.add(item.data.id);
                if (item.type === 'UPDATE_TRANSACTION' && item.data?.id && item.data.patch) {
                    patches.set(item.data.id, { ...patches.get(item.data.id), ...item.data.patch });
                }
            }
            setQueuedOverlay(deletes.size === 0 && patches.size === 0 ? EMPTY_OVERLAY : { deletes, patches });
            const filtered = queue.filter(item => {
                if (item.type !== 'ADD_FULL_TRANSACTION') return false;
                // Synced items get removed from queue post-flush; failed items
                // surface only in the global failed-sync banner so the dashboard
                // list isn't cluttered with rows the user can't act on inline.
                if (item.status === 'synced' || item.status === 'failed') return false;
                const t = item.data?.transaction;
                if (!t) return false;
                if (activeWorkspaceId) {
                    return t.group_id === activeWorkspaceId;
                }
                return t.user_id === userId;
            });
            const pending = filtered
                .map(item => pendingItemToTransaction(item, currentUserProfileRef.current))
                .filter((t): t is Transaction => t !== null);
            setPendingTransactions(pending);
        } catch (error) {
            if (process.env.NODE_ENV === 'development') {
                console.error('Error loading pending queue items:', error);
            }
        }
    }, [userId, activeWorkspaceId]);

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
            if (recurringToastTimerRef.current) clearTimeout(recurringToastTimerRef.current);
        };
    }, []);

    // Reset pagination and re-fetch when user, workspace, or account filter changes
    useEffect(() => {
        if (!userId) return;
        const myGen = ++fetchGenRef.current;
        setLoadLimit(PAGE_SIZE);
        loadLimitRef.current = PAGE_SIZE;
        // Clear the previous workspace's rows so a failed/slow fetch can't leave
        // them visible under the new workspace.
        setServerTransactions([]);
        setPendingTransactions([]);
        setStatsServerTransactions([]);
        setLocallyRemoved(new Set());
        setHasMore(false);

        const fetchInitialData = async () => {
            setLoading(true);
            try {
                await Promise.allSettled([
                    loadTxRef.current?.(userId, activeWorkspaceId, PAGE_SIZE),
                    loadPendingFromQueue(),
                ]);
            } finally {
                if (fetchGenRef.current === myGen) setLoading(false);
            }
        };

        fetchInitialData();
    }, [userId, activeWorkspaceId, activeAccountId, loadPendingFromQueue]);

    // Reset edit/audit dialog state when the user or workspace changes — otherwise
    // an open edit dialog after a workspace switch points at a transaction the
    // current workspace can't see, and submitting would update a row belonging to
    // the previous workspace.
    useEffect(() => {
        setEditingTransaction(null);
        setIsEditOpen(false);
        setSelectedAuditTx(null);
        setAuditLogs([]);
    }, [userId, activeWorkspaceId]);

    // Keep pending list in sync with queue events
    useEffect(() => {
        if (!userId) return;
        const onQueueUpdated = () => loadPendingFromQueue();
        const onMutationSynced = (e: Event) => {
            const detail = (e as CustomEvent<{ id: string; type: string }>).detail;
            if (detail?.type === 'ADD_FULL_TRANSACTION') {
                // Remove pending row first so the realtime INSERT (which arrives with
                // the server-side id) doesn't briefly visually duplicate it.
                setPendingTransactions(prev => prev.filter(t => t.id !== detail.id));
                if (userId) loadTxRef.current?.(userId, activeWorkspaceId);
            } else if (detail?.type === 'UPDATE_TRANSACTION' || detail?.type === 'DELETE_TRANSACTION') {
                if (userId) loadTxRef.current?.(userId, activeWorkspaceId);
            }
        };
        const onMutationFailedPermanent = (e: Event) => {
            const detail = (e as CustomEvent<{ id: string; type: string; data?: { id?: string } }>).detail;
            if (detail?.type === 'ADD_FULL_TRANSACTION') {
                // Permanent ADD failure: drop the optimistic pending row from the
                // dashboard immediately. The user sees the failure surfaced via the
                // global failed-sync banner with reason + Discard, not a stuck row.
                setPendingTransactions(prev => prev.filter(t => t.id !== detail.id));
            } else if (detail?.type === 'UPDATE_TRANSACTION' || detail?.type === 'DELETE_TRANSACTION') {
                // The optimistic edit/delete never landed — put the server's version back.
                const txId = detail.data?.id;
                if (txId) setLocallyRemoved(prev => {
                    if (!prev.has(txId)) return prev;
                    const next = new Set(prev);
                    next.delete(txId);
                    return next;
                });
                if (userId) loadTxRef.current?.(userId, activeWorkspaceId);
            }
        };
        // The sync loop already announces a landed receipt, but nothing listened,
        // so the row only picked up `receipt_path` if the Postgres realtime UPDATE
        // happened to arrive. On a phone that is the least reliable moment there is:
        // the socket routinely drops while the OS photo picker is foregrounded, and
        // realtime does not replay what it missed. The file was in storage and the
        // column was set, but the row still offered "Attach receipt" and no way to
        // view it — indistinguishable from the upload having failed. Patching the
        // path in from the event needs no refetch: the loop hands us the path it
        // just wrote.
        const onReceiptUploaded = (e: Event) => {
            const detail = (e as CustomEvent<{ txId: string; path: string }>).detail;
            if (!detail?.txId || !detail.path) return;
            setServerTransactions(prev => prev.map(t =>
                t.id === detail.txId ? { ...t, receipt_path: detail.path } : t
            ));
        };
        const onRefreshRequested = (e: WindowEventMap['novira-refresh-requested']) => {
            if (!userId) return;
            const p = loadTxRef.current?.(userId, activeWorkspaceId);
            if (p) e.detail?.waitUntil?.(p);
        };
        window.addEventListener('novira-queue-updated', onQueueUpdated);
        window.addEventListener('novira-mutation-synced', onMutationSynced);
        window.addEventListener('novira-mutation-failed-permanent', onMutationFailedPermanent);
        window.addEventListener('novira-receipt-uploaded', onReceiptUploaded);
        window.addEventListener('novira-refresh-requested', onRefreshRequested);
        return () => {
            window.removeEventListener('novira-queue-updated', onQueueUpdated);
            window.removeEventListener('novira-mutation-synced', onMutationSynced);
            window.removeEventListener('novira-mutation-failed-permanent', onMutationFailedPermanent);
            window.removeEventListener('novira-receipt-uploaded', onReceiptUploaded);
            window.removeEventListener('novira-refresh-requested', onRefreshRequested);
        };
    }, [userId, activeWorkspaceId, loadPendingFromQueue]);

    // Fetch a single transaction with full profile/splits joins for surgical state updates
    const fetchFullTransaction = useCallback(async (txId: string): Promise<Transaction | null> => {
        try {
            const { data } = await supabase
                .from('transactions')
                .select(TX_SELECT)
                .eq('id', txId)
                .maybeSingle();
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

        const myGen = fetchGenRef.current;
        const txFilter = activeWorkspaceId
            ? `group_id=eq.${activeWorkspaceId}`
            : `user_id=eq.${userId}`;

        // Topic must be unique per subscription instance, not per user/workspace.
        // This effect tears down and re-subscribes on workspace *and* account
        // changes; reusing a fixed topic means the new channel joins while the
        // old one with the same name is still unsubscribing, and the server
        // never completes the join (status goes CLOSED → TIMED_OUT, silently
        // killing realtime for the session). React StrictMode's double-invoke in
        // dev hits this every single mount.
        const channel = supabase
            .channel(`dashboard-sync-${userId}-${activeWorkspaceId || 'personal'}-${crypto.randomUUID()}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'transactions', filter: txFilter },
                async (payload) => {
                    // Fetch full transaction with profile/splits joins
                    const fullTx = await fetchFullTransaction(payload.new.id);
                    if (fetchGenRef.current !== myGen) return;
                    // Mirror loadTransactions' account scoping. The channel filter can
                    // only narrow by user/group, so without this a row on a different
                    // account lands in a list the account filter excludes — and then
                    // disappears on the next refetch.
                    const accountFilter = activeAccountIdRef.current;
                    if (!activeWorkspaceId && accountFilter && fullTx?.account_id !== accountFilter) return;
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
                    if (fetchGenRef.current !== myGen) return;
                    if (fullTx) {
                        setServerTransactions(prev =>
                            prev.map(t => t.id === fullTx.id ? fullTx : t)
                        );
                        setStatsServerTransactions(prev =>
                            prev.map(t => t.id === fullTx.id ? fullTx : t)
                        );
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'transactions', filter: txFilter },
                (payload) => {
                    if (fetchGenRef.current !== myGen) return;
                    setServerTransactions(prev => prev.filter(t => t.id !== payload.old.id));
                    setStatsServerTransactions(prev => prev.filter(t => t.id !== payload.old.id));
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
        // activeAccountId belongs here even though the subscription doesn't read it:
        // the reset effect above bumps fetchGenRef on account switches, and every
        // handler below early-returns on a generation mismatch. Without this dep the
        // channel keeps a stale `myGen` and goes permanently deaf after the first
        // account switch.
    }, [userId, activeWorkspaceId, activeAccountId, debouncedLoadTx, fetchFullTransaction]);

    useEffect(() => {
        if (!userId) return;

        // Handle case where expense was added before this component mounted
        // (post-navigation). The just-added row renders optimistically from the
        // offline queue via loadPendingFromQueue; loadTx reconciles against the
        // server, and the queue's synced event swaps the pending row for the real one.
        if (sessionStorage.getItem('novira_expense_added')) {
            sessionStorage.removeItem('novira_expense_added');
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

    const markRemoved = (ids: string[]) => setLocallyRemoved(prev => {
        const next = new Set(prev);
        for (const id of ids) next.add(id);
        return next;
    });
    const unmarkRemoved = (ids: string[]) => setLocallyRemoved(prev => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
    });

    const handleDeleteTransaction = async (tx: Transaction) => {
        // Pending offline transaction — discard the queue entry instead of hitting Supabase.
        if (tx._pending || tx._failed) {
            try {
                const outcome = await discardQueuedAdd(tx.id);
                if (outcome === 'syncing') {
                    // Mid-flight: the row may already exist on the server, so dropping
                    // the queue entry here is what used to resurrect it moments later.
                    toast.error('This expense is saving right now — delete it once it has synced');
                    return;
                }
                setPendingTransactions(prev => prev.filter(t => t.id !== tx.id));
                toast.success('Transaction deleted');
            } catch {
                toast.error('Failed to remove pending transaction');
                loadPendingFromQueue();
            }
            return;
        }

        if (tx.is_transfer && tx.transfer_pair_id) {
            await handleDeleteTransfer(tx);
            return;
        }

        if (mutatingRef.current) return;
        mutatingRef.current = true;
        // Optimistic: remove from UI immediately
        const previousServerTransactions = [...serverTransactions];
        setServerTransactions(prev => prev.filter(t => t.id !== tx.id));
        markRemoved([tx.id]);
        toast.success('Transaction deleted'); // toast.success will trigger light haptic

        // Offline: queue the delete so it reaches the server when we reconnect.
        // Without this branch the direct supabase.delete below would fail offline
        // and the row would snap back into the list — confusing for the user.
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            try {
                await enqueueMutation('DELETE_TRANSACTION', { id: tx.id });
            } catch (error) {
                setServerTransactions(previousServerTransactions);
                unmarkRemoved([tx.id]);
                const msg = getErrorMessage(error);
                if (getErrorName(error) === 'QueueFullError') {
                    toast.error(msg);
                } else {
                    toast.error('Failed to queue delete: ' + msg);
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

            // Best-effort: drop the attached receipt from storage. Failure
            // here doesn't roll the user back — the tx row is already gone
            // and an orphaned object is invisible to the user.
            if (tx.receipt_path) {
                deleteReceipt(tx.receipt_path).catch(err => {
                    console.error('[useDashboardData] receipt cleanup failed', err);
                });
            }

            // If recurring, ask if user wants to stop future ones
            if (tx.is_recurring) {
                if (recurringToastTimerRef.current) clearTimeout(recurringToastTimerRef.current);
                recurringToastTimerRef.current = setTimeout(async () => {
                    recurringToastTimerRef.current = null;
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
                                } catch (err) {
                                    toast.error('Failed to stop series: ' + getErrorMessage(err));
                                }
                            }
                        }
                    });
                }, 1000);
            }
        } catch (error) {
            // Rollback on failure
            setServerTransactions(previousServerTransactions);
            unmarkRemoved([tx.id]);
            toast.error('Failed to delete: ' + getErrorMessage(error));
        } finally {
            mutatingRef.current = false;
        }
    };

    // A transfer is two rows sharing `transfer_pair_id` — an outflow on one account
    // and an inflow on the other. Deleting one leg used to leave the other behind,
    // so the destination kept money that never left the source.
    const handleDeleteTransfer = async (tx: Transaction) => {
        const pairId = tx.transfer_pair_id;
        if (!pairId) return;
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            // The other leg may not be loaded here (account filter), so its id isn't
            // known to queue; deleting by pair needs the server.
            toast.error('Deleting a transfer needs a connection — try again when online');
            return;
        }
        if (mutatingRef.current) return;
        mutatingRef.current = true;
        const previousServerTransactions = [...serverTransactions];
        const legIds = serverTransactions.filter(t => t.transfer_pair_id === pairId).map(t => t.id);
        setServerTransactions(prev => prev.filter(t => t.transfer_pair_id !== pairId));
        markRemoved(legIds);
        try {
            const { data, error } = await supabase
                .from('transactions')
                .delete()
                .eq('transfer_pair_id', pairId)
                .eq('is_transfer', true)
                .select('id');
            if (error) throw error;
            if (!data || data.length === 0) throw new Error('Transfer not found');
            markRemoved(data.map(r => r.id));
            invalidateTransactionCaches();
            toast.success('Transfer deleted');
        } catch (error) {
            setServerTransactions(previousServerTransactions);
            unmarkRemoved(legIds);
            toast.error('Failed to delete transfer: ' + getErrorMessage(error));
        } finally {
            mutatingRef.current = false;
        }
    };

    const handleUpdateTransaction = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTransaction) return;
        // A pending row's id is its queue id — no server row has it, so the update
        // matched nothing and the edit was silently lost. The row hides Edit for
        // pending rows; this is the backstop.
        if (editingTransaction._pending || editingTransaction._failed) {
            toast.error("This expense hasn't synced yet — edit it once it has");
            return;
        }
        if (editingTransaction.is_transfer) {
            toast.error("Transfers can't be edited — delete it and record it again");
            return;
        }
        const newAmount = Number(editingTransaction.amount);
        if (!Number.isFinite(newAmount) || newAmount <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }
        if (mutatingRef.current) return;
        mutatingRef.current = true;

        const previousServerTransactions = [...serverTransactions];
        const savedEditingTx = editingTransaction;

        // converted_amount is the whole row in base_currency at write time, and
        // resolveAmountIn scales it by share/amount — so after €100→€50 a stale
        // converted_amount kept the row totalling €100's worth. The stored rate is
        // still the right one (same date, same pair), so re-derive from it. A null
        // rate leaves nothing to derive from, so clear it and let the live rate apply.
        const original = serverTransactions.find(t => t.id === savedEditingTx.id);
        const amountChanged = !original || Number(original.amount) !== newAmount;
        const rate = Number(savedEditingTx.exchange_rate);
        const conversionPatch = amountChanged
            ? { converted_amount: Number.isFinite(rate) && rate > 0 ? newAmount * rate : null }
            : {};

        const patch = {
            description: savedEditingTx.description,
            category: savedEditingTx.category,
            amount: newAmount,
            ...conversionPatch,
            bucket_id: savedEditingTx.bucket_id || null,
            account_id: savedEditingTx.account_id || null,
            exclude_from_allowance: savedEditingTx.exclude_from_allowance || false,
            place_name: savedEditingTx.place_name || null,
            place_address: savedEditingTx.place_address || null,
            place_lat: savedEditingTx.place_lat || null,
            place_lng: savedEditingTx.place_lng || null,
        };

        // Optimistic: update in UI immediately
        setServerTransactions(prev => prev.map(tx =>
            tx.id === savedEditingTx.id
                ? { ...tx, ...savedEditingTx, amount: newAmount, converted_amount: 'converted_amount' in conversionPatch ? (conversionPatch.converted_amount ?? undefined) : tx.converted_amount }
                : tx
        ));
        toast.success('Transaction updated');
        setIsEditOpen(false);
        setEditingTransaction(null);

        // Offline: queue the update; optimistic UI is already applied above.
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            try {
                await enqueueMutation('UPDATE_TRANSACTION', { id: savedEditingTx.id, patch });
            } catch (error) {
                setServerTransactions(previousServerTransactions);
                const msg = getErrorMessage(error);
                if (getErrorName(error) === 'QueueFullError') {
                    toast.error(msg);
                } else {
                    toast.error('Failed to queue update: ' + msg);
                }
            } finally {
                mutatingRef.current = false;
            }
            return;
        }

        try {
            const { data: updated, error } = await supabase
                .from('transactions')
                .update(patch)
                .eq('id', savedEditingTx.id)
                .select('id');

            if (error) throw error;
            // RLS-filtered or already-deleted rows answer with no error and no rows.
            if (!updated || updated.length === 0) throw new Error('this transaction can no longer be edited');
            invalidateTransactionCaches();
        } catch (error) {
            // Rollback on failure
            setServerTransactions(previousServerTransactions);
            toast.error('Failed to update: ' + getErrorMessage(error));
        } finally {
            mutatingRef.current = false;
        }
    };

    // Supabase URL length limit on .in() — split big batches into chunks to be safe.
    const BULK_CHUNK = 100;

    // Mirrors the row's own gate (isRowMutable): pending rows aren't on the server,
    // a split or settlement is locked by RLS, and a transfer leg must move with its
    // pair. Callers outside the dashboard list don't filter, so this is enforced here.
    const isBulkEligible = (t: Transaction) =>
        !t._pending && !t._failed && !t.is_settlement && !t.is_transfer
        && !(t.splits && t.splits.length > 0) && t.user_id === userId;

    const handleBulkDelete = async (txs: Transaction[]): Promise<{ count: number }> => {
        // Offline-pending rows can't be bulk-deleted via supabase — they aren't on
        // the server yet. Filter them out; the caller can use single-row delete for those.
        const eligible = txs.filter(isBulkEligible);
        if (eligible.length === 0) return { count: 0 };
        if (mutatingRef.current) return { count: 0 };
        mutatingRef.current = true;

        const ids = eligible.map(t => t.id);
        const idSet = new Set(ids);
        const previousServerTransactions = [...serverTransactions];
        setServerTransactions(prev => prev.filter(t => !idSet.has(t.id)));
        markRemoved(ids);

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            // allSettled, not all: `all` rejects on the first failure while the
            // remaining enqueues still land, so the old code rolled the UI back and
            // said "Failed to queue deletes" for deletes that were in fact queued.
            const results = await Promise.allSettled(
                ids.map(id => enqueueMutation('DELETE_TRANSACTION', { id })),
            );
            const queuedIds = ids.filter((_, i) => results[i].status === 'fulfilled');
            const firstRejection = results.find(r => r.status === 'rejected') as PromiseRejectedResult | undefined;
            mutatingRef.current = false;

            if (queuedIds.length === 0) {
                setServerTransactions(previousServerTransactions);
                unmarkRemoved(ids);
                const err = firstRejection?.reason;
                toast.error(getErrorName(err) === 'QueueFullError' ? getErrorMessage(err) : 'Failed to queue deletes');
                return { count: 0 };
            }
            if (queuedIds.length < ids.length) {
                // Restore only the rows that did NOT get queued.
                const queuedSet = new Set(queuedIds);
                setServerTransactions(previousServerTransactions.filter(t => !queuedSet.has(t.id)));
                unmarkRemoved(ids.filter(id => !queuedSet.has(id)));
                toast.error(`Queued ${queuedIds.length} of ${ids.length} — the rest failed and are still listed`);
                return { count: queuedIds.length };
            }
            toast.success(`Queued ${ids.length} for deletion`);
            return { count: ids.length };
        }

        // Track chunks that actually committed, so a mid-run failure doesn't resurrect
        // rows that are already gone server-side.
        const deletedIds: string[] = [];
        try {
            for (let i = 0; i < ids.length; i += BULK_CHUNK) {
                const slice = ids.slice(i, i + BULK_CHUNK);
                // `.select()` returns the rows actually deleted. RLS filters a row it
                // won't let you delete without raising an error, so counting the
                // request instead of the response announced "Deleted N" for rows that
                // were still there.
                const { data, error } = await supabase.from('transactions').delete().in('id', slice).select('id');
                if (error) throw error;
                deletedIds.push(...(data ?? []).map(r => r.id));
            }
            invalidateTransactionCaches();
            const deletedSet = new Set(deletedIds);
            if (deletedIds.length < ids.length) {
                const kept = ids.filter(id => !deletedSet.has(id));
                setServerTransactions(previousServerTransactions.filter(t => !deletedSet.has(t.id)));
                unmarkRemoved(kept);
            }
            // Best-effort receipt cleanup for the deleted rows.
            for (const tx of eligible) {
                if (tx.receipt_path && deletedSet.has(tx.id)) {
                    deleteReceipt(tx.receipt_path).catch(err => {
                        console.error('[useDashboardData] bulk receipt cleanup failed', err);
                    });
                }
            }
            if (deletedIds.length === 0) {
                toast.error("None of those could be deleted");
            } else if (deletedIds.length < ids.length) {
                toast.error(`Deleted ${deletedIds.length} of ${ids.length} — the rest can't be deleted and are still listed`);
            } else {
                toast.success(`Deleted ${ids.length} transaction${ids.length === 1 ? '' : 's'}`);
            }
            // Intentionally NOT dispatching `novira:expense-added` here. That
            // event makes the dashboard refetch everything, racing Postgres
            // replication and re-introducing the just-deleted rows for a
            // split second before realtime DELETE catches up. Buckets and
            // groups providers already have their own realtime subs on
            // `transactions`, so they refresh on their own.
            return { count: deletedIds.length };
        } catch (error) {
            // Put back only what's still on the server. Restoring the whole
            // pre-delete list made already-deleted rows reappear.
            const deletedSet = new Set(deletedIds);
            setServerTransactions(previousServerTransactions.filter(t => !deletedSet.has(t.id)));
            unmarkRemoved(ids.filter(id => !deletedSet.has(id)));
            if (deletedIds.length > 0) {
                invalidateTransactionCaches();
                for (const tx of eligible) {
                    if (deletedSet.has(tx.id) && tx.receipt_path) {
                        deleteReceipt(tx.receipt_path).catch(err => {
                            console.error('[useDashboardData] bulk receipt cleanup failed', err);
                        });
                    }
                }
                toast.error(`Deleted ${deletedIds.length} of ${ids.length} — the rest failed and are still listed`);
            } else {
                toast.error('Bulk delete failed: ' + getErrorMessage(error, 'unknown error'));
            }
            return { count: deletedIds.length };
        } finally {
            mutatingRef.current = false;
        }
    };

    const handleBulkUpdate = async (
        txs: Transaction[],
        patch: { category?: string; bucket_id?: string | null; account_id?: string | null; exclude_from_allowance?: boolean },
    ): Promise<{ count: number }> => {
        const eligible = txs.filter(isBulkEligible);
        if (eligible.length === 0) return { count: 0 };
        if (mutatingRef.current) return { count: 0 };
        mutatingRef.current = true;

        const ids = eligible.map(t => t.id);
        const idSet = new Set(ids);
        const previousServerTransactions = [...serverTransactions];
        // Local Transaction type uses `?: string` (not `| null`), so coerce a
        // null bucket_id to undefined for the in-memory patch.
        const localPatch: Partial<Transaction> = {
            ...(patch.category !== undefined ? { category: patch.category } : {}),
            ...(patch.exclude_from_allowance !== undefined ? { exclude_from_allowance: patch.exclude_from_allowance } : {}),
            ...(patch.bucket_id !== undefined ? { bucket_id: patch.bucket_id ?? undefined } : {}),
            ...(patch.account_id !== undefined ? { account_id: patch.account_id ?? null } : {}),
        };
        setServerTransactions(prev => prev.map(t => idSet.has(t.id) ? { ...t, ...localPatch } : t));

        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            try {
                await Promise.all(ids.map(id => enqueueMutation('UPDATE_TRANSACTION', { id, patch })));
                toast.success(`Queued ${ids.length} updates`);
                mutatingRef.current = false;
                return { count: ids.length };
            } catch (err) {
                setServerTransactions(previousServerTransactions);
                toast.error(getErrorName(err) === 'QueueFullError' ? getErrorMessage(err) : 'Failed to queue updates');
                mutatingRef.current = false;
                return { count: 0 };
            }
        }

        try {
            const updatedIds: string[] = [];
            for (let i = 0; i < ids.length; i += BULK_CHUNK) {
                const slice = ids.slice(i, i + BULK_CHUNK);
                const { data, error } = await supabase.from('transactions').update(patch).in('id', slice).select('id');
                if (error) throw error;
                updatedIds.push(...(data ?? []).map(r => r.id));
            }
            invalidateTransactionCaches();
            if (updatedIds.length < ids.length) {
                // Revert the optimistic patch on rows RLS silently skipped.
                const updatedSet = new Set(updatedIds);
                const previousById = new Map(previousServerTransactions.map(t => [t.id, t]));
                setServerTransactions(prev => prev.map(t =>
                    idSet.has(t.id) && !updatedSet.has(t.id) ? (previousById.get(t.id) ?? t) : t
                ));
                toast.error(updatedIds.length === 0
                    ? "None of those could be updated"
                    : `Updated ${updatedIds.length} of ${ids.length} — the rest can't be changed`);
                return { count: updatedIds.length };
            }
            toast.success(`Updated ${ids.length} transaction${ids.length === 1 ? '' : 's'}`);
            // See handleBulkDelete: skipping the novira:expense-added dispatch
            // on purpose. Realtime UPDATE events propagate to dashboard /
            // buckets / groups; the dispatch would force a refetch that races
            // replication and momentarily reverts the optimistic state.
            return { count: ids.length };
        } catch (error) {
            setServerTransactions(previousServerTransactions);
            toast.error('Bulk update failed: ' + getErrorMessage(error, 'unknown error'));
            return { count: 0 };
        } finally {
            mutatingRef.current = false;
        }
    };

    // useCallback with no deps: the body touches only useState setters (stable) and
    // the module-level `supabase`/`toast`. Stable identity matters because this is
    // handed straight to every TransactionRow as `onHistory`, and an unstable
    // function prop defeats that row's memo on its own.
    const loadAuditLogs = useCallback(async (tx: Transaction) => {
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
        } catch (error) {
            if (process.env.NODE_ENV === 'development') {
                console.error("Error loading audit logs:", error);
            }
            toast.error("Failed to load history");
        } finally {
            setLoadingAudit(false);
        }
    }, []);

    // Merge pending (offline-queued) items on top of server-fetched transactions.
    // Dedupe by id to handle the rare case where a server row arrives with the same id
    // as a still-pending queue entry (e.g. via realtime before the queue event fires).
    const applyOverlay = useCallback((rows: Transaction[]): Transaction[] => {
        const { deletes, patches } = queuedOverlay;
        if (deletes.size === 0 && patches.size === 0 && locallyRemoved.size === 0) return rows;
        const out: Transaction[] = [];
        for (const t of rows) {
            if (deletes.has(t.id) || locallyRemoved.has(t.id)) continue;
            const p = patches.get(t.id);
            out.push(p ? { ...t, ...p } : t);
        }
        return out;
    }, [queuedOverlay, locallyRemoved]);

    const transactions = useMemo<Transaction[]>(() => {
        const server = applyOverlay(serverTransactions);
        if (pendingTransactions.length === 0) return server;
        const pendingIds = new Set(pendingTransactions.map(t => t.id));
        return [
            ...pendingTransactions,
            ...server.filter(t => !pendingIds.has(t.id))
        ];
    }, [pendingTransactions, serverTransactions, applyOverlay]);

    // Stats rows: the month-bounded fetch, with the list's copy winning wherever both
    // have a row (realtime and optimistic edits patch the list first), plus pending adds.
    const statsTransactions = useMemo<Transaction[]>(() => {
        const since = statsWindowStart();
        const byId = new Map<string, Transaction>();
        for (const t of statsServerTransactions) byId.set(t.id, t);
        for (const t of serverTransactions) {
            if (t.date.slice(0, 10) >= since) byId.set(t.id, t);
        }
        const server = applyOverlay([...byId.values()]);
        const pending = pendingTransactions.filter(t => t.date.slice(0, 10) >= since);
        if (pending.length === 0) return server;
        const pendingIds = new Set(pending.map(t => t.id));
        return [...pending, ...server.filter(t => !pendingIds.has(t.id))];
    }, [statsServerTransactions, serverTransactions, pendingTransactions, applyOverlay]);

    return {
        transactions,
        statsTransactions,
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
        handleBulkDelete,
        handleBulkUpdate,
        loadAuditLogs
    };
}
