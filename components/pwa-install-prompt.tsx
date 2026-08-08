'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { SHEET } from '@/lib/motion';
import { X, Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'pwa-install-dismissed-at';
const DISMISS_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export function PWAInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    // iOS has no install API — the banner becomes instructions instead of a button.
    const [isIOSHint, setIsIOSHint] = useState(false);

    useEffect(() => {
        // Don't show if already installed (standalone mode)
        if (window.matchMedia('(display-mode: standalone)').matches) return;
        // Dismissals persist in localStorage (not sessionStorage) for 14 days so
        // the banner stays gone across tab closes.
        const isDismissed = () => {
            const dismissedAt = Number(localStorage.getItem(DISMISS_KEY));
            return Number.isFinite(dismissedAt) && dismissedAt > 0 && Date.now() - dismissedAt < DISMISS_TTL_MS;
        };
        if (isDismissed()) return;

        let timer: ReturnType<typeof setTimeout> | null = null;
        const handler = (e: Event) => {
            e.preventDefault();
            // Chrome re-fires beforeinstallprompt on SPA route changes, so a
            // dismissal made after mount must be re-checked at fire time
            if (isDismissed()) return;
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            // Small delay so the page settles before showing the banner
            timer = setTimeout(() => setIsVisible(true), 3000);
        };

        window.addEventListener('beforeinstallprompt', handler);

        // iOS Safari never fires `beforeinstallprompt`, so without this branch iPhone
        // users — the primary install target — got no install path at all. There's no
        // programmatic prompt on iOS, so we show Add-to-Home-Screen instructions.
        const ua = navigator.userAgent;
        const isIOS = /iPad|iPhone|iPod/.test(ua) && !('MSStream' in window);
        const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
        if (isIOS && isSafari) {
            setIsIOSHint(true);
            timer = setTimeout(() => setIsVisible(true), 3000);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
            if (timer) clearTimeout(timer);
        };
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        const saved = deferredPrompt;
        setDeferredPrompt(null); // prompt can only be used once
        await saved.prompt();
        await saved.userChoice;
        setIsVisible(false);
    };

    const handleDismiss = () => {
        setIsVisible(false);
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={SHEET}
                    // bottom-24 clears the floating nav, which sits at
                    // bottom-6 + safe-area inset + ~48px tall.
                    className="fixed bottom-[calc(7rem+env(safe-area-inset-bottom))] left-4 right-4 z-50 max-w-sm mx-auto"
                    // A non-modal banner: role="status", not "dialog". It has no focus
                    // trap and no Escape handler, so announcing it as a dialog was a lie.
                    role="status"
                    aria-label="Install Novira app"
                >
                    <div className="bg-card/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-4 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                            <Download className="w-5 h-5 text-primary" aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white leading-tight">Install Novira</p>
                            <p className="text-xs text-white/50 mt-0.5">
                                {isIOSHint
                                    ? 'Tap Share, then "Add to Home Screen"'
                                    : 'Add to home screen for the best experience'}
                            </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {/* iOS offers no programmatic install, so there's nothing to
                                tap — the instructions above are the whole affordance. */}
                            {!isIOSHint && (
                                <Button
                                    onClick={handleInstall}
                                    className="px-3 text-xs font-bold"
                                >
                                    Install
                                </Button>
                            )}
                            <button
                                onClick={handleDismiss}
                                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
                                aria-label="Dismiss install prompt"
                            >
                                <X className="w-4 h-4" aria-hidden="true" />
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
