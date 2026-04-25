'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCcw, AlertCircle, CloudOff } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { type SyncPayload } from '@/lib/offline-sync-queue';
import { retryFailedItem } from '@/lib/sync-manager';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

export function SyncIndicator() {
    const [isSyncing, setIsSyncing] = useState(false);
    const [failedCount, setFailedCount] = useState(0);
    const pathname = usePathname();
    const online = useOnlineStatus();

    const onQueueUpdated = useCallback((e: Event) => {
        const queue: SyncPayload[] = (e as CustomEvent<{ queue: SyncPayload[] }>).detail?.queue ?? [];
        setFailedCount(queue.filter(item => item.status === 'failed').length);
    }, []);

    const retryAll = useCallback(async () => {
        if (typeof window === 'undefined') return;
        const { get } = await import('idb-keyval');
        const queue: SyncPayload[] = (await get('novira-offline-queue')) ?? [];
        for (const item of queue.filter(i => i.status === 'failed')) {
            await retryFailedItem(item.id);
        }
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const onSyncStart = () => setIsSyncing(true);
        const onSyncEnd = () => setIsSyncing(false);

        window.addEventListener('novira-sync-started', onSyncStart);
        window.addEventListener('novira-sync-finished', onSyncEnd);
        window.addEventListener('novira-queue-updated', onQueueUpdated);

        return () => {
            window.removeEventListener('novira-sync-started', onSyncStart);
            window.removeEventListener('novira-sync-finished', onSyncEnd);
            window.removeEventListener('novira-queue-updated', onQueueUpdated);
        };
    }, [onQueueUpdated]);

    // Don't show on auth pages
    const isAuthPage = ['/signin', '/signup', '/forgot-password', '/update-password'].includes(pathname);
    if (isAuthPage) return null;

    return (
        <>
            <AnimatePresence>
                {isSyncing && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                        className="fixed top-2 lg:top-[72px] left-1/2 -translate-x-1/2 z-[60] flex items-center justify-center pointer-events-none"
                        style={{ willChange: "transform, opacity" }}
                    >
                        <div className="bg-background/80 backdrop-blur-md border border-white/10 shadow-lg rounded-full px-3 py-1.5 flex items-center gap-2">
                            <RefreshCcw className="w-3.5 h-3.5 text-primary animate-spin" />
                            <span className="text-xs font-medium text-muted-foreground">Syncing...</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {!online && !isSyncing && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                        className="fixed top-2 lg:top-[72px] left-1/2 -translate-x-1/2 z-[60] pointer-events-none"
                        style={{ willChange: "transform, opacity" }}
                    >
                        <div className="bg-amber-500/15 backdrop-blur-md border border-amber-500/20 shadow-lg rounded-full px-3 py-1.5 flex items-center gap-2">
                            <CloudOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="text-xs font-medium text-amber-300">Offline — changes will sync later</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {failedCount > 0 && !isSyncing && online && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                        className="fixed top-2 lg:top-[72px] left-1/2 -translate-x-1/2 z-[60] pointer-events-auto"
                        style={{ willChange: "transform, opacity" }}
                    >
                        <div className="bg-destructive/20 backdrop-blur-md border border-destructive/30 shadow-lg rounded-full px-3 py-1.5 flex items-center gap-2">
                            <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                            <span className="text-xs font-medium text-destructive">
                                {failedCount} {failedCount === 1 ? 'item' : 'items'} failed to sync
                            </span>
                            <button
                                onClick={retryAll}
                                className="text-xs text-destructive/80 hover:text-destructive underline ml-1"
                            >
                                Retry
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
