'use client';

import { useCallback, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import { useRealtimeRefetch } from '@/hooks/useRealtimeRefetch';

type Nav = Navigator & {
    setAppBadge?: (count?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
};

export function useAppBadge(userId: string | null) {
    // Bumped per run so a slow count can't overwrite a newer badge.
    const genRef = useRef(0);

    // No badge API (any iOS browser, Firefox) means no timer and no channel.
    const badgeSupported =
        typeof navigator !== 'undefined' &&
        typeof (navigator as Nav).setAppBadge === 'function' &&
        typeof (navigator as Nav).clearAppBadge === 'function';

    const run = useCallback(async () => {
        if (typeof window === 'undefined') return;
        const nav = navigator as Nav;
        if (!nav.setAppBadge || !nav.clearAppBadge) return;

        const myGen = ++genRef.current;
        if (!userId) {
            try { await nav.clearAppBadge(); } catch { /* ignore */ }
            return;
        }
        try {
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            const { count, error } = await supabase
                .from('recurring_templates')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('is_active', true)
                .lte('next_occurrence', todayStr);
            if (genRef.current !== myGen) return;
            if (error) {
                await nav.clearAppBadge();
                return;
            }
            const n = count ?? 0;
            if (n > 0) await nav.setAppBadge(n);
            else await nav.clearAppBadge();
        } catch {
            try { await nav.clearAppBadge(); } catch { /* ignore */ }
        }
    }, [userId]);

    useEffect(() => {
        if (!badgeSupported) return;
        run();

        const onVisibility = () => {
            if (document.visibilityState === 'visible') run();
        };
        document.addEventListener('visibilitychange', onVisibility);
        const interval = window.setInterval(run, 15 * 60 * 1000);

        return () => {
            document.removeEventListener('visibilitychange', onVisibility);
            window.clearInterval(interval);
        };
    }, [run, badgeSupported]);

    // The 15-minute poll meant a bill paid on another device left the badge dot
    // sitting on the icon for up to a quarter of an hour.
    useRealtimeRefetch(
        `app-badge-${userId ?? 'anon'}`,
        userId ? [{ table: 'recurring_templates', filter: `user_id=eq.${userId}` }] : [],
        run,
        badgeSupported && !!userId,
    );
}
