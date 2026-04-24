'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wrench, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'app-reset-v1-dismissed';

export function AppResetModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [resetting, setResetting] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (typeof window === 'undefined') return;
        if (localStorage.getItem(STORAGE_KEY)) return;
        setIsOpen(true);
    }, []);

    const handleDismiss = () => {
        setIsOpen(false);
        try {
            localStorage.setItem(STORAGE_KEY, '1');
        } catch (e) {
            console.error('[app-reset-modal] localStorage', e);
        }
    };

    const handleReset = async () => {
        setResetting(true);
        try {
            if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                await Promise.all(regs.map(r => r.unregister()));
            }
            if ('caches' in window) {
                const keys = await caches.keys();
                await Promise.all(keys.map(k => caches.delete(k)));
            }
            try {
                localStorage.clear();
            } catch (e) {
                console.error('[app-reset-modal] localStorage.clear', e);
            }
        } catch (e) {
            console.error('[app-reset-modal] reset', e);
        }
        window.location.replace('/');
    };

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-0">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-md"
                        onClick={handleDismiss}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 30 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 0.8 }}
                        className="relative w-full max-w-sm bg-[#0D0D0F]/98 backdrop-blur-xl border border-white/10 rounded-[2.5rem] shadow-[0_0_80px_-15px_rgba(138,43,226,0.4)] overflow-hidden z-[1100] mx-4 flex flex-col max-h-[90dvh]"
                    >
                        {/* Glows */}
                        <div className="absolute -top-24 -left-24 w-56 h-56 bg-primary/30 rounded-full blur-[70px] opacity-40 animate-pulse" />
                        <div className="absolute -bottom-24 -right-24 w-56 h-56 bg-purple-500/30 rounded-full blur-[70px] opacity-40 animate-pulse" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-white/5 rounded-full blur-[80px] pointer-events-none" />

                        {/* Close Button */}
                        <button
                            onClick={handleDismiss}
                            disabled={resetting}
                            className="absolute top-5 right-5 p-2 rounded-full hover:bg-white/10 hover:rotate-90 transition-all duration-500 z-20 text-white/50 hover:text-white disabled:opacity-30"
                            aria-label="Dismiss"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-8 pt-10 text-center space-y-6 relative z-10 flex flex-col items-center">
                            <motion.div
                                initial={{ scale: 0.6, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center border border-white/10"
                            >
                                <Wrench className="w-7 h-7 text-primary" />
                            </motion.div>

                            <div className="space-y-2">
                                <motion.h1
                                    initial={{ y: 10, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.2 }}
                                    className="text-2xl font-black text-white tracking-tight leading-tight"
                                >
                                    We&apos;ve moved to a new home
                                </motion.h1>
                                <motion.p
                                    initial={{ y: 10, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.25 }}
                                    className="text-sm text-white/60 leading-relaxed"
                                >
                                    Novira now lives at <span className="text-white font-medium">novira.one</span>. If you installed the app before, tap below once to clear old cached data — it ensures you get the latest features and updates seamlessly.
                                </motion.p>
                            </div>

                            {/* Info bullets */}
                            <motion.div
                                initial={{ y: 10, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.3 }}
                                className="w-full space-y-3 text-left"
                            >
                                <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/5 border border-white/10">
                                    <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                    <p className="text-xs text-white/70 leading-relaxed">
                                        Your data is safe — this only clears the app&apos;s local cache, not your account or transactions.
                                    </p>
                                </div>
                                <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/5 border border-white/10">
                                    <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                    <p className="text-xs text-white/70 leading-relaxed">
                                        You&apos;ll be signed back in with everything intact — takes less than a second.
                                    </p>
                                </div>
                                <div className="flex items-start gap-3 p-3 rounded-2xl bg-white/5 border border-white/10">
                                    <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                    <p className="text-xs text-white/70 leading-relaxed">
                                        If the app ever feels off, you can run this again from Settings → Reset App.
                                    </p>
                                </div>
                            </motion.div>

                            <motion.div
                                initial={{ y: 10, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.45 }}
                                className="w-full pt-2 pb-2 space-y-2"
                            >
                                <Button
                                    onClick={handleReset}
                                    disabled={resetting}
                                    className="w-full bg-white text-black hover:bg-white/90 font-black h-14 rounded-2xl shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] text-sm tracking-widest uppercase disabled:opacity-70 disabled:hover:scale-100"
                                >
                                    {resetting ? (
                                        <span className="flex items-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Resetting...
                                        </span>
                                    ) : (
                                        'Reset App'
                                    )}
                                </Button>
                                <button
                                    onClick={handleDismiss}
                                    disabled={resetting}
                                    className="w-full text-xs text-white/40 hover:text-white/70 transition-colors py-2 disabled:opacity-30"
                                >
                                    Maybe later
                                </button>
                            </motion.div>
                        </div>

                        {/* Shine */}
                        <div className="absolute top-0 left-0 w-full h-[1px] bg-white/20" />
                        <div className="absolute top-0 left-1/4 w-1/2 h-[2px] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
}
