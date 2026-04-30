'use client';

import React, { useEffect, useRef, useState, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface HolographicCardProps {
    children: ReactNode;
    className?: string;
    intensity?: number;
}

export function HolographicCard({ children, className, intensity = 6 }: HolographicCardProps) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [reducedMotion, setReducedMotion] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        setReducedMotion(mq.matches);
        const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    const handleMove = (clientX: number, clientY: number) => {
        if (reducedMotion) return;
        const card = cardRef.current;
        if (!card) return;
        const rect = card.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const rotateX = ((y - cy) / cy) * intensity;
        const rotateY = ((cx - x) / cx) * intensity;
        card.style.setProperty('--holo-x', `${(x / rect.width) * 100}%`);
        card.style.setProperty('--holo-y', `${(y / rect.height) * 100}%`);
        card.style.transform = `perspective(1200px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    };

    const reset = () => {
        const card = cardRef.current;
        if (!card) return;
        card.style.transform = 'perspective(1200px) rotateX(0deg) rotateY(0deg)';
        card.style.setProperty('--holo-x', '50%');
        card.style.setProperty('--holo-y', '50%');
    };

    return (
        <div
            ref={cardRef}
            onMouseMove={reducedMotion ? undefined : (e) => handleMove(e.clientX, e.clientY)}
            onMouseLeave={reducedMotion ? undefined : reset}
            onTouchMove={reducedMotion ? undefined : (e) => {
                const t = e.touches[0];
                if (t) handleMove(t.clientX, t.clientY);
            }}
            onTouchEnd={reducedMotion ? undefined : reset}
            style={{
                transformStyle: 'preserve-3d',
                transition: reducedMotion ? 'none' : 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
                ['--holo-x' as string]: '50%',
                ['--holo-y' as string]: '50%',
            }}
            className={cn(
                'relative overflow-hidden rounded-3xl border border-primary/25',
                'bg-gradient-to-br from-card via-card/90 to-background',
                'shadow-[0_10px_50px_-15px_rgba(120,80,220,0.45)]',
                'will-change-transform',
                className
            )}
        >
            {/* Primary purple bloom that follows the cursor */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                    background:
                        'radial-gradient(circle at var(--holo-x) var(--holo-y), color-mix(in oklab, var(--primary) 35%, transparent) 0%, color-mix(in oklab, var(--primary) 12%, transparent) 35%, transparent 65%)',
                    transition: 'background 0.25s ease-out',
                }}
            />
            {/* Subtle indigo/violet sheen for depth — matches app palette, no rainbow */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-50 mix-blend-screen"
                style={{
                    background:
                        'conic-gradient(from 220deg at var(--holo-x) var(--holo-y), color-mix(in oklab, var(--primary) 18%, transparent), transparent 25%, color-mix(in oklab, var(--primary) 10%, transparent) 50%, transparent 75%, color-mix(in oklab, var(--primary) 18%, transparent))',
                    transition: 'background 0.25s ease-out',
                }}
            />
            {/* Bright specular highlight near the cursor */}
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{
                    background:
                        'radial-gradient(circle at var(--holo-x) var(--holo-y), rgba(255,255,255,0.10), transparent 22%)',
                    transition: 'background 0.2s ease-out',
                }}
            />
            {/* Inner ring for depth */}
            <div aria-hidden className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/5" />
            <div className="relative z-10">{children}</div>
        </div>
    );
}

export default HolographicCard;
