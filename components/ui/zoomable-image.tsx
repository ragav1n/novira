'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface Props {
    src: string;
    alt?: string;
    className?: string;
    containerClassName?: string;
    minScale?: number;
    maxScale?: number;
    /** Called on single tap if the user hasn't zoomed/panned — useful for dismiss-on-tap. */
    onTap?: () => void;
}

interface Point { x: number; y: number; }
interface TouchState {
    initialDist: number;
    initialScale: number;
    initialTx: number;
    initialTy: number;
    /** Pinch midpoint in container-local coords at touch start. */
    anchor: Point;
}
interface PanState {
    startX: number;
    startY: number;
    initialTx: number;
    initialTy: number;
    moved: boolean;
}

function distance(a: Touch, b: Touch): number {
    const dx = a.clientX - b.clientX;
    const dy = a.clientY - b.clientY;
    return Math.hypot(dx, dy);
}

function midpoint(a: Touch, b: Touch): Point {
    return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
}

/**
 * Pinch / pan / wheel / double-tap zoom for a single image, contained within
 * its parent's bounds. The container traps all touch and wheel events so the
 * page itself never scrolls or zooms while the user is interacting with the
 * image — the rest of the app stays still.
 *
 * - Touch: 2-finger pinch zooms around the midpoint; 1-finger drag pans (only
 *   when already zoomed).
 * - Wheel: scrolls in/out around the cursor.
 * - Double-tap / double-click: toggles between 1× and 2.5×.
 */
export function ZoomableImage({
    src,
    alt,
    className,
    containerClassName,
    minScale = 1,
    maxScale = 5,
    onTap,
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(1);
    const [tx, setTx] = useState(0);
    const [ty, setTy] = useState(0);

    // Refs mirror state so touch handlers (attached imperatively for { passive: false })
    // always read the latest values without forcing the listener to be re-bound on every change.
    const scaleRef = useRef(1);
    const txRef = useRef(0);
    const tyRef = useRef(0);
    scaleRef.current = scale;
    txRef.current = tx;
    tyRef.current = ty;

    const touchRef = useRef<TouchState | null>(null);
    const panRef = useRef<PanState | null>(null);
    const lastTapRef = useRef(0);

    // Reset transform when src changes (different image loaded).
    useEffect(() => {
        setScale(1); setTx(0); setTy(0);
    }, [src]);

    // Clamp pan so the image can't be dragged completely off-screen. We allow
    // the image edge to travel half the container width/height past center —
    // enough freedom at 2× to inspect any corner.
    const clampPan = useCallback((nextScale: number, nx: number, ny: number) => {
        const el = containerRef.current;
        if (!el) return { x: nx, y: ny };
        const rect = el.getBoundingClientRect();
        const overshootX = (rect.width * (nextScale - 1)) / 2;
        const overshootY = (rect.height * (nextScale - 1)) / 2;
        return {
            x: Math.max(-overshootX, Math.min(overshootX, nx)),
            y: Math.max(-overshootY, Math.min(overshootY, ny)),
        };
    }, []);

    const applyScale = useCallback((nextScale: number, focal?: Point) => {
        const clamped = Math.max(minScale, Math.min(maxScale, nextScale));
        const prevScale = scaleRef.current;
        const ratio = clamped / prevScale;
        // Zoom around a focal point (cursor / pinch midpoint, in container-local coords).
        // The math keeps the focal point stationary on screen as scale changes.
        const el = containerRef.current;
        let nx = txRef.current;
        let ny = tyRef.current;
        if (focal && el) {
            const rect = el.getBoundingClientRect();
            const cx = focal.x - rect.left - rect.width / 2;
            const cy = focal.y - rect.top - rect.height / 2;
            nx = cx - (cx - txRef.current) * ratio;
            ny = cy - (cy - tyRef.current) * ratio;
        }
        const clampedPan = clampPan(clamped, nx, ny);
        setScale(clamped);
        if (clamped <= 1) {
            setTx(0); setTy(0);
        } else {
            setTx(clampedPan.x); setTy(clampedPan.y);
        }
    }, [minScale, maxScale, clampPan]);

    // Touch handlers — bound imperatively so we can use { passive: false }
    // on touchmove to actually cancel default page scroll/zoom.
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;

        const onTouchStart = (e: TouchEvent) => {
            if (e.touches.length === 2) {
                panRef.current = null;
                touchRef.current = {
                    initialDist: distance(e.touches[0], e.touches[1]),
                    initialScale: scaleRef.current,
                    initialTx: txRef.current,
                    initialTy: tyRef.current,
                    anchor: midpoint(e.touches[0], e.touches[1]),
                };
            } else if (e.touches.length === 1) {
                touchRef.current = null;
                panRef.current = {
                    startX: e.touches[0].clientX,
                    startY: e.touches[0].clientY,
                    initialTx: txRef.current,
                    initialTy: tyRef.current,
                    moved: false,
                };
            }
        };

        const onTouchMove = (e: TouchEvent) => {
            // Always cancel default — the container's job is to own gesture inside its bounds.
            if (e.cancelable) e.preventDefault();
            if (e.touches.length === 2 && touchRef.current) {
                const t = touchRef.current;
                const newDist = distance(e.touches[0], e.touches[1]);
                const nextScale = Math.max(minScale, Math.min(maxScale, t.initialScale * (newDist / t.initialDist)));
                applyScale(nextScale, t.anchor);
            } else if (e.touches.length === 1 && panRef.current && scaleRef.current > 1) {
                const p = panRef.current;
                const dx = e.touches[0].clientX - p.startX;
                const dy = e.touches[0].clientY - p.startY;
                if (Math.abs(dx) > 4 || Math.abs(dy) > 4) p.moved = true;
                const clamped = clampPan(scaleRef.current, p.initialTx + dx, p.initialTy + dy);
                setTx(clamped.x); setTy(clamped.y);
            }
        };

        const onTouchEnd = (e: TouchEvent) => {
            const wasPanning = !!panRef.current && panRef.current.moved;
            touchRef.current = null;
            panRef.current = null;
            // Snap back to 1× if user accidentally zoomed below threshold.
            if (scaleRef.current < 1) {
                setScale(1); setTx(0); setTy(0);
            }
            // Double-tap toggle — only when not zoomed via pinch in this gesture.
            if (e.touches.length === 0 && !wasPanning) {
                const now = Date.now();
                if (now - lastTapRef.current < 300) {
                    const t = e.changedTouches[0];
                    if (scaleRef.current > 1) applyScale(1);
                    else applyScale(2.5, t ? { x: t.clientX, y: t.clientY } : undefined);
                    lastTapRef.current = 0;
                } else {
                    lastTapRef.current = now;
                }
            }
        };

        el.addEventListener('touchstart', onTouchStart, { passive: true });
        el.addEventListener('touchmove', onTouchMove, { passive: false });
        el.addEventListener('touchend', onTouchEnd);
        el.addEventListener('touchcancel', onTouchEnd);
        return () => {
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('touchmove', onTouchMove);
            el.removeEventListener('touchend', onTouchEnd);
            el.removeEventListener('touchcancel', onTouchEnd);
        };
    }, [applyScale, clampPan, minScale, maxScale]);

    // Wheel zoom for desktop. Non-passive so we can preventDefault and avoid
    // scrolling the surrounding dialog.
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.88 : 1.14;
            applyScale(scaleRef.current * delta, { x: e.clientX, y: e.clientY });
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, [applyScale]);

    const handleDoubleClick = (e: React.MouseEvent) => {
        if (scaleRef.current > 1) {
            applyScale(1);
        } else {
            applyScale(2.5, { x: e.clientX, y: e.clientY });
        }
    };

    const handleClick = () => {
        // Single-tap-to-dismiss is only meaningful at 1× — otherwise tap is part of zoom flow.
        if (onTap && scaleRef.current === 1) onTap();
    };

    return (
        <div
            ref={containerRef}
            className={cn('relative overflow-hidden select-none', containerClassName)}
            style={{ touchAction: 'none' }}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            role="img"
            aria-label={alt}
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={src}
                alt={alt}
                draggable={false}
                className={cn('pointer-events-none will-change-transform', className)}
                style={{
                    transform: `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`,
                    transformOrigin: 'center center',
                    transition: touchRef.current || panRef.current ? 'none' : 'transform 120ms ease-out',
                }}
            />
        </div>
    );
}
