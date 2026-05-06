'use client';

import { useEffect, useRef, useState } from 'react';

interface Options {
    threshold?: number;
    maxPull?: number;
    onRefresh: () => void | Promise<void>;
    enabled?: boolean;
}

/**
 * Touch-only pull-to-refresh on a scroll container. Activates only when the
 * container is already at scrollTop = 0, so it doesn't fight regular scrolling.
 * Calls onRefresh once the pull crosses `threshold` and the touch ends.
 */
export function usePullToRefresh(
    containerRef: React.RefObject<HTMLElement | null>,
    { threshold = 72, maxPull = 120, onRefresh, enabled = true }: Options
) {
    const [pull, setPull] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const startY = useRef<number | null>(null);
    const armed = useRef(false);
    const pullRef = useRef(0);
    const refreshingRef = useRef(false);
    const onRefreshRef = useRef(onRefresh);

    onRefreshRef.current = onRefresh;
    pullRef.current = pull;
    refreshingRef.current = refreshing;

    useEffect(() => {
        const el = containerRef.current;
        if (!el || !enabled) return;

        const onTouchStart = (e: TouchEvent) => {
            if (refreshingRef.current) return;
            if (el.scrollTop > 0) {
                armed.current = false;
                startY.current = null;
                return;
            }
            armed.current = true;
            startY.current = e.touches[0].clientY;
        };

        const onTouchMove = (e: TouchEvent) => {
            if (!armed.current || startY.current === null) return;
            const dy = e.touches[0].clientY - startY.current;
            if (dy <= 0) {
                if (pullRef.current !== 0) setPull(0);
                return;
            }
            const eased = Math.min(maxPull, dy * 0.5);
            setPull(eased);
        };

        const onTouchEnd = async () => {
            if (!armed.current) return;
            armed.current = false;
            const distance = pullRef.current;
            startY.current = null;
            if (distance >= threshold && !refreshingRef.current) {
                setRefreshing(true);
                setPull(threshold);
                try {
                    await onRefreshRef.current();
                } finally {
                    setRefreshing(false);
                    setPull(0);
                }
            } else {
                setPull(0);
            }
        };

        el.addEventListener('touchstart', onTouchStart, { passive: true });
        el.addEventListener('touchmove', onTouchMove, { passive: true });
        el.addEventListener('touchend', onTouchEnd);
        el.addEventListener('touchcancel', onTouchEnd);

        return () => {
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('touchmove', onTouchMove);
            el.removeEventListener('touchend', onTouchEnd);
            el.removeEventListener('touchcancel', onTouchEnd);
        };
    }, [containerRef, enabled, threshold, maxPull]);

    return { pull, refreshing, threshold };
}
