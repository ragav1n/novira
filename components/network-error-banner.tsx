'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { WifiOff, RotateCw, X } from 'lucide-react';
import { subscribeNetworkError, type NetworkErrorDetail } from '@/lib/network-error-bus';

const AUTO_DISMISS_MS = 8000;

export function NetworkErrorBanner() {
    const [active, setActive] = useState<NetworkErrorDetail | null>(null);
    const dismissTimer = useRef<number | null>(null);

    useEffect(() => {
        const clearTimer = () => {
            if (dismissTimer.current !== null) {
                window.clearTimeout(dismissTimer.current);
                dismissTimer.current = null;
            }
        };

        const unsubscribe = subscribeNetworkError((detail) => {
            setActive(detail);
            clearTimer();
            dismissTimer.current = window.setTimeout(() => setActive(null), AUTO_DISMISS_MS);
        });

        return () => {
            unsubscribe();
            clearTimer();
        };
    }, []);

    return (
        <AnimatePresence>
            {active && (
                <motion.div
                    initial={{ opacity: 0, y: -16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -16 }}
                    transition={{ duration: 0.2 }}
                    role="status"
                    aria-live="polite"
                    className="fixed top-[env(safe-area-inset-top)] left-0 right-0 z-[1500] mx-auto mt-2 max-w-md px-3"
                >
                    <div className="flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-950/80 backdrop-blur-md px-3 py-2.5 shadow-[0_8px_30px_-8px_rgba(0,0,0,0.5)]">
                        <WifiOff className="w-4 h-4 text-rose-300 shrink-0" strokeWidth={2} />
                        <p className="flex-1 text-[12px] font-bold text-rose-100 truncate">
                            {active.message}
                        </p>
                        {active.retry && (
                            <button
                                onClick={() => {
                                    active.retry?.();
                                    setActive(null);
                                }}
                                className="text-[11px] font-bold uppercase tracking-wider text-rose-200 hover:text-white transition-colors flex items-center gap-1 shrink-0"
                                aria-label="Retry"
                            >
                                <RotateCw className="w-3.5 h-3.5" />
                                Retry
                            </button>
                        )}
                        <button
                            onClick={() => setActive(null)}
                            className="text-rose-300 hover:text-white transition-colors shrink-0"
                            aria-label="Dismiss"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
