import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Transaction } from '@/types/transaction';
import { applyWorkspaceFilter } from '@/lib/workspace-filter';
import { reportNetworkError } from '@/lib/network-error-bus';
import { useRealtimeRefetch } from '@/hooks/useRealtimeRefetch';

// Located rows are a small subset of all transactions, but cap defensively so a
// pathological account can't pull an unbounded payload into the map.
const MAP_TX_LIMIT = 5000;

// Only the fields the map actually reads — far lighter than the dashboard's full select.
const MAP_TX_SELECT =
    'id, description, amount, category, date, created_at, user_id, currency, place_name, place_address, place_lat, place_lng, profile:profiles(full_name, avatar_url)';

/**
 * Fetches *all* geo-tagged transactions for the active workspace when the map opens,
 * instead of relying on the dashboard's paginated 100-row slice. Result is cached per
 * (user, workspace) for the session so reopening is instant, and refreshed in place
 * when a transaction changes while the map is open.
 *
 * `mapTransactions` stays null until the first successful fetch — callers should fall back
 * to the dashboard's loaded list so the map never regresses to blank offline / mid-fetch.
 */
export function useMapTransactions(
    userId: string | null,
    activeWorkspaceId: string | null,
    isOpen: boolean,
) {
    const [mapTransactions, setMapTransactions] = useState<Transaction[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [truncated, setTruncated] = useState(false);
    const loadedKeyRef = useRef<string | null>(null);
    // Bumped per fetch so a slow response can't land on top of a newer one.
    const fetchGenRef = useRef(0);

    const load = useCallback(async (opts: { force?: boolean } = {}) => {
        if (!userId) return;
        const key = `${userId}:${activeWorkspaceId ?? 'personal'}`;
        if (!opts.force && loadedKeyRef.current === key) return;

        const myGen = ++fetchGenRef.current;
        setLoading(true);
        try {
            const baseQuery = supabase
                .from('transactions')
                .select(MAP_TX_SELECT)
                .not('place_lat', 'is', null)
                .not('place_lng', 'is', null)
                .order('date', { ascending: false })
                .limit(MAP_TX_LIMIT + 1);
            const { data, error } = await applyWorkspaceFilter(baseQuery, userId, activeWorkspaceId);
            if (fetchGenRef.current !== myGen) return;
            if (error) throw error;
            if (data) {
                const more = data.length > MAP_TX_LIMIT;
                const visible = more ? data.slice(0, MAP_TX_LIMIT) : data;
                const formatted = visible.map(tx => ({
                    ...tx,
                    profile: Array.isArray(tx.profile) ? tx.profile[0] : tx.profile,
                })) as Transaction[];
                setMapTransactions(formatted);
                setTruncated(more);
                loadedKeyRef.current = key;
            }
        } catch (error) {
            if (process.env.NODE_ENV === 'development') {
                console.error('Error loading map transactions:', error);
            }
            reportNetworkError({
                message: "Couldn't load map locations",
                source: 'useMapTransactions',
                // Clear the cache key so the next open retries.
                retry: () => { loadedKeyRef.current = null; },
            });
        } finally {
            if (fetchGenRef.current === myGen) setLoading(false);
        }
    }, [userId, activeWorkspaceId]);

    useEffect(() => {
        if (!isOpen) return;
        load();
    }, [isOpen, load]);

    // `force`, because the session cache key is already set — without it a pin
    // added or moved on another device would never reach an open map.
    useRealtimeRefetch(
        `map-tx-${userId ?? 'anon'}-${activeWorkspaceId ?? 'personal'}`,
        userId
            ? [activeWorkspaceId
                ? { table: 'transactions', filter: `group_id=eq.${activeWorkspaceId}` }
                : { table: 'transactions', filter: `user_id=eq.${userId}` }]
            : [],
        () => { load({ force: true }); },
        isOpen && !!userId,
    );

    return { mapTransactions, loading, truncated };
}
