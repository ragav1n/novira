'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCcw, AlertCircle, CloudOff, ChevronDown, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { type SyncPayload } from '@/lib/offline-sync-queue';
import { retryFailedItem, discardFailedItem } from '@/lib/sync-manager';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

const FRIENDLY_TYPE: Record<string, string> = {
    ADD_FULL_TRANSACTION: 'New transaction',
    DELETE_TRANSACTION: 'Delete transaction',
    UPDATE_TRANSACTION: 'Update transaction',
};

export function SyncIndicator() {
    const [isSyncing, setIsSyncing] = useState(false);
    const [failedItems, setFailedItems] = useState<SyncPayload[]>([]);
    const [expanded, setExpanded] = useState(false);
    const [evictionNotice, setEvictionNotice] = useState<{ count: number } | null>(null);
    const pathname = usePathname();
    const online = useOnlineStatus();

    const onQueueUpdated = useCallback((e: Event) => {
        const queue: SyncPayload[] = (e as CustomEvent<{ queue: SyncPayload[] }>).detail?.queue ?? [];
        setFailedItems(queue.filter(item => item.status === 'failed'));
    }, []);

    const retryAll = useCallback(async () => {
        for (const item of failedItems) {
            await retryFailedItem(item.id);
        }
        setExpanded(false);
    }, [failedItems]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const onSyncStart = () => setIsSyncing(true);
        const onSyncEnd = () => setIsSyncing(false);
        const onEvicted = (e: Event) => {
            const count = (e as CustomEvent<{ count: number }>).detail?.count ?? 0;
            if (count > 0) {
                setEvictionNotice({ count });
                setTimeout(() => setEvictionNotice(null), 6000);
            }
        };

        window.addEventListener('novira-sync-started', onSyncStart);
        window.addEventListener('novira-sync-finished', onSyncEnd);
        window.addEventListener('novira-queue-updated', onQueueUpdated);
        window.addEventListener('novira-queue-evicted', onEvicted);

        return () => {
            window.removeEventListener('novira-sync-started', onSyncStart);
            window.removeEventListener('novira-sync-finished', onSyncEnd);
            window.removeEventListener('novira-queue-updated', onQueueUpdated);
            window.removeEventListener('novira-queue-evicted', onEvicted);
        };
    }, [onQueueUpdated]);

    // Don't show on auth pages
    const isAuthPage = ['/signin', '/signup', '/forgot-password', '/update-password'].includes(pathname);
    if (isAuthPage) return null;

    const failedCount = failedItems.length;

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
                {evictionNotice && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                        className="fixed top-12 lg:top-[120px] left-1/2 -translate-x-1/2 z-[60] pointer-events-none px-2"
                        style={{ willChange: "transform, opacity" }}
                    >
                        <div className="bg-amber-500/15 backdrop-blur-md border border-amber-500/30 shadow-lg rounded-full px-3 py-1.5 flex items-center gap-2 max-w-[90vw]">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="text-xs font-medium text-amber-300 truncate">
                                Offline queue full — {evictionNotice.count} oldest {evictionNotice.count === 1 ? 'change' : 'changes'} dropped
                            </span>
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
                        className="fixed top-2 lg:top-[72px] left-1/2 -translate-x-1/2 z-[60] pointer-events-auto px-2 w-full max-w-md"
                        style={{ willChange: "transform, opacity" }}
                    >
                        <div className="bg-background/95 backdrop-blur-md border border-destructive/30 shadow-lg rounded-2xl overflow-hidden">
                            <button
                                onClick={() => setExpanded(v => !v)}
                                className="w-full px-3 py-1.5 flex items-center gap-2"
                                aria-expanded={expanded}
                                aria-label={expanded ? 'Collapse failed sync details' : 'Expand failed sync details'}
                            >
                                <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                                <span className="text-xs font-medium text-destructive flex-1 text-left">
                                    {failedCount} {failedCount === 1 ? 'item' : 'items'} failed to sync
                                </span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); retryAll(); }}
                                    className="text-xs text-destructive/80 hover:text-destructive underline"
                                >
                                    Retry all
                                </button>
                                <ChevronDown
                                    className={`w-3.5 h-3.5 text-destructive/70 transition-transform ${expanded ? 'rotate-180' : ''}`}
                                    aria-hidden="true"
                                />
                            </button>
                            <AnimatePresence initial={false}>
                                {expanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="border-t border-destructive/20 overflow-hidden"
                                    >
                                        <ul className="divide-y divide-destructive/10 max-h-64 overflow-y-auto">
                                            {failedItems.map(item => (
                                                <li key={item.id} className="px-3 py-2 flex items-start gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-xs font-medium text-foreground/90">
                                                            {FRIENDLY_TYPE[item.type] ?? item.type}
                                                        </div>
                                                        {item.errorReason && (
                                                            <div className="text-[11px] text-muted-foreground mt-0.5 break-words">
                                                                {item.errorReason}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        <button
                                                            onClick={() => retryFailedItem(item.id)}
                                                            className="text-[11px] text-primary hover:underline px-1.5 py-0.5"
                                                        >
                                                            Retry
                                                        </button>
                                                        <button
                                                            onClick={() => discardFailedItem(item.id)}
                                                            className="text-[11px] text-muted-foreground hover:text-destructive p-0.5"
                                                            aria-label="Discard this failed item"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
