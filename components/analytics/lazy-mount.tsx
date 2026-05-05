'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface Props {
    children: ReactNode;
    /** Reserve vertical space so layout doesn't jump when the card mounts. */
    placeholderHeight?: number;
    /** Distance below the viewport at which to start mounting. Default ~one screen. */
    rootMargin?: string;
}

/**
 * Defers rendering of `children` until the placeholder enters (or nears) the viewport.
 * Once mounted the component stays mounted — no remount on scroll out, so card state
 * (animations, fetched data) is preserved.
 */
export function LazyMount({ children, placeholderHeight = 200, rootMargin = '300px' }: Props) {
    const ref = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        if (mounted) return;
        const node = ref.current;
        if (!node) return;
        if (typeof IntersectionObserver === 'undefined') {
            setMounted(true);
            return;
        }
        const obs = new IntersectionObserver(
            (entries) => {
                if (entries.some(e => e.isIntersecting)) {
                    setMounted(true);
                    obs.disconnect();
                }
            },
            { rootMargin }
        );
        obs.observe(node);
        return () => obs.disconnect();
    }, [mounted, rootMargin]);

    if (mounted) return <>{children}</>;
    return <div ref={ref} style={{ minHeight: placeholderHeight }} aria-hidden />;
}
