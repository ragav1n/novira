'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { AudioLines, Check, Coins, Tag as TagIcon, Wallet, StickyNote, AlignLeft, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCategoryLabel } from '@/lib/categories';
import { CURRENCY_SYMBOLS } from '@/components/providers/user-preferences-provider';
import type { ParsedVoiceExpense } from '@/lib/voice-expense-parser';

interface VoiceReviewModalProps {
    parsed: ParsedVoiceExpense | null;
    onApply: (parsed: ParsedVoiceExpense) => void;
    onDiscard: () => void;
}

type Row = {
    key: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: string | null;
    detected: boolean;
};

function buildRows(p: ParsedVoiceExpense): Row[] {
    const symbol = (p.currency && CURRENCY_SYMBOLS[p.currency as keyof typeof CURRENCY_SYMBOLS]) || '';
    const amountValue = p.amount !== null
        ? `${symbol}${Number(p.amount).toFixed(2)}${p.currency ? ` ${p.currency}` : ''}`
        : null;
    return [
        { key: 'amount', icon: Coins, label: 'Amount', value: amountValue, detected: p.amount !== null },
        { key: 'category', icon: ListChecks, label: 'Category', value: p.category ? getCategoryLabel(p.category) : null, detected: !!p.category },
        { key: 'payment', icon: Wallet, label: 'Payment', value: p.paymentMethod, detected: !!p.paymentMethod },
        { key: 'tags', icon: TagIcon, label: 'Tags', value: p.tags.length ? p.tags.map(t => `#${t}`).join('  ') : null, detected: p.tags.length > 0 },
        { key: 'notes', icon: StickyNote, label: 'Note', value: p.notes, detected: !!p.notes },
        { key: 'description', icon: AlignLeft, label: 'Description', value: p.description || null, detected: !!p.description },
    ];
}

const listVariants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.055, delayChildren: 0.12 } },
};

const rowVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 420, damping: 32 } },
};

export function VoiceReviewModal({ parsed, onApply, onDiscard }: VoiceReviewModalProps) {
    const [applying, setApplying] = useState(false);
    const applyRef = useRef<HTMLButtonElement>(null);
    const applyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Reset the confirm animation each time a fresh result opens the modal.
    useEffect(() => {
        if (parsed) setApplying(false);
    }, [parsed]);

    useEffect(() => () => {
        if (applyTimerRef.current) clearTimeout(applyTimerRef.current);
    }, []);

    const rows = parsed ? buildRows(parsed) : [];
    const detectedCount = rows.filter(r => r.detected).length;

    const handleApply = () => {
        if (!parsed || applying) return;
        setApplying(true);
        // Let the confirm pulse play before committing + closing.
        applyTimerRef.current = setTimeout(() => onApply(parsed), 280);
    };

    return (
        <DialogPrimitive.Root
            open={!!parsed}
            onOpenChange={(open) => { if (!open && !applying) onDiscard(); }}
        >
            <AnimatePresence>
                {parsed && (
                    <DialogPrimitive.Portal forceMount>
                        <DialogPrimitive.Overlay asChild forceMount>
                            <motion.div
                                className="fixed inset-0 z-[120] bg-black/65 backdrop-blur-sm"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                            />
                        </DialogPrimitive.Overlay>
                        <DialogPrimitive.Content
                            asChild
                            forceMount
                            onOpenAutoFocus={(e) => { e.preventDefault(); applyRef.current?.focus(); }}
                        >
                            <motion.div
                                className="fixed inset-x-0 bottom-0 z-[130] mx-auto w-full max-w-md rounded-t-3xl border-t border-x border-white/10 bg-background p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl"
                                initial={{ y: '102%' }}
                                animate={{ y: 0 }}
                                exit={{ y: '102%' }}
                                transition={{ type: 'spring', stiffness: 360, damping: 36 }}
                            >
                                {/* Grab handle */}
                                <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" aria-hidden="true" />

                                {/* Header */}
                                <div className="flex items-center gap-3">
                                    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-500/15 border border-rose-500/30">
                                        <AudioLines className="h-5 w-5 text-rose-300" aria-hidden="true" />
                                        <motion.span
                                            className="absolute inset-0 rounded-2xl border border-rose-400/40"
                                            animate={{ scale: [1, 1.35], opacity: [0.6, 0] }}
                                            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                                            aria-hidden="true"
                                        />
                                    </div>
                                    <div className="min-w-0">
                                        <DialogPrimitive.Title className="text-base font-bold text-foreground">
                                            Heard you
                                        </DialogPrimitive.Title>
                                        <DialogPrimitive.Description className="text-xs text-muted-foreground">
                                            {detectedCount > 0
                                                ? `${detectedCount} field${detectedCount === 1 ? '' : 's'} detected — review before applying`
                                                : 'Review what was captured'}
                                        </DialogPrimitive.Description>
                                    </div>
                                </div>

                                {/* Detected fields */}
                                <motion.div
                                    className="mt-4 space-y-1.5"
                                    variants={listVariants}
                                    initial="hidden"
                                    animate="show"
                                >
                                    {rows.map((row) => {
                                        const Icon = row.icon;
                                        return (
                                            <motion.div
                                                key={row.key}
                                                variants={rowVariants}
                                                className={cn(
                                                    'flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors',
                                                    row.detected
                                                        ? 'border-rose-500/20 bg-rose-500/[0.06]'
                                                        : 'border-white/5 bg-secondary/10',
                                                )}
                                            >
                                                <Icon
                                                    className={cn(
                                                        'h-4 w-4 shrink-0',
                                                        row.detected ? 'text-rose-300' : 'text-muted-foreground/50',
                                                    )}
                                                    aria-hidden="true"
                                                />
                                                <span className="w-20 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                    {row.label}
                                                </span>
                                                <span
                                                    className={cn(
                                                        'min-w-0 flex-1 truncate text-right text-sm font-medium',
                                                        row.detected ? 'text-foreground' : 'text-muted-foreground/40',
                                                    )}
                                                >
                                                    {row.detected ? row.value : '—'}
                                                </span>
                                            </motion.div>
                                        );
                                    })}
                                </motion.div>

                                {/* Footer */}
                                <div className="mt-5 flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={onDiscard}
                                        disabled={applying}
                                        className="h-12 flex-1 rounded-2xl border border-white/10 bg-secondary/20 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary/30 hover:text-foreground disabled:opacity-50"
                                    >
                                        Discard
                                    </button>
                                    <motion.button
                                        ref={applyRef}
                                        type="button"
                                        onClick={handleApply}
                                        disabled={applying}
                                        whileTap={{ scale: 0.97 }}
                                        animate={applying ? { scale: [1, 1.04, 1] } : { scale: 1 }}
                                        transition={{ duration: 0.28 }}
                                        className={cn(
                                            'relative h-12 flex-[1.4] overflow-hidden rounded-2xl text-sm font-bold transition-colors',
                                            applying
                                                ? 'bg-emerald-500 text-white'
                                                : 'bg-rose-500 text-white hover:bg-rose-500/90',
                                        )}
                                    >
                                        <AnimatePresence mode="wait" initial={false}>
                                            {applying ? (
                                                <motion.span
                                                    key="done"
                                                    className="absolute inset-0 flex items-center justify-center gap-1.5"
                                                    initial={{ opacity: 0, y: 8 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0 }}
                                                >
                                                    <Check className="h-4 w-4" aria-hidden="true" />
                                                    Applied
                                                </motion.span>
                                            ) : (
                                                <motion.span
                                                    key="apply"
                                                    className="absolute inset-0 flex items-center justify-center"
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                >
                                                    Apply to form
                                                </motion.span>
                                            )}
                                        </AnimatePresence>
                                    </motion.button>
                                </div>
                            </motion.div>
                        </DialogPrimitive.Content>
                    </DialogPrimitive.Portal>
                )}
            </AnimatePresence>
        </DialogPrimitive.Root>
    );
}
