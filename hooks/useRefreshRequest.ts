'use client';

import { useEffect, useRef } from 'react';

/**
 * Opts a view into the shell's pull-to-refresh gesture.
 *
 * `mobile-layout` dispatches `novira-refresh-requested` with a `waitUntil` callback;
 * whatever promise we hand back keeps the spinner up until the refetch settles. A route
 * listed in that file's `PTR_ROUTES` without a listener here just spins and does nothing.
 */
export function useRefreshRequest(refetch: () => Promise<unknown> | undefined | void) {
    // Held in a ref so a caller passing an inline arrow doesn't re-bind the listener
    // on every render.
    const refetchRef = useRef(refetch);
    refetchRef.current = refetch;

    useEffect(() => {
        const onRefresh = (e: WindowEventMap['novira-refresh-requested']) => {
            const p = refetchRef.current?.();
            if (p) e.detail?.waitUntil?.(p);
        };
        window.addEventListener('novira-refresh-requested', onRefresh);
        return () => window.removeEventListener('novira-refresh-requested', onRefresh);
    }, []);
}
