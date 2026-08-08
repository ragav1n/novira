'use client';

import { useState, useEffect, useCallback } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
    Sparkles,
    Users,
    Globe,
    BarChart3,
    Receipt,
    Plus,
    Tag,
    Camera,
    ArrowRight,
    BookOpen,
    Compass,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface WelcomeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenFullTour?: () => void;
}

type ScreenKey = 'welcome' | 'features' | 'setup';

const SCREEN_ORDER: ScreenKey[] = ['welcome', 'features', 'setup'];

const HERO_FEATURES = [
    {
        title: 'Scan receipts',
        body: 'Snap one. Amount, merchant, date, and category land in the form in seconds.',
        Icon: Receipt,
        tone: 'text-lime-300',
    },
    {
        title: 'Split with friends',
        body: 'Even, share-weighted, or custom splits. Settle multiple debts in the fewest transfers.',
        Icon: Users,
        tone: 'text-blue-300',
    },
    {
        title: 'Multi-currency',
        body: '26 currencies, live rates, one stable base.',
        Icon: Globe,
        tone: 'text-emerald-300',
    },
    {
        title: 'Analytics',
        body: 'Custom ranges, trends, and a what-if simulator tied to your goals.',
        Icon: BarChart3,
        tone: 'text-violet-300',
    },
];

export function WelcomeModal({ isOpen, onClose, onOpenFullTour }: WelcomeModalProps) {
    const [screen, setScreen] = useState<ScreenKey>('welcome');
    const router = useRouter();

    useEffect(() => {
        if (isOpen) setScreen('welcome');
    }, [isOpen]);

    const screenIndex = SCREEN_ORDER.indexOf(screen);

    const goNext = useCallback(() => {
        const next = SCREEN_ORDER[screenIndex + 1];
        if (next) setScreen(next);
        else onClose();
    }, [screenIndex, onClose]);

    const goBack = useCallback(() => {
        const prev = SCREEN_ORDER[screenIndex - 1];
        if (prev) setScreen(prev);
    }, [screenIndex]);

    const goTo = (path: string) => {
        router.push(path);
        onClose();
    };

    const openFullTour = () => {
        if (onOpenFullTour) {
            onClose();
            // Slight defer so the modal close animation doesn't fight the tour opening
            setTimeout(onOpenFullTour, 120);
        } else {
            router.push('/guide');
            onClose();
        }
    };

    return (
        <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <AnimatePresence>
            {isOpen && (
                <DialogPrimitive.Portal forceMount>
                    <DialogPrimitive.Overlay asChild forceMount>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md"
                        />
                    </DialogPrimitive.Overlay>

                    {/* The Content is the full-screen centring box, so it must not
                        swallow backdrop clicks — a click outside the panel has to reach
                        the Overlay, which is what Radix checks before dismissing.
                        Focus trapping is by DOM subtree, so it is unaffected.

                        This has to be an inline `style`, not `pointer-events-none`:
                        Radix writes `style="pointer-events: auto"` onto Content itself,
                        and an inline style beats any class. Its Slot merges the child's
                        style over its own, so setting it here is what actually wins. */}
                    <DialogPrimitive.Content
                        asChild
                        forceMount
                        // Suppresses Radix's missing-description warning without a
                        // VisuallyHidden node — same convention as ui/dialog.tsx.
                        aria-describedby={undefined}
                    >
                        <div
                            className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6"
                            style={{ pointerEvents: 'none' }}
                        >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: 'spring', duration: 0.6, bounce: 0.3 }}
                        className="pointer-events-auto relative w-full max-w-md bg-[#0A0A0B]/98 backdrop-blur-xl border border-white/10 rounded-[2.5rem] shadow-[0_0_50px_-12px_rgba(138,43,226,0.3)] overflow-hidden"
                    >
                        <div className="pointer-events-none absolute -top-32 -left-32 w-72 h-72 bg-primary/20 rounded-full blur-[100px] opacity-50" />
                        <div className="pointer-events-none absolute -bottom-32 -right-32 w-72 h-72 bg-purple-600/20 rounded-full blur-[100px] opacity-50" />
                        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

                        <div className="relative flex flex-col">
                            <div className="px-6 pt-5 pb-3 flex items-center justify-between">
                                <div className="inline-flex items-center gap-1.5 text-eyebrow uppercase text-primary">
                                    <Sparkles className="w-3 h-3" aria-hidden="true" />
                                    Welcome
                                </div>
                                <div className="flex items-center gap-1.5" aria-hidden="true">
                                    {SCREEN_ORDER.map((_, i) => (
                                        <span
                                            key={i}
                                            className={cn(
                                                'h-1 rounded-full transition-all duration-300',
                                                i === screenIndex ? 'w-5 bg-primary' : i < screenIndex ? 'w-1.5 bg-primary/40' : 'w-1.5 bg-white/15'
                                            )}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="px-6 pb-5">
                                <AnimatePresence mode="wait">
                                    {screen === 'welcome' && (
                                        <motion.div
                                            key="welcome"
                                            initial={{ opacity: 0, x: 16 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -16 }}
                                            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                                            className="space-y-5 pt-3"
                                        >
                                            <div className="flex flex-col items-center text-center gap-3">
                                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-white/5 border border-white/10">
                                                    <Compass className="w-7 h-7 text-primary drop-shadow-[0_0_10px_rgba(138,43,226,0.6)]" />
                                                </div>
                                                <div className="space-y-1.5">
                                                    {/* Each screen names the dialog. `mode="wait"` keeps exactly
                                                        one mounted, so the title id is never duplicated. */}
                                                    <DialogPrimitive.Title asChild>
                                                        <h1 className="text-2xl font-extrabold text-white tracking-tight leading-tight">
                                                            Welcome to Novira
                                                        </h1>
                                                    </DialogPrimitive.Title>
                                                    <p className="text-body text-white/65 leading-relaxed max-w-[300px] mx-auto">
                                                        Track, split, and plan money across currencies.
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="rounded-xl border border-white/8 bg-white/[0.025] divide-y divide-white/5">
                                                {[
                                                    { k: 'Log a spend', v: 'In a tap or a snap of a receipt' },
                                                    { k: 'Plan ahead', v: 'Buckets, allowances, run-rate forecast' },
                                                    { k: 'Share fairly', v: 'Splits with friends, settled in fewer transfers' },
                                                ].map(({ k, v }) => (
                                                    <div key={k} className="flex items-center justify-between gap-3 px-4 py-2.5">
                                                        <span className="text-xs font-bold text-white">{k}</span>
                                                        <span className="text-meta text-white/55 text-right">{v}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}

                                    {screen === 'features' && (
                                        <motion.div
                                            key="features"
                                            initial={{ opacity: 0, x: 16 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -16 }}
                                            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                                            className="space-y-4 pt-2"
                                        >
                                            <div className="space-y-1">
                                                <DialogPrimitive.Title asChild>
                                                    <h2 className="text-lg font-extrabold text-white tracking-tight leading-tight">
                                                        What you can do
                                                    </h2>
                                                </DialogPrimitive.Title>
                                                <p className="text-xs text-white/55 leading-relaxed">
                                                    Four things Novira does well. There's more inside.
                                                </p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2.5">
                                                {HERO_FEATURES.map((f, i) => (
                                                    <motion.div
                                                        key={f.title}
                                                        initial={{ opacity: 0, y: 8 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: 0.05 + i * 0.05, duration: 0.3 }}
                                                        className="rounded-xl border border-white/8 bg-white/[0.03] p-3 space-y-1.5"
                                                    >
                                                        <f.Icon className={cn('w-4 h-4', f.tone)} aria-hidden="true" />
                                                        <div className="text-xs font-bold text-white leading-tight">
                                                            {f.title}
                                                        </div>
                                                        <p className="text-caption text-white/55 leading-snug">
                                                            {f.body}
                                                        </p>
                                                    </motion.div>
                                                ))}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={openFullTour}
                                                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 text-meta font-semibold text-white/75 hover:text-white hover:bg-white/[0.06] transition-colors"
                                            >
                                                <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                                                See the full tour
                                                <ArrowRight className="w-3 h-3" aria-hidden="true" />
                                            </button>
                                        </motion.div>
                                    )}

                                    {screen === 'setup' && (
                                        <motion.div
                                            key="setup"
                                            initial={{ opacity: 0, x: 16 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -16 }}
                                            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                                            className="space-y-4 pt-2"
                                        >
                                            <div className="space-y-1">
                                                <DialogPrimitive.Title asChild>
                                                    <h2 className="text-lg font-extrabold text-white tracking-tight leading-tight">
                                                        Start with one thing
                                                    </h2>
                                                </DialogPrimitive.Title>
                                                <p className="text-xs text-white/55 leading-relaxed">
                                                    Pick where to begin. You can do the rest later.
                                                </p>
                                            </div>
                                            <div className="space-y-2">
                                                {[
                                                    { Icon: Plus, label: 'Log a transaction', sub: 'The fastest way in', path: '/add' },
                                                    { Icon: Camera, label: 'Scan a receipt', sub: 'Camera does the typing', path: '/add' },
                                                    { Icon: Tag, label: 'Create a bucket', sub: 'For a trip or a project', path: '/groups?tab=buckets' },
                                                ].map(({ Icon, label, sub, path }) => (
                                                    <button
                                                        key={label}
                                                        type="button"
                                                        onClick={() => goTo(path)}
                                                        className="group w-full flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/15 px-3 py-3 text-left transition-colors"
                                                    >
                                                        <span className="shrink-0 w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-primary/40 group-hover:bg-primary/10 transition-colors">
                                                            <Icon className="w-4 h-4 text-primary" aria-hidden="true" />
                                                        </span>
                                                        <span className="min-w-0 flex-1">
                                                            <span className="block text-body font-semibold text-white leading-tight">{label}</span>
                                                            <span className="block text-meta text-white/45 leading-tight mt-0.5">{sub}</span>
                                                        </span>
                                                        <ArrowRight className="w-4 h-4 text-white/30 group-hover:text-white/70 transition-colors" aria-hidden="true" />
                                                    </button>
                                                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <div className="px-6 py-4 border-t border-white/5 bg-black/40 backdrop-blur-xl flex items-center gap-2">
                                {screenIndex > 0 ? (
                                    <Button
                                        variant="ghost"
                                        onClick={goBack}
                                        className="h-11 px-4 rounded-xl text-xs font-semibold text-white/65 hover:text-white hover:bg-white/5"
                                    >
                                        Back
                                    </Button>
                                ) : (
                                    <Button
                                        variant="ghost"
                                        onClick={onClose}
                                        className="h-11 px-4 rounded-xl text-xs font-semibold text-white/65 hover:text-white hover:bg-white/5"
                                    >
                                        Skip
                                    </Button>
                                )}
                                <Button
                                    onClick={goNext}
                                    className="flex-1 h-11 rounded-xl bg-white text-black hover:bg-white/90 font-bold text-body inline-flex items-center justify-center gap-1.5"
                                >
                                    {screen === 'setup' ? 'Get started' : 'Next'}
                                    {screen !== 'setup' && <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />}
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                        </div>
                    </DialogPrimitive.Content>
                </DialogPrimitive.Portal>
            )}
        </AnimatePresence>
        </DialogPrimitive.Root>
    );
}
