'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Users, Tag, PieChart, Plus, Wallet, Globe, X, CheckCircle2, MapPin, RefreshCcw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

type HowToUseDialogProps = {
    isOpen: boolean;
    onClose: () => void;
};

export function HowToUseDialog({ isOpen, onClose }: HowToUseDialogProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const steps = [
        {
            icon: <Plus className="w-6 h-6 text-emerald-400" />,
            title: "Precision Recording",
            desc: "Hit the floating (+) button anywhere to record a spend. Our Smart Location Memory learns where you spend and automatically suggests locations for recurring descriptions. Travelling? Select a different currency from the dropdown and we'll instantly convert the amount to your base currency using real-time rates.",
            subPoints: [
                "Smart Location & Merchant memory",
                "Real-time FX for 160+ currencies",
                "Optional notes for paperless tracking"
            ]
        },
        {
            icon: <Users className="w-6 h-6 text-blue-400" />,
            title: "Social Connectivity",
            desc: "Money shouldn't be awkward. Add friends by scanning their unique QR codes or via email. Create shared Groups for trips, rent, or dinner parties. Split bills by percentage, exact amounts, or shares. Settle up with a single tap, keeping a clear history of every settlement.",
            subPoints: [
                "Scan-to-add friend QR codes",
                "Advanced bill splitting rules",
                "One-tap debt settlement tracking"
            ]
        },
        {
            icon: <MapPin className="w-6 h-6 text-rose-400" />,
            title: "Spatial Intelligence",
            desc: "Location is everything. Use the 'Expense Map' to visualize your finances in 3D. Our Clear-Sight Grid prevents occlusion, while Hover Insights reveal top merchants at a glance. Enable 'Heatmap' mode for density hotspots or 'Trip Trails' to see your spending pulse flow through the city.",
            subPoints: [
                "Clear-Sight 3D visualization",
                "Animated Flow Trails & Hover Insights",
                "Spending Density Heatmaps"
            ]
        },
        {
            icon: <Tag className="w-6 h-6 text-cyan-500" />,
            title: "Mission Buckets & Focus",
            desc: "Stop mixing your 'Life' money with your 'Goal' money. Create a Mission Bucket for specific travel or big purchases. Use the Dashboard Focus pill to isolate your entire view to ONLY that mission's localized budget and pacing. Stay perfectly on track for big goals without the clutter.",
            subPoints: [
                "Isolated goal-based Mission views",
                "Localized currency and budget targets",
                "Archive completed & settled missions"
            ]
        },
        {
            icon: <Wallet className="w-6 h-6 text-primary" />,
            title: "Predictive Guardrails",
            desc: "Set a Monthly Allowance in Settings to see your 'Safe to Spend' limit. We'll send smart alerts when you hit 80% of your budget. Use 'Add Funds' for income, bonuses, or refunds without skewing your expense reports. Our calculator tracks your burn rate in real-time.",
            subPoints: [
                "Monthly allowance & pacing tracker",
                "80% overspend safety alerts",
                "Income/Refund tracking via Add Funds"
            ]
        },
        {
            icon: <RefreshCcw className="w-6 h-6 text-orange-400" />,
            title: "Automation & Imports",
            desc: "Save hours of manual entry. Set up Recurring Expense templates for your subscriptions. Scale your tracking by importing bank statements (CSV/Excel) with smart keyword-to-category mapping. Plus, our proactive PWA technology ensures you're always on the newest, fastest version.",
            subPoints: [
                "Recurring expense automation",
                "Smart Bank Statement Import",
                "Proactive background app updates"
            ]
        },
        {
            icon: <Search className="w-6 h-6 text-amber-400" />,
            title: "Advanced Discovery",
            desc: "Find anything instantly. Search transactions by description, category, or bucket. Use powerful filters to narrow down by price range, payment method, or specific dates. Get a 'Total Filtered' summary to audit specific clusters of your spending life.",
            subPoints: [
                "Multi-criteria advanced filtering",
                "Unified global transaction search",
                "Total Filtered amount summaries"
            ]
        },
        {
            icon: <PieChart className="w-6 h-6 text-violet-400" />,
            title: "CFO-Grade Analytics",
            desc: "Knowledge is power. The Analytics tab breaks down spending into interactive pie charts and trend lines. Switch between category and payment views for a 360-degree audit. Export professional multi-page PDF reports with full summaries for tax or reimbursement.",
            subPoints: [
                "Interactive Pie & Trend analytics",
                "Professional PDF recaps with charts",
                "Raw CSV data backups & exports"
            ]
        }
    ];

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6">
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
                        className="relative w-full max-w-2xl bg-[#0A0A0B]/98 backdrop-blur-xl border border-white/10 rounded-[2.5rem] shadow-[0_0_50px_-12px_rgba(138,43,226,0.3)] overflow-hidden z-[1100]"
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
                                    Master Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-400">Financial Flow</span>
                                </h1>
                                <p className="text-white/50 text-xs sm:text-sm max-w-[360px] mx-auto leading-relaxed mt-3">
                                    Novira is a living pulse of your finances. Explore these 8 core mechanics to master your financial universe.
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
        </AnimatePresence>,
        document.body
    );
}
