'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Don't show if already installed (standalone mode)
        if (window.matchMedia('(display-mode: standalone)').matches) return;
        // Don't show if dismissed in this session
        if (sessionStorage.getItem('pwa-install-dismissed')) return;

        let timer: ReturnType<typeof setTimeout> | null = null;
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            // Small delay so the page settles before showing the banner
            timer = setTimeout(() => setIsVisible(true), 3000);
        };

        window.addEventListener('beforeinstallprompt', handler);
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
        sessionStorage.setItem('pwa-install-dismissed', '1');
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                    className="fixed bottom-20 left-4 right-4 z-50 max-w-sm mx-auto"
                    role="dialog"
                    aria-label="Install Novira app"
                >
                    <div className="bg-card/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-4 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                            <Download className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white leading-tight">Install Novira</p>
                            <p className="text-xs text-white/50 mt-0.5">Add to home screen for the best experience</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={handleInstall}
                                className="px-3 py-1.5 bg-primary rounded-lg text-xs font-bold text-white hover:bg-primary/90 transition-colors"
                            >
                                Install
                            </button>
                            <button
                                onClick={handleDismiss}
                                className="p-1.5 rounded-full hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
                                aria-label="Dismiss install prompt"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
