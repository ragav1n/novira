'use client';

// Slim bulk-action toolbar used by the Search view. Has only delete +
// recategorize and delegates recategorize to a separate RecategorizeSheet.
// The dashboard list uses `components/bulk-action-bar.tsx` instead, which
// embeds its own category/bucket/account pickers.

import { motion, AnimatePresence } from 'framer-motion';
import { CheckSquare, Tag, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
    visible: boolean;
    selectedCount: number;
    totalCount: number;
    /** Disables action buttons while a bulk mutation is in flight. */
    busy?: boolean;
    onToggleSelectAll: () => void;
    onOpenRecategorize: () => void;
    onBulkDelete: () => void;
}

export function SearchBulkActionBar({
    visible,
    selectedCount,
    totalCount,
    busy = false,
    onToggleSelectAll,
    onOpenRecategorize,
    onBulkDelete,
}: Props) {
    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ y: 60, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 60, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                    className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-[80] flex items-center gap-2 px-3 py-2 rounded-2xl bg-card/95 backdrop-blur-xl border border-white/10 shadow-2xl max-w-[calc(100vw-1rem)] flex-wrap justify-center"
                >
                    <span className="text-xs font-semibold px-2">{selectedCount} selected</span>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={onToggleSelectAll}
                        disabled={totalCount === 0}
                        className="h-8 rounded-lg bg-secondary/20 border-white/10 text-xs"
                    >
                        <CheckSquare className="w-3.5 h-3.5 mr-1.5" />
                        {selectedCount === totalCount && totalCount > 0 ? 'Clear' : 'Select all'}
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={onOpenRecategorize}
                        disabled={selectedCount === 0 || busy}
                        className="h-8 rounded-lg bg-secondary/20 border-white/10 text-xs"
                    >
                        <Tag className="w-3.5 h-3.5 mr-1.5" /> Recategorize
                    </Button>
                    <Button
                        size="sm"
                        onClick={onBulkDelete}
                        disabled={selectedCount === 0 || busy}
                        aria-busy={busy}
                        className="h-8 rounded-lg bg-rose-500/20 border border-rose-500/30 text-rose-300 hover:bg-rose-500/30 text-xs disabled:opacity-50"
                    >
                        {busy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
                        {busy ? 'Working…' : 'Delete'}
                    </Button>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
