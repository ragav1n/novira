'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Users, Tag, PieChart, FileDown, Plus, Wallet, Globe, X, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type HowToUseDialogProps = {
    isOpen: boolean;
    onClose: () => void;
};

export function HowToUseDialog({ isOpen, onClose }: HowToUseDialogProps) {
    const steps = [
        {
            icon: <Plus className="w-6 h-6 text-emerald-400" />,
            title: "Log & Categorize Transactions ",
            desc: "The core of Novira is simple: hit the floating (+) button anywhere to record a spend. We'll automatically categorize common merchants for you. Travelling? Select a different currency from the dropdown and we'll instantly convert the amount to your base currency using real-time foreign exchange rates. You can even attach receipts directly for digital proof.",
            subPoints: [
                "Intelligent categorization (Food, Transport, etc.)",
                "Real-time FX conversions for 160+ currencies",
                "Receipt attachment for digital records"
            ]
        },
        {
            icon: <Users className="w-6 h-6 text-blue-400" />,
            title: "Manage Friends, Groups & Splitting",
            desc: "Money shouldn't be awkward. Add friends by email or scan their unique QR codes to connect instantly. Create shared Groups for trips, rent, or dinners. You can split bills equally, by exact percentages, or by custom shares. Settle up with a single tap, keeping a clear history of every payment made between you and your friends.",
            subPoints: [
                "Scan-to-add friend QR codes",
                "Granular bill splitting rules",
                "One-tap debt settlement tracking"
            ]
        },
        {
            icon: <Tag className="w-6 h-6 text-cyan-500" />,
            title: "Missions, Buckets & Focus",
            desc: "Stop mixing your 'Life' money with your 'Goal' money. Create a Mission Bucket for a specific trip (e.g. 'Germany 2024') or a big purchase. Use the Dashboard Focus pill to swap your entire screen to view ONLY that mission's localized budget and pacing. This helps you stay perfectly on track for big goals without cluttering your daily habit tracking.",
            subPoints: [
                "Isolated dashboard views for specific Missions",
                "Localized currency and budget targets per goal",
                "Exclude mission spending from regular daily tracking"
            ]
        },
        {
            icon: <Wallet className="w-6 h-6 text-primary" />,
            title: "Monthly Allowance & Funding",
            desc: "Master your pacing by setting a Universal Monthly Allowance in Settings. This gives you a clear 'Safe to Spend' limit every month. If you have extra income, a refund, or a salary bonus, use 'Add Funds' to safely boost your remaining allowance. Our pacing calculator constantly monitors your burn rate to tell you exactly how much you can spend per day.",
            subPoints: [
                "Personalized monthly allowance tracking",
                "Add Income/Refunds without skewing expense data",
                "Predictive pacing (Daily Safe to Spend indicator)"
            ]
        },
        {
            icon: <PieChart className="w-6 h-6 text-violet-400" />,
            title: "Deep Spending Analytics",
            desc: "Knowledge is power. The Analytics tab breaks down your spending into interactive, clickable pie charts. See exactly which categories eat your budget and which payment methods you use most. Switch between category and payment views to get a 360-degree view of your financial health, or use trend lines to spot spending spikes.",
            subPoints: [
                "Interactive pie charts for Categories & Methods",
                "Historical trend analysis through line graphs",
                "Date-range filtering for deep audits"
            ]
        },
        {
            icon: <FileDown className="w-6 h-6 text-pink-400" />,
            title: "Professional PDF Reports",
            desc: "Take your data anywhere. Export beautiful, multi-page PDF reports that include monthly recaps, charts, and detailed transaction logs. Perfect for taxes, reimbursement claims, or just personal archiving. If you prefer raw numbers, export to CSV for use in any spreadsheet application like Excel or Google Sheets.",
            subPoints: [
                "CFO-grade PDF reports with charts & summaries",
                "Raw CSV data backups for custom analysis",
                "Automatic flagging of 'Excluded' transaction types"
            ]
        }
    ];

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/85 backdrop-blur-md"
                        onClick={onClose}
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: "spring", duration: 0.6, bounce: 0.3 }}
                        className="relative w-full max-w-2xl bg-[#0A0A0B]/98 backdrop-blur-xl border border-white/10 rounded-[2.5rem] shadow-[0_0_50px_-12px_rgba(138,43,226,0.3)] overflow-hidden z-[110]"
                    >
                        {/* Decorative Background Elements */}
                        <div className="absolute -top-32 -left-32 w-80 h-80 bg-primary/20 rounded-full blur-[100px] opacity-40 animate-pulse pointer-events-none" />
                        <div className="absolute -bottom-32 -right-32 w-80 h-80 bg-purple-600/20 rounded-full blur-[100px] opacity-40 animate-pulse pointer-events-none" />

                        <div className="flex flex-col max-h-[90vh]">
                            
                            {/* Header - Fixed with Premium Style */}
                            <div className="relative p-8 pb-6 shrink-0 border-b border-white/5 bg-white/5 z-10 text-center flex flex-col items-center">
                                <motion.div
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ delay: 0.2 }}
                                    className="inline-flex items-center justify-center p-3.5 rounded-2xl bg-white/5 border border-white/10 mb-5"
                                >
                                    <Zap className="w-8 h-8 text-primary drop-shadow-[0_0_12px_rgba(138,43,226,0.8)]" />
                                </motion.div>
                                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight px-4">
                                    How to Use <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-400">Novira</span>
                                </h1>
                                <p className="text-white/50 text-xs sm:text-sm max-w-[360px] mx-auto leading-relaxed mt-3">
                                    Master these 6 core mechanics to unlock the full potential of your financial journey.
                                </p>
                                
                                <button 
                                    onClick={onClose}
                                    className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 text-white/30 hover:text-white transition-all duration-300"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Scrollable Content Area - Single Column */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 sm:px-10 py-6 sm:py-8">
                                <div className="space-y-4 pb-4">
                                    {steps.map((step, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.1 + i * 0.05 }}
                                            className="group relative p-5 sm:p-6 rounded-3xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-white/10 transition-all duration-500"
                                        >
                                            <div className="flex flex-col sm:flex-row gap-5 sm:gap-6">
                                                <div className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-primary/50 group-hover:bg-primary/10 transition-all duration-500 shadow-sm group-hover:scale-110 group-hover:rotate-3 self-start">
                                                    {step.icon}
                                                </div>
                                                <div className="space-y-3 flex-1">
                                                    <h3 className="text-base sm:text-lg font-extrabold text-white group-hover:text-primary transition-colors">
                                                        {step.title}
                                                    </h3>
                                                    <p className="text-[12px] sm:text-[13px] text-white/50 leading-relaxed group-hover:text-white/70 transition-colors">
                                                        {step.desc}
                                                    </p>
                                                    <div className="pt-3 grid grid-cols-1 gap-2">
                                                        {step.subPoints.map((point, idx) => (
                                                            <div key={idx} className="flex items-start gap-2.5 text-[11px] sm:text-[11px] font-semibold text-white/30 group-hover:text-white/50 transition-colors">
                                                                <CheckCircle2 className="w-3.5 h-3.5 text-primary/40 mt-0.5 shrink-0" />
                                                                <span className="leading-tight">{point}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>

                            {/* Fixed Footer Action */}
                            <div className="p-8 border-t border-white/5 bg-black/98 backdrop-blur-xl shrink-0 z-10">
                                <Button
                                    onClick={onClose}
                                    className="w-full bg-white text-black hover:bg-white/90 font-black h-14 rounded-2xl shadow-[0_0_30px_-5px_rgba(255,255,255,0.3)] transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] text-sm uppercase tracking-widest"
                                >
                                    Got it! Let's Go
                                </Button>
                            </div>

                        </div>

                        {/* Top Accent Line */}
                        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent flex" />
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
