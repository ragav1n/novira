'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistrar() {
    useEffect(() => {
        // Skip in dev — the SW's cache-first strategy for /_next/static/ serves
        // stale chunks against Fast Refresh. Test SW behavior via `next build && next start`.
        if (process.env.NODE_ENV !== 'production') return;
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js');
        }
    }, []);
    return null;
}
