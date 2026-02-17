'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap } from 'lucide-react'; // Using Zap as a generic feature icon
import { LATEST_FEATURE_ANNOUNCEMENT } from '@/lib/feature-flags';
import { Button } from '@/components/ui/button';

interface FeatureAnnouncementModalProps {
    showAnnouncement?: boolean;
    onClose?: () => void;
}

export function FeatureAnnouncementModal({ showAnnouncement = false, onClose }: FeatureAnnouncementModalProps) {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        if (showAnnouncement) {
            setIsOpen(true);
        }
    }, [showAnnouncement]);

    const handleClose = () => {
        setIsOpen(false);
        // Save to localStorage so we don't show it again
        localStorage.setItem('last_seen_feature_id', LATEST_FEATURE_ANNOUNCEMENT.id);
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
                        className="relative w-full max-w-sm bg-[#0D0D0F]/80 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-[0_0_80px_-15px_rgba(138,43,226,0.4)] overflow-hidden z-[70] mx-4"
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
                        <div className="p-10 text-center space-y-8 relative z-10 flex flex-col items-center">
                            {/* Premium Icon Container */}
                            <motion.div
                                initial={{ y: -10, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.2 }}
                                className="relative group"
                            >
                                <div className="absolute -inset-2 bg-gradient-to-r from-primary/50 to-purple-500/50 rounded-[2rem] blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl flex items-center justify-center border border-white/20 shadow-[inset_0_0_20px_rgba(255,255,255,0.05)]">
                                    <Zap className="w-12 h-12 text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.6)] animate-[pulse_3s_infinite]" />
                                </div>
                            </motion.div>

                            <div className="space-y-3">
                                <motion.h1
                                    initial={{ y: 10, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.3 }}
                                    className="text-2xl font-black text-white tracking-tight leading-tight"
                                >
                                    {LATEST_FEATURE_ANNOUNCEMENT.title}
                                </motion.h1>
                                <motion.p
                                    initial={{ y: 10, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.4 }}
                                    className="text-white/60 text-sm leading-relaxed font-medium"
                                >
                                    {LATEST_FEATURE_ANNOUNCEMENT.description}
                                </motion.p>
                            </div>

                            <motion.div
                                initial={{ y: 10, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.5 }}
                                className="w-full"
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

                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
