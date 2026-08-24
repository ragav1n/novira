'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export interface RealtimeWatch {
    table: string;
    /** PostgREST filter, e.g. `user_id=eq.<id>`. Omit to watch every visible row (RLS still applies). */
    filter?: string;
    event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
}

/**
 * Watch one or more tables and re-run `refetch` whenever a change lands.
 *
 * Views that own a query but no subscription were the second half of the
 * "nothing updates live" problem — the calendar, the map, a trip's spend, the
 * rules list. They all want the same three lines, so they share them here rather
 * than each growing its own effect to drift out of sync.
 *
 * Pass `watches` as a value that changes only when the subscription genuinely
 * should be rebuilt; it is compared structurally, so a fresh array literal per
 * render is fine.
 */
export function useRealtimeRefetch(
    name: string,
    watches: RealtimeWatch[],
    refetch: () => void,
    enabled: boolean = true,
) {
    // Held in a ref so an inline arrow doesn't tear down the channel every render.
    const refetchRef = useRef(refetch);
    refetchRef.current = refetch;

    const watchKey = JSON.stringify(watches);

    useEffect(() => {
        if (!enabled) return;
        const parsed: RealtimeWatch[] = JSON.parse(watchKey);
        if (parsed.length === 0) return;

        // One burst of writes (a split insert plus its parent transaction, a
        // batch settle) fires several events; coalesce them into one refetch.
        let timer: ReturnType<typeof setTimeout> | null = null;
        const schedule = () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                timer = null;
                refetchRef.current();
            }, 150);
        };

        // The topic must be unique per subscription instance, not per user or per
        // view. Reusing one means the new channel joins while the previous channel
        // of the same name is still unsubscribing, and the join never completes
        // (CLOSED → TIMED_OUT), silently killing realtime for the whole session.
        let channel = supabase.channel(`${name}-${crypto.randomUUID()}`);
        for (const watch of parsed) {
            channel = channel.on(
                'postgres_changes',
                {
                    event: watch.event ?? '*',
                    schema: 'public',
                    table: watch.table,
                    ...(watch.filter ? { filter: watch.filter } : {}),
                } as never,
                schedule,
            );
        }
        channel.subscribe();

        return () => {
            if (timer) clearTimeout(timer);
            supabase.removeChannel(channel);
        };
    }, [name, watchKey, enabled]);
}
