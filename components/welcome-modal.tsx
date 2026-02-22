'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle2, Zap, Users, RefreshCw, BarChart3, QrCode, Upload, Bell, Globe, FileDown } from 'lucide-react';
import { WELCOME_FEATURES } from '@/lib/feature-flags';
import { Button } from '@/components/ui/button';

interface WelcomeModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ICON_MAP: Record<string, any> = {
    zap: Zap,
    users: Users,
    refresh: RefreshCw,
    qr: QrCode,
    upload: Upload,
    chart: BarChart3,
    bell: Bell,
    globe: Globe,
    export: FileDown,
};

export function WelcomeModal({ isOpen, onClose }: WelcomeModalProps) {
    const handleClose = () => {
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-md"
                        onClick={handleClose}
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: "spring", duration: 0.6, bounce: 0.3 }}
                        className="relative w-full max-w-2xl bg-[#0A0A0B]/98 backdrop-blur-xl border border-white/10 rounded-[2.5rem] shadow-[0_0_50px_-12px_rgba(138,43,226,0.3)] overflow-hidden z-[70]"
                    >
                        {/* Decorative Background Elements */}
                        <div className="absolute -top-32 -left-32 w-80 h-80 bg-primary/20 rounded-full blur-[100px] opacity-40 animate-pulse" />
                        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-purple-600/20 rounded-full blur-[100px] opacity-40 animate-pulse" />

                        <div className="flex flex-col max-h-[90vh]">
                            {/* Scrollable Content Area */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-10 pb-4">
                                {/* Header */}
                                <div className="text-center space-y-3 mb-8 sm:mb-10">
                                    <motion.div
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        transition={{ delay: 0.3 }}
                                        className="inline-flex items-center justify-center p-3 rounded-2xl bg-white/5 border border-white/10 mb-2 sm:mb-4"
                                    >
                                        <CheckCircle2 className="w-8 h-8 text-primary drop-shadow-[0_0_12px_rgba(138,43,226,0.8)]" />
                                    </motion.div>
                                    <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight px-4">
                                        Welcome to <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-400">Novira</span>
                                    </h1>
                                    <p className="text-white/50 text-xs sm:text-sm max-w-[320px] mx-auto leading-relaxed">
                                        The Ultimate Hub to track, manage and split your expenses with ease.
                                    </p>
                                </div>

                                {/* Features Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
                                    {WELCOME_FEATURES.map((feature, idx) => {
                                        const IconComponent = ICON_MAP[feature.icon] || Zap;
                                        return (
                                            <motion.div
                                                key={idx}
                                                initial={{ opacity: 0, scale: 0.95 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: 0.4 + idx * 0.05 }}
                                                className="p-4 rounded-3xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-white/10 transition-all duration-300 group"
                                            >
                                                <div className="flex gap-4 items-center sm:items-start h-full">
                                                    <div className="shrink-0 p-2.5 rounded-xl bg-white/5 border border-white/10 text-white transition-all duration-300 group-hover:border-primary/50 group-hover:bg-primary/10 group-hover:scale-110">
                                                        <IconComponent className="w-5 h-5" />
                                                    </div>
                                                    <div className="space-y-1 py-0.5">
                                                        <h3 className="text-sm font-bold text-white group-hover:text-primary transition-colors">
                                                            {feature.title}
                                                        </h3>
                                                        <p className="text-[11px] text-white/40 leading-relaxed group-hover:text-white/60 transition-colors">
                                                            {feature.description}
                                                        </p>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Sticky/Fixed Footer Action */}
                            <div className="p-5 sm:p-8 pt-4 border-t border-white/5 bg-black/98 backdrop-blur-xl">
                                <Button
                                    onClick={handleClose}
                                    className="w-full bg-white text-black hover:bg-white/90 font-black h-12 rounded-2xl shadow-[0_0_30px_-5px_rgba(255,255,255,0.3)] transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] text-sm uppercase tracking-widest"
                                >
                                    Get Started
                                </Button>
                            </div>
                        </div>

                        {/* Top Accent Line */}
                        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />

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
