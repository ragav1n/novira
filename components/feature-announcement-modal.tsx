'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Tag } from 'lucide-react';
import { LATEST_FEATURE_ANNOUNCEMENT } from '@/lib/feature-flags';
import { Button } from '@/components/ui/button';

interface FeatureAnnouncementModalProps {
    showAnnouncement?: boolean;
    userId?: string | null;
    onClose?: () => void;
}

export function FeatureAnnouncementModal({ showAnnouncement = false, userId, onClose }: FeatureAnnouncementModalProps) {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (showAnnouncement) {
            setIsOpen(true);
        }
    }, [showAnnouncement]);

    const handleClose = () => {
        setIsOpen(false);
        // Save to localStorage so we don't show it again for this specific user
        if (userId) {
            localStorage.setItem(`last_seen_feature_id_${userId}`, LATEST_FEATURE_ANNOUNCEMENT.id);
        } else {
            localStorage.setItem('last_seen_feature_id', LATEST_FEATURE_ANNOUNCEMENT.id);
        }
        if (onClose) onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-0">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-md"
                        onClick={handleClose}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 30 }}
                        transition={{
                            type: "spring",
                            stiffness: 300,
                            damping: 30,
                            mass: 0.8
                        }}
                        className="relative w-full max-w-sm bg-[#0D0D0F]/80 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-[0_0_80px_-15px_rgba(138,43,226,0.4)] overflow-hidden z-[70] mx-4 flex flex-col max-h-[90dvh]"
                    >
                        {/* More Dynamic Glass Glows */}
                        <div className="absolute -top-24 -left-24 w-56 h-56 bg-primary/30 rounded-full blur-[70px] opacity-40 animate-pulse" />
                        <div className="absolute -bottom-24 -right-24 w-56 h-56 bg-purple-500/30 rounded-full blur-[70px] opacity-40 animate-pulse" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-white/5 rounded-full blur-[80px] pointer-events-none" />

                        {/* Close Button - more prominent hover */}
                        <button
                            onClick={handleClose}
                            className="absolute top-5 right-5 p-2 rounded-full hover:bg-white/10 hover:rotate-90 transition-all duration-500 z-20 text-white/50 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-8 pt-10 text-center space-y-6 relative z-10 flex flex-col items-center custom-scrollbar">
                            <div className="space-y-2">
                                <motion.h1
                                    initial={{ y: 10, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.2 }}
                                    className="text-2xl font-black text-white tracking-tight leading-tight"
                                >
                                    {LATEST_FEATURE_ANNOUNCEMENT.title}
                                </motion.h1>
                            </div>

                            {/* Features List */}
                            <div className="w-full space-y-4 text-left">
                                {(LATEST_FEATURE_ANNOUNCEMENT as any).features.map((feature: any, index: number) => (
                                    <motion.div
                                        key={feature.title}
                                        initial={{ x: -20, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        transition={{ delay: 0.3 + index * 0.1 }}
                                        className="flex items-start gap-4 p-4 rounded-3xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors group"
                                    >
                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center shrink-0 border border-white/10 group-hover:scale-110 transition-transform">
                                            {feature.icon === 'google' ? (
                                                <svg className="w-6 h-6" viewBox="0 0 24 24">
                                                    <path
                                                        fill="currentColor"
                                                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                                    />
                                                    <path
                                                        fill="currentColor"
                                                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                                    />
                                                    <path
                                                        fill="currentColor"
                                                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                                                    />
                                                    <path
                                                        fill="currentColor"
                                                        d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                                    />
                                                </svg>
                                            ) : feature.icon === 'bucket' ? (
                                                <Tag className="w-6 h-6 text-amber-500 fill-amber-500/20" />
                                            ) : (
                                                <Zap className="w-6 h-6 text-primary fill-primary/20" />
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-sm font-bold text-white mb-0.5">{feature.title}</h3>
                                            <p className="text-xs text-white/50 leading-relaxed truncate-2-lines">{feature.description}</p>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>

                            <motion.div
                                initial={{ y: 10, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.6 }}
                                className="w-full pt-2 pb-2"
                            >
                                <Button
                                    onClick={handleClose}
                                    className="w-full bg-white text-black hover:bg-white/90 font-black h-14 rounded-2xl shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] text-sm tracking-widest uppercase"
                                >
                                    {LATEST_FEATURE_ANNOUNCEMENT.buttonText}
                                </Button>
                            </motion.div>
                        </div>

                        {/* Subtle Top Shine */}
                        <div className="absolute top-0 left-0 w-full h-[1px] bg-white/20" />
                        <div className="absolute top-0 left-1/4 w-1/2 h-[2px] bg-gradient-to-r from-transparent via-white/40 to-transparent" />

                        {/* Custom scrollbar styles */}
                        <style jsx global>{`
                            .custom-scrollbar::-webkit-scrollbar {
                                width: 4px;
                            }
                            .custom-scrollbar::-webkit-scrollbar-track {
                                background: transparent;
                            }
                            .custom-scrollbar::-webkit-scrollbar-thumb {
                                background: rgba(255, 255, 255, 0.1);
                                border-radius: 10px;
                            }
                            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                                background: rgba(255, 255, 255, 0.2);
                            }
                        `}</style>

                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
