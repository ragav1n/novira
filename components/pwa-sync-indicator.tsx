'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCcw, AlertCircle, CloudOff, ChevronDown, X, Clock } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { type SyncErrorKind } from '@/lib/offline-sync-queue';
import { retryFailedItem, discardFailedItem, attemptSync } from '@/lib/sync-manager';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useSyncQueueState } from '@/hooks/use-sync-queue-state';

const FRIENDLY_TYPE: Record<string, string> = {
    ADD_FULL_TRANSACTION: 'New transaction',
    DELETE_TRANSACTION: 'Delete transaction',
    UPDATE_TRANSACTION: 'Update transaction',
};

type ErrorKindMeta = {
    badge: string;
    label: string;
    summary: string;
    showRetry: boolean;
    primary: 'retry' | 'discard';
};

// Each kind gets distinct copy + a different primary action so the user knows
// what's likely to help: retry rescues transient blips, discard ends permanent
// rejections, and expired items can't be retried at all (older than 7 days).
const ERROR_KIND_META: Record<SyncErrorKind, ErrorKindMeta> = {
    permanent: {
        badge: 'Permanent',
        label: "This change can't be saved.",
        summary: 'Permanent error — discard or fix and re-add.',
        showRetry: true,
        primary: 'discard',
    },
    transient: {
        badge: 'Network',
        label: "Couldn't reach the server.",
        summary: "Couldn't reach the server — retry?",
        showRetry: true,
        primary: 'retry',
    },
    expired: {
        badge: 'Expired',
        label: 'Older than 7 days — abandoned automatically.',
        summary: 'Abandoned (older than 7 days).',
        showRetry: false,
        primary: 'discard',
    },
};

function metaFor(kind: SyncErrorKind | undefined): ErrorKindMeta {
    return ERROR_KIND_META[kind ?? 'permanent'];
}

export function SyncIndicator() {
    const [isSyncing, setIsSyncing] = useState(false);
    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
    const [expanded, setExpanded] = useState(false);
    const [evictionNotice, setEvictionNotice] = useState<{ count: number } | null>(null);
    const [expiredNotice, setExpiredNotice] = useState<{ count: number } | null>(null);
    const pathname = usePathname();
    const online = useOnlineStatus();
    const { pending, failedItems } = useSyncQueueState();

    const retryAll = useCallback(async () => {
        for (const item of failedItems) {
            // Expired items can't be retried — discard instead so the user
            // doesn't see them silently re-fail.
            if (item.errorKind === 'expired') {
                await discardFailedItem(item.id);
            } else {
                await retryFailedItem(item.id);
            }
        }
        setExpanded(false);
    }, [failedItems]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const onSyncStart = (e: Event) => {
            const total = (e as CustomEvent<{ total?: number }>).detail?.total;
            setIsSyncing(true);
            if (typeof total === 'number') setProgress({ done: 0, total });
        };
        const onSyncEnd = () => {
            setIsSyncing(false);
            setProgress(null);
        };
        const onProgress = (e: Event) => {
            const detail = (e as CustomEvent<{ done: number; total: number }>).detail;
            if (detail) setProgress(detail);
        };
        // Eviction & expiration are data-loss events — let the user dismiss
        // them explicitly instead of auto-hiding after a few seconds.
        const onEvicted = (e: Event) => {
            const count = (e as CustomEvent<{ count: number }>).detail?.count ?? 0;
            if (count > 0) setEvictionNotice({ count });
        };
        const onExpired = (e: Event) => {
            const count = (e as CustomEvent<{ count: number }>).detail?.count ?? 0;
            if (count > 0) setExpiredNotice({ count });
        };

        window.addEventListener('novira-sync-started', onSyncStart);
        window.addEventListener('novira-sync-finished', onSyncEnd);
        window.addEventListener('novira-sync-progress', onProgress);
        window.addEventListener('novira-queue-evicted', onEvicted);
        window.addEventListener('novira-queue-expired', onExpired);

        return () => {
            window.removeEventListener('novira-sync-started', onSyncStart);
            window.removeEventListener('novira-sync-finished', onSyncEnd);
            window.removeEventListener('novira-sync-progress', onProgress);
            window.removeEventListener('novira-queue-evicted', onEvicted);
            window.removeEventListener('novira-queue-expired', onExpired);
        };
    }, []);

    // Don't show on auth pages
    const isAuthPage = ['/signin', '/signup', '/forgot-password', '/update-password'].includes(pathname);
    if (isAuthPage) return null;

    const failedCount = failedItems.length;
    const hasRetryableFailures = failedItems.some(it => it.errorKind !== 'expired');

    const syncingLabel = progress && progress.total > 0
        ? `Syncing ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…`
        : 'Syncing…';

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
                            <span className="text-xs font-medium text-muted-foreground">{syncingLabel}</span>
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
                            <span className="text-xs font-medium text-amber-300">
                                {pending > 0
                                    ? `Offline — ${pending} ${pending === 1 ? 'change' : 'changes'} will sync later`
                                    : 'Offline — changes will sync later'}
                            </span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {online && !isSyncing && pending > 0 && failedCount === 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                        className="fixed top-2 lg:top-[72px] left-1/2 -translate-x-1/2 z-[60] pointer-events-auto"
                        style={{ willChange: "transform, opacity" }}
                    >
                        <div className="bg-background/80 backdrop-blur-md border border-white/10 shadow-lg rounded-full pl-3 pr-1 py-1 flex items-center gap-2">
                            <RefreshCcw className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="text-xs font-medium text-muted-foreground">
                                {pending} {pending === 1 ? 'change' : 'changes'} pending
                            </span>
                            <button
                                onClick={() => attemptSync()}
                                className="text-xs font-medium text-primary hover:bg-primary/10 rounded-full px-2 py-0.5 transition-colors"
                            >
                                Sync now
                            </button>
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
                        className="fixed top-12 lg:top-[120px] left-1/2 -translate-x-1/2 z-[60] pointer-events-auto px-2"
                        style={{ willChange: "transform, opacity" }}
                    >
                        <div className="bg-amber-500/15 backdrop-blur-md border border-amber-500/30 shadow-lg rounded-full pl-3 pr-1 py-1 flex items-center gap-2 max-w-[90vw]">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="text-xs font-medium text-amber-300 truncate">
                                Offline queue full — {evictionNotice.count} oldest {evictionNotice.count === 1 ? 'change' : 'changes'} dropped
                            </span>
                            <button
                                onClick={() => setEvictionNotice(null)}
                                aria-label="Dismiss notice"
                                className="p-1 rounded-full hover:bg-amber-500/20 transition-colors shrink-0"
                            >
                                <X className="w-3 h-3 text-amber-300" />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {expiredNotice && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                        className="fixed top-12 lg:top-[120px] left-1/2 -translate-x-1/2 z-[60] pointer-events-auto px-2"
                        style={{ willChange: "transform, opacity" }}
                    >
                        <div className="bg-amber-500/15 backdrop-blur-md border border-amber-500/30 shadow-lg rounded-full pl-3 pr-1 py-1 flex items-center gap-2 max-w-[90vw]">
                            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="text-xs font-medium text-amber-300 truncate">
                                {expiredNotice.count} {expiredNotice.count === 1 ? 'change' : 'changes'} abandoned (older than 7 days)
                            </span>
                            <button
                                onClick={() => setExpiredNotice(null)}
                                aria-label="Dismiss notice"
                                className="p-1 rounded-full hover:bg-amber-500/20 transition-colors shrink-0"
                            >
                                <X className="w-3 h-3 text-amber-300" />
                            </button>
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
                                {hasRetryableFailures && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); retryAll(); }}
                                        className="text-xs text-destructive/80 hover:text-destructive underline"
                                    >
                                        Retry all
                                    </button>
                                )}
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
                                            {failedItems.map(item => {
                                                const meta = metaFor(item.errorKind);
                                                return (
                                                    <li key={item.id} className="px-3 py-2 flex items-start gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-xs font-medium text-foreground/90 flex items-center gap-1.5">
                                                                <span>{FRIENDLY_TYPE[item.type] ?? item.type}</span>
                                                                <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                                                                    item.errorKind === 'expired'
                                                                        ? 'bg-muted text-muted-foreground'
                                                                        : item.errorKind === 'transient'
                                                                            ? 'bg-amber-500/15 text-amber-400'
                                                                            : 'bg-destructive/15 text-destructive'
                                                                }`}>
                                                                    {meta.badge}
                                                                </span>
                                                            </div>
                                                            <div className="text-[11px] text-muted-foreground mt-0.5 break-words">
                                                                {item.errorReason || meta.summary}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            {meta.showRetry && (
                                                                <button
                                                                    onClick={() => retryFailedItem(item.id)}
                                                                    className={
                                                                        meta.primary === 'retry'
                                                                            ? 'text-[11px] text-primary hover:underline px-1.5 py-0.5 font-medium'
                                                                            : 'text-[11px] text-muted-foreground hover:text-primary px-1.5 py-0.5'
                                                                    }
                                                                >
                                                                    Retry
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => discardFailedItem(item.id)}
                                                                className={
                                                                    meta.primary === 'discard'
                                                                        ? 'text-[11px] text-destructive hover:underline px-1.5 py-0.5 font-medium'
                                                                        : 'text-[11px] text-muted-foreground hover:text-destructive p-0.5'
                                                                }
                                                                aria-label="Discard this failed item"
                                                            >
                                                                {meta.primary === 'discard' ? 'Discard' : <X className="w-3 h-3" />}
                                                            </button>
                                                        </div>
                                                    </li>
                                                );
                                            })}
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
