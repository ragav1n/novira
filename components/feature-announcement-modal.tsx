'use client';

import { useState, useEffect } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Zap, Tag, PieChart, Users, QrCode, Upload, Bell, Globe, FileDown,
    RefreshCcw, Shield, Search, Sparkles, Moon, CreditCard, Wallet, Lock,
    SlidersHorizontal, Star, Fingerprint, BarChart3, Receipt, Layers,
    MessageSquare, Link2, Smartphone, MapPin, Home, Target, Calendar, Hand,
    Mic, Palette,
    type LucideIcon,
} from 'lucide-react';
import { LATEST_FEATURE_ANNOUNCEMENT } from '@/lib/feature-flags';
import { Button } from '@/components/ui/button';
import { version } from '@/package.json';

interface FeatureAnnouncementModalProps {
    showAnnouncement?: boolean;
    userId?: string | null;
    onClose?: () => void;
}

const ICON_MAP: Record<string, { Icon: LucideIcon; tone: string }> = {
    home: { Icon: Home, tone: 'text-indigo-300' },
    chart: { Icon: PieChart, tone: 'text-violet-300' },
    'bar-chart': { Icon: BarChart3, tone: 'text-violet-300' },
    zap: { Icon: Zap, tone: 'text-yellow-300' },
    star: { Icon: Star, tone: 'text-amber-300' },
    users: { Icon: Users, tone: 'text-blue-300' },
    mobile: { Icon: Smartphone, tone: 'text-sky-300' },
    receipt: { Icon: Receipt, tone: 'text-lime-300' },
    bucket: { Icon: Tag, tone: 'text-amber-300' },
    wallet: { Icon: Wallet, tone: 'text-emerald-300' },
    card: { Icon: CreditCard, tone: 'text-blue-300' },
    recurring: { Icon: RefreshCcw, tone: 'text-emerald-300' },
    layers: { Icon: Layers, tone: 'text-sky-300' },
    message: { Icon: MessageSquare, tone: 'text-cyan-300' },
    link: { Icon: Link2, tone: 'text-indigo-300' },
    qr: { Icon: QrCode, tone: 'text-cyan-300' },
    target: { Icon: Target, tone: 'text-emerald-300' },
    calendar: { Icon: Calendar, tone: 'text-orange-300' },
    settings: { Icon: SlidersHorizontal, tone: 'text-slate-300' },
    'dark-mode': { Icon: Moon, tone: 'text-slate-200' },
    gestures: { Icon: Hand, tone: 'text-fuchsia-300' },
    shield: { Icon: Shield, tone: 'text-green-300' },
    lock: { Icon: Lock, tone: 'text-green-300' },
    fingerprint: { Icon: Fingerprint, tone: 'text-teal-300' },
    search: { Icon: Search, tone: 'text-fuchsia-300' },
    ai: { Icon: Sparkles, tone: 'text-amber-300' },
    upload: { Icon: Upload, tone: 'text-indigo-300' },
    export: { Icon: FileDown, tone: 'text-pink-300' },
    bell: { Icon: Bell, tone: 'text-orange-300' },
    globe: { Icon: Globe, tone: 'text-teal-300' },
    map: { Icon: MapPin, tone: 'text-rose-300' },
    mic: { Icon: Mic, tone: 'text-rose-300' },
    palette: { Icon: Palette, tone: 'text-fuchsia-300' },
};

const DEFAULT_ICON = { Icon: Zap, tone: 'text-primary' };

export function FeatureAnnouncementModal({ showAnnouncement = false, userId, onClose }: FeatureAnnouncementModalProps) {
    const [isOpen, setIsOpen] = useState(false);

    // Track the prop both ways — latching open-only would keep this modal
    // alive underneath whichever surface suppressed it (e.g. the first-run
    // onboarding tour), so it would pop up the moment that surface closed.
    useEffect(() => {
        setIsOpen(showAnnouncement);
    }, [showAnnouncement]);

    const handleClose = () => {
        setIsOpen(false);
        if (userId) {
            localStorage.setItem(`last_seen_feature_id_${userId}`, LATEST_FEATURE_ANNOUNCEMENT.id);
        } else {
            localStorage.setItem('last_seen_feature_id', LATEST_FEATURE_ANNOUNCEMENT.id);
        }
        if (onClose) onClose();
    };

    return (
        <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
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
                            style over its own, so setting it here is what actually wins.
                            Verified in-browser — with the class, `elementFromPoint` at the
                            backdrop returned this div and outside-click silently stopped
                            closing the modal. */}
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

                        <button
                            onClick={handleClose}
                            aria-label="Close"
                            className="absolute top-4 right-4 z-20 p-2 rounded-full hover:bg-white/10 text-white/55 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="relative flex flex-col">
                            <div className="px-6 pt-5 pb-3">
                                <div className="text-eyebrow uppercase text-primary mb-1.5">
                                    Updated · v{version}
                                </div>
                                {/* asChild so Radix uses this as the dialog's accessible
                                    name without adding a wrapper element. */}
                                <DialogPrimitive.Title asChild>
                                    <h2 className="text-xl font-extrabold text-white tracking-tight leading-tight">
                                        {LATEST_FEATURE_ANNOUNCEMENT.title}
                                    </h2>
                                </DialogPrimitive.Title>
                                <p className="text-xs text-white/55 leading-relaxed mt-1">
                                    A few things changed since you last opened Novira.
                                </p>
                            </div>

                            <div className="px-6 pb-5 space-y-2">
                                {LATEST_FEATURE_ANNOUNCEMENT.features.map((feature, index) => {
                                    const { Icon, tone } = ICON_MAP[feature.icon] ?? DEFAULT_ICON;
                                    return (
                                        <motion.div
                                            key={feature.title}
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.08 + index * 0.05, duration: 0.3 }}
                                            className="flex items-start gap-3 p-3.5 rounded-xl border border-white/8 bg-white/[0.03]"
                                        >
                                            <span className="shrink-0 w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                                                <Icon className={`w-4 h-4 ${tone}`} aria-hidden="true" />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <h3 className="text-body font-bold text-white leading-tight">
                                                    {feature.title}
                                                </h3>
                                                <p className="text-meta text-white/60 leading-snug mt-1">
                                                    {feature.description}
                                                </p>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>

                            <div className="px-6 py-4 border-t border-white/5 bg-black/40 backdrop-blur-xl">
                                <Button
                                    onClick={handleClose}
                                    className="w-full h-11 rounded-xl bg-white text-black hover:bg-white/90 font-bold text-body"
                                >
                                    {LATEST_FEATURE_ANNOUNCEMENT.buttonText}
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
