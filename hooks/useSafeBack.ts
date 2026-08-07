'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

/**
 * `router.back()` with a fallback destination.
 *
 * A PWA cold-started or deep-linked onto a sub-page (`/settings`, `/receipts`,
 * `/import`) has no history entry to pop, so a plain `router.back()` does nothing and
 * the back button looks broken. `history.length <= 1` means this entry is the first in
 * the session, so we navigate to `fallback` instead.
 */
export function useSafeBack(fallback: string = '/') {
    const router = useRouter();
    return useCallback(() => {
        if (typeof window !== 'undefined' && window.history.length > 1) {
            router.back();
        } else {
            router.push(fallback);
        }
    }, [router, fallback]);
}
