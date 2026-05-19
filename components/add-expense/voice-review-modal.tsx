'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import { AudioLines, Check, X, Banknote, CreditCard, Smartphone, Landmark, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CATEGORIES, CATEGORY_COLORS, getIconForCategory } from '@/lib/categories';
import { CURRENCY_SYMBOLS } from '@/components/providers/user-preferences-provider';
import { CurrencyDropdown } from '@/components/ui/currency-dropdown';
import { geocodePlace, type GeocodedPlace } from '@/lib/geocode-place';
import type { ParsedVoiceExpense, VoicePaymentMethod } from '@/lib/voice-expense-parser';

interface VoiceReviewModalProps {
    parsed: ParsedVoiceExpense | null;
    currentCurrency: string;
    // Current GPS position — biases the location geocode toward nearby places.
    proximity?: { lat: number; lng: number } | null;
    onApply: (parsed: ParsedVoiceExpense, location: GeocodedPlace | null) => void;
    onDiscard: () => void;
}

type GeoState = 'idle' | 'loading' | 'done' | 'notfound';

const PAYMENT_OPTIONS: { value: VoicePaymentMethod; icon: React.ComponentType<{ className?: string }> }[] = [
    { value: 'Cash', icon: Banknote },
    { value: 'Credit Card', icon: CreditCard },
    { value: 'Debit Card', icon: CreditCard },
    { value: 'UPI', icon: Smartphone },
    { value: 'Bank Transfer', icon: Landmark },
];

const MAX_TAGS = 12;
const normalizeTag = (s: string) =>
    s.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 32);

const sectionVariants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};
const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 380, damping: 30 } },
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <motion.div variants={itemVariants} className="space-y-1.5">
            <div className="flex items-baseline gap-2 px-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
                {hint && <span className="text-[10px] text-muted-foreground/50">{hint}</span>}
            </div>
            {children}
        </motion.div>
    );
}

const inputClass =
    'w-full rounded-2xl border border-white/10 bg-secondary/10 px-3.5 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/40 focus:border-rose-400/40';

export function VoiceReviewModal({ parsed, currentCurrency, proximity, onApply, onDiscard }: VoiceReviewModalProps) {
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState('USD');
    const [category, setCategory] = useState<string | null>(null);
    const [payment, setPayment] = useState<VoicePaymentMethod | null>(null);
    const [tags, setTags] = useState<string[]>([]);
    const [tagDraft, setTagDraft] = useState('');
    const [description, setDescription] = useState('');
    const [notes, setNotes] = useState('');
    const [geoState, setGeoState] = useState<GeoState>('idle');
    const [resolvedLoc, setResolvedLoc] = useState<GeocodedPlace | null>(null);
    const [applying, setApplying] = useState(false);
    const applyRef = useRef<HTMLButtonElement>(null);
    const applyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Read latest form currency / position without re-running the init effect mid-edit.
    const currentCurrencyRef = useRef(currentCurrency);
    currentCurrencyRef.current = currentCurrency;
    const proximityRef = useRef(proximity);
    proximityRef.current = proximity;

    // Seed the editable draft each time a fresh dictation opens the modal, and
    // kick off geocoding for any place phrase the parser pulled out.
    useEffect(() => {
        if (!parsed) return;
        setAmount(parsed.amount ?? '');
        setCurrency(parsed.currency ?? currentCurrencyRef.current);
        setCategory(parsed.category);
        setPayment(parsed.paymentMethod);
        setTags(parsed.tags);
        setTagDraft('');
        setDescription(parsed.description);
        setNotes(parsed.notes ?? '');
        setApplying(false);
        setResolvedLoc(null);

        if (!parsed.location) {
            setGeoState('idle');
            return;
        }
        setGeoState('loading');
        let cancelled = false;
        const ac = new AbortController();
        geocodePlace(parsed.location, { proximity: proximityRef.current, signal: ac.signal })
            .then(r => {
                if (cancelled) return;
                setResolvedLoc(r);
                setGeoState(r ? 'done' : 'notfound');
            })
            .catch(err => {
                if (cancelled || (err as { name?: string })?.name === 'AbortError') return;
                setGeoState('notfound');
            });
        return () => { cancelled = true; ac.abort(); };
    }, [parsed]);

    useEffect(() => () => {
        if (applyTimerRef.current) clearTimeout(applyTimerRef.current);
    }, []);

    const addTag = (raw: string) => {
        const t = normalizeTag(raw);
        setTagDraft('');
        if (!t || tags.includes(t) || tags.length >= MAX_TAGS) return;
        setTags(prev => [...prev, t]);
    };

    const handleApply = () => {
        if (!parsed || applying) return;
        setApplying(true);
        const edited: ParsedVoiceExpense = {
            raw: parsed.raw,
            amount: amount.trim() || null,
            currency,
            category,
            paymentMethod: payment,
            tags,
            notes: notes.trim() || null,
            location: parsed.location,
            description: description.trim(),
        };
        // Let the confirm animation play before committing + closing.
        applyTimerRef.current = setTimeout(() => onApply(edited, resolvedLoc), 300);
    };

    const symbol = CURRENCY_SYMBOLS[currency as keyof typeof CURRENCY_SYMBOLS] || '$';

    return (
        <DialogPrimitive.Root open={!!parsed} onOpenChange={(open) => { if (!open && !applying) onDiscard(); }}>
            <AnimatePresence>
                {parsed && (
                    <DialogPrimitive.Portal forceMount>
                        <DialogPrimitive.Overlay asChild forceMount>
                            <motion.div
                                className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-md"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.22 }}
                            />
                        </DialogPrimitive.Overlay>
                        <DialogPrimitive.Content
                            asChild
                            forceMount
                            onOpenAutoFocus={(e) => { e.preventDefault(); applyRef.current?.focus(); }}
                        >
                            <motion.div
                                className="fixed inset-x-0 bottom-0 z-[130] mx-auto flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] border-t border-x border-white/10 bg-background shadow-[0_-20px_60px_-15px_rgba(0,0,0,0.75)]"
                                initial={{ y: '102%' }}
                                animate={{ y: 0 }}
                                exit={{ y: '102%' }}
                                transition={{ type: 'spring', stiffness: 340, damping: 34 }}
                            >
                                {/* Rose glow bleeding from the top edge */}
                                <div
                                    aria-hidden
                                    className="pointer-events-none absolute top-0 left-1/2 h-40 w-3/4 -translate-x-1/2 rounded-full bg-rose-500/20 blur-3xl"
                                />

                                {/* Grab handle */}
                                <div className="relative shrink-0 pt-3 pb-1">
                                    <div className="mx-auto h-1 w-10 rounded-full bg-white/15" aria-hidden />
                                </div>

                                {/* Header */}
                                <div className="relative shrink-0 flex items-center gap-3 px-5 pt-2 pb-3">
                                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-rose-400/30 bg-gradient-to-br from-rose-500/25 to-pink-600/15">
                                        <AudioLines className="h-5 w-5 text-rose-300" aria-hidden />
                                        <motion.span
                                            className="absolute inset-0 rounded-2xl border border-rose-400/50"
                                            animate={{ scale: [1, 1.4], opacity: [0.7, 0] }}
                                            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                                            aria-hidden
                                        />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <DialogPrimitive.Title className="text-[15px] font-bold text-foreground">
                                            Review &amp; edit
                                        </DialogPrimitive.Title>
                                        <DialogPrimitive.Description className="truncate text-xs text-muted-foreground">
                                            From your voice — tweak anything before applying
                                        </DialogPrimitive.Description>
                                    </div>
                                </div>

                                {/* Raw transcript */}
                                {parsed.raw && (
                                    <div className="relative mx-5 mb-1 shrink-0 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
                                        <p className="text-[12px] italic leading-snug text-muted-foreground">
                                            <span className="not-italic text-rose-300/70">“</span>
                                            {parsed.raw}
                                            <span className="not-italic text-rose-300/70">”</span>
                                        </p>
                                    </div>
                                )}

                                {/* Editable fields */}
                                <motion.div
                                    className="relative flex-1 space-y-4 overflow-y-auto px-5 py-3 scrollbar-hide"
                                    variants={sectionVariants}
                                    initial="hidden"
                                    animate="show"
                                >
                                    {/* Amount + currency */}
                                    <motion.div variants={itemVariants}>
                                        <div className="rounded-2xl border border-white/10 bg-secondary/10 p-3.5 transition-colors focus-within:border-rose-400/40">
                                            <div className="flex items-center gap-2">
                                                <span className="text-2xl font-bold text-rose-300">{symbol}</span>
                                                <input
                                                    inputMode="decimal"
                                                    value={amount}
                                                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                                                    placeholder="0.00"
                                                    aria-label="Amount"
                                                    className="w-full bg-transparent text-2xl font-bold text-foreground outline-none placeholder:text-muted-foreground/30"
                                                />
                                            </div>
                                            <CurrencyDropdown
                                                compact
                                                value={currency}
                                                onValueChange={setCurrency}
                                                className="mt-2.5"
                                            />
                                        </div>
                                    </motion.div>

                                    {/* Category */}
                                    <Field label="Category">
                                        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide">
                                            {CATEGORIES.filter(c => c.id !== 'uncategorized').map(cat => {
                                                const active = category === cat.id;
                                                const color = CATEGORY_COLORS[cat.id];
                                                return (
                                                    <button
                                                        key={cat.id}
                                                        type="button"
                                                        onClick={() => setCategory(active ? null : cat.id)}
                                                        className={cn(
                                                            'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95',
                                                            active
                                                                ? 'text-white'
                                                                : 'border-white/10 bg-secondary/20 text-muted-foreground hover:text-foreground',
                                                        )}
                                                        style={active ? { backgroundColor: color, borderColor: color } : undefined}
                                                    >
                                                        {getIconForCategory(cat.id, 'h-3.5 w-3.5')}
                                                        {cat.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </Field>

                                    {/* Payment */}
                                    <Field label="Payment">
                                        <div className="flex flex-wrap gap-2">
                                            {PAYMENT_OPTIONS.map(({ value, icon: Icon }) => {
                                                const active = payment === value;
                                                return (
                                                    <button
                                                        key={value}
                                                        type="button"
                                                        onClick={() => setPayment(active ? null : value)}
                                                        className={cn(
                                                            'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95',
                                                            active
                                                                ? 'border-rose-400/50 bg-rose-500/20 text-rose-100'
                                                                : 'border-white/10 bg-secondary/20 text-muted-foreground hover:text-foreground',
                                                        )}
                                                    >
                                                        <Icon className="h-3.5 w-3.5" />
                                                        {value}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </Field>

                                    {/* Location — geocoded from the spoken "at …" phrase */}
                                    {parsed.location && (
                                        <Field label="Location" hint="from voice">
                                            {geoState === 'loading' && (
                                                <div className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-secondary/10 px-3.5 py-3">
                                                    <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-rose-400/30 border-t-rose-400" />
                                                    <span className="truncate text-sm text-muted-foreground">
                                                        Finding <span className="text-foreground">“{parsed.location}”</span>…
                                                    </span>
                                                </div>
                                            )}
                                            {geoState === 'done' && resolvedLoc && (
                                                <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 px-3.5 py-3">
                                                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-500/25 bg-emerald-500/15">
                                                        <MapPin className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-sm font-semibold text-emerald-300">{resolvedLoc.place_name}</p>
                                                        {resolvedLoc.place_address && (
                                                            <p className="truncate text-[11px] text-muted-foreground">{resolvedLoc.place_address}</p>
                                                        )}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setResolvedLoc(null); setGeoState('idle'); }}
                                                        aria-label="Remove location"
                                                        className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                            {geoState === 'notfound' && (
                                                <div className="rounded-2xl border border-white/10 bg-secondary/10 px-3.5 py-3">
                                                    <p className="text-sm text-muted-foreground">
                                                        Couldn't find <span className="text-foreground">“{parsed.location}”</span>
                                                    </p>
                                                    <p className="mt-0.5 text-[11px] text-muted-foreground/60">Add a location on the form after applying.</p>
                                                </div>
                                            )}
                                            {geoState === 'idle' && (
                                                <p className="px-1 text-[11px] text-muted-foreground/50">
                                                    Location skipped — add one on the form if you need it.
                                                </p>
                                            )}
                                        </Field>
                                    )}

                                    {/* Tags */}
                                    <Field label="Tags" hint="optional">
                                        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-white/10 bg-secondary/10 p-2 transition-colors focus-within:border-rose-400/40">
                                            <AnimatePresence initial={false}>
                                                {tags.map(t => (
                                                    <motion.span
                                                        key={t}
                                                        layout
                                                        initial={{ opacity: 0, scale: 0.6 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        exit={{ opacity: 0, scale: 0.6 }}
                                                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                                        className="inline-flex items-center gap-1 rounded-full border border-rose-400/25 bg-rose-500/15 py-0.5 pl-2 pr-1 text-[11px] font-semibold text-rose-200"
                                                    >
                                                        #{t}
                                                        <button
                                                            type="button"
                                                            onClick={() => setTags(tags.filter(x => x !== t))}
                                                            aria-label={`Remove tag ${t}`}
                                                            className="rounded-full p-0.5 hover:bg-rose-500/25"
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </button>
                                                    </motion.span>
                                                ))}
                                            </AnimatePresence>
                                            <input
                                                value={tagDraft}
                                                onChange={(e) => setTagDraft(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
                                                        if (tagDraft.trim()) { e.preventDefault(); addTag(tagDraft); }
                                                    } else if (e.key === 'Backspace' && !tagDraft && tags.length) {
                                                        setTags(tags.slice(0, -1));
                                                    }
                                                }}
                                                onBlur={() => { if (tagDraft.trim()) addTag(tagDraft); }}
                                                placeholder={tags.length ? 'Add…' : 'Add tags…'}
                                                aria-label="Add tag"
                                                disabled={tags.length >= MAX_TAGS}
                                                className="min-w-[64px] flex-1 bg-transparent px-1 text-xs outline-none placeholder:text-muted-foreground/40"
                                            />
                                        </div>
                                    </Field>

                                    {/* Description */}
                                    <Field label="Description">
                                        <input
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            placeholder="What was it for?"
                                            aria-label="Description"
                                            className={inputClass}
                                        />
                                    </Field>

                                    {/* Note */}
                                    <Field label="Note" hint="optional">
                                        <input
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            placeholder="Add a note"
                                            aria-label="Note"
                                            className={inputClass}
                                        />
                                    </Field>
                                </motion.div>

                                {/* Footer */}
                                <div className="relative shrink-0 flex items-center gap-3 border-t border-white/[0.06] bg-background px-5 py-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom))]">
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
                                        className={cn(
                                            'relative h-12 flex-[1.5] overflow-hidden rounded-2xl text-sm font-bold text-white shadow-lg transition-colors',
                                            applying
                                                ? 'bg-emerald-500 shadow-emerald-500/20'
                                                : 'bg-gradient-to-r from-rose-500 to-pink-600 shadow-rose-500/25',
                                        )}
                                    >
                                        <AnimatePresence mode="wait" initial={false}>
                                            {applying ? (
                                                <motion.span
                                                    key="done"
                                                    className="absolute inset-0 flex items-center justify-center gap-1.5"
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0 }}
                                                >
                                                    <motion.span
                                                        initial={{ scale: 0 }}
                                                        animate={{ scale: 1 }}
                                                        transition={{ type: 'spring', stiffness: 500, damping: 18, delay: 0.05 }}
                                                    >
                                                        <Check className="h-4 w-4" aria-hidden />
                                                    </motion.span>
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
