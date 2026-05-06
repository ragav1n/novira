'use client';

import { useEffect } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';

type Nav = Navigator & {
    setAppBadge?: (count?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
};

export function useAppBadge(userId: string | null) {
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const nav = navigator as Nav;
        if (!nav.setAppBadge || !nav.clearAppBadge) return;

        let cancelled = false;

        const run = async () => {
            if (!userId) {
                try { await nav.clearAppBadge!(); } catch { /* ignore */ }
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
                if (cancelled) return;
                if (error) {
                    await nav.clearAppBadge!();
                    return;
                }
                const n = count ?? 0;
                if (n > 0) await nav.setAppBadge!(n);
                else await nav.clearAppBadge!();
            } catch {
                try { await nav.clearAppBadge!(); } catch { /* ignore */ }
            }
        };

        run();

        const onVisibility = () => {
            if (document.visibilityState === 'visible') run();
        };
        document.addEventListener('visibilitychange', onVisibility);
        const interval = window.setInterval(run, 15 * 60 * 1000);

        return () => {
            cancelled = true;
            document.removeEventListener('visibilitychange', onVisibility);
            window.clearInterval(interval);
        };
    }, [userId]);
}
