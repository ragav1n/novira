import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Transaction } from '@/types/transaction';
import { applyWorkspaceFilter } from '@/lib/workspace-filter';
import { reportNetworkError } from '@/lib/network-error-bus';

// Located rows are a small subset of all transactions, but cap defensively so a
// pathological account can't pull an unbounded payload into the map.
const MAP_TX_LIMIT = 5000;

// Only the fields the map actually reads — far lighter than the dashboard's full select.
const MAP_TX_SELECT =
    'id, description, amount, category, date, created_at, user_id, currency, place_name, place_address, place_lat, place_lng, profile:profiles(full_name, avatar_url)';

/**
 * Fetches *all* geo-tagged transactions for the active workspace when the map opens,
 * instead of relying on the dashboard's paginated 100-row slice. Result is cached per
 * (user, workspace) for the session so reopening is instant.
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

    useEffect(() => {
        if (!isOpen || !userId) return;
        const key = `${userId}:${activeWorkspaceId ?? 'personal'}`;
        if (loadedKeyRef.current === key) return;

        let cancelled = false;
        setLoading(true);
        (async () => {
            try {
                const baseQuery = supabase
                    .from('transactions')
                    .select(MAP_TX_SELECT)
                    .not('place_lat', 'is', null)
                    .not('place_lng', 'is', null)
                    .order('date', { ascending: false })
                    .limit(MAP_TX_LIMIT + 1);
                const { data, error } = await applyWorkspaceFilter(baseQuery, userId, activeWorkspaceId);
                if (cancelled) return;
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
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [isOpen, userId, activeWorkspaceId]);

    return { mapTransactions, loading, truncated };
}
