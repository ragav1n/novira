'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Compass, Users, Tag, PieChart, Plus, Wallet, X, CheckCircle2, MapPin, RefreshCcw, Search, Home, Target, CalendarClock, BookOpen, ArrowRight } from 'lucide-react';
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
            title: "Smart Expense Capture",
            desc: "Tap (+) to log a spend in seconds. Take Photo to scan a receipt with the camera, or pick one from files — Novira auto-fills amount, merchant, and date. Type expressions like 12.5+3.20 right in the amount field and they're calculated for you. Description pills suggest your past expenses for one-tap fill.",
            subPoints: [
                "Take Photo or Scan Receipt — auto-fill amount, merchant, date",
                "Inline calculator in amount and split fields",
                "Description autocomplete pills with full prefill",
                "Real-time FX across 20 supported currencies"
            ]
        },
        {
            icon: <Wallet className="w-6 h-6 text-primary" />,
            title: "Living Dashboard",
            desc: "Your home screen reads your money at a glance. The big Spent card shows month-to-date with a vs-last-month delta and today's spend pill. The Month Forecasting widget projects where you'll land using a weighted recent run-rate, and the Cashflow Forecast chart plots your month's trajectory.",
            subPoints: [
                "vs-last-month delta and Today's spend pill",
                "Month Forecasting + Cashflow Forecast chart",
                "Coming-Up-This-Week strip for upcoming recurring charges",
                "Mid-bucket threshold alerts and digest pushes"
            ]
        },
        {
            icon: <Users className="w-6 h-6 text-blue-400" />,
            title: "Splits & Friends",
            desc: "Money shouldn't be awkward. Add friends by scanning a QR code or by email. Create Groups for trips, rent, or dinners. Split evenly or by custom amounts (each split field accepts expressions too). Smart Settle clears multiple debts in one tap.",
            subPoints: [
                "Even or custom-amount splits with calculator support",
                "Scan-to-add friend QR codes",
                "Smart Settle — clear all debts in one tap"
            ]
        },
        {
            icon: <Home className="w-6 h-6 text-indigo-400" />,
            title: "Dedicated Workspaces",
            desc: "Keep personal and shared finances apart. Switch into a Couple or Household workspace from the top of the dashboard — budgets, transactions, and analytics isolate to that group instantly.",
            subPoints: [
                "Isolated shared dashboards",
                "Custom joint monthly budgets",
                "Per-workspace transaction history"
            ]
        },
        {
            icon: <Tag className="w-6 h-6 text-cyan-500" />,
            title: "Mission Buckets",
            desc: "Create a Mission Bucket for trips or big purchases — each bucket has its own budget, currency, and date range. Use the Focus pill on the dashboard to isolate everything to one mission. Tags add a second dimension you can filter by anywhere.",
            subPoints: [
                "Localized currency and budget per mission",
                "Focus mode to isolate the dashboard",
                "Transaction tags for cross-cutting filters"
            ]
        },
        {
            icon: <Target className="w-6 h-6 text-emerald-400" />,
            title: "Savings Goals",
            desc: "Set targets like 'New Car' or 'Emergency Fund' and log periodic deposits. The Goals tab tracks progress, deposit history, and milestones over time.",
            subPoints: [
                "Visual progress tracking",
                "Deposit log history",
                "Long-term milestones"
            ]
        },
        {
            icon: <RefreshCcw className="w-6 h-6 text-orange-400" />,
            title: "Recurring & Subscriptions",
            desc: "Track everything that hits monthly in the Subscriptions tab. Novira detects silent price changes on your subs and surfaces them. Bulk edit lets you fix many transactions at once. Privacy mode hides amounts when you're not alone.",
            subPoints: [
                "Subscription calendar with price-change detection",
                "Bulk edit and privacy mode",
                "Daily / weekly digest push notifications"
            ]
        },
        {
            icon: <CalendarClock className="w-6 h-6 text-amber-400" />,
            title: "Calendar & Cashflow",
            desc: "The cash flow calendar visualises your day-by-day spending so you can spot heavy weeks at a glance. Tap any day to drill in. Combined with Cashflow Forecast on the dashboard, you always know what's behind and what's ahead.",
            subPoints: [
                "Day-by-day cash flow calendar",
                "Drill into any day's transactions",
                "Forecast trajectory through end of month"
            ]
        },
        {
            icon: <MapPin className="w-6 h-6 text-rose-400" />,
            title: "Expense Map",
            desc: "Every geo-tagged spend appears on the Expense Map. Drag a pin anywhere, switch to Heatmap for density, or Trip Trails to see flows. The map remembers merchants so suggestions get sharper over time.",
            subPoints: [
                "Drag-drop pins, Heatmap & Trip Trails",
                "Smart Quick Pins from your visit history",
                "Place-aware smart default suggestions"
            ]
        },
        {
            icon: <Search className="w-6 h-6 text-violet-400" />,
            title: "Search & Analytics",
            desc: "Find anything by description, category, bucket, payment method, or date range — server-side, so it's fast even on 10k+ rows. The Analytics tab breaks down spending with interactive charts and exports professional multi-page PDF reports.",
            subPoints: [
                "Multi-criteria search with totals",
                "Interactive pie & trend analytics",
                "PDF reports and CSV exports"
            ]
        },
        {
            icon: <PieChart className="w-6 h-6 text-pink-400" />,
            title: "Allowance & Guardrails",
            desc: "Set a Monthly Allowance to see your Safe-to-Spend at all times. Smart alerts fire at 80% and again as you near the limit. Use Add Funds for income, refunds, or bonuses without polluting your expense reports.",
            subPoints: [
                "Monthly allowance with pacing",
                "Overspend safety alerts",
                "Add Funds for income & refunds"
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

                            {/* Header — compact so the first content card is visible without scrolling */}
                            <div className="relative px-5 sm:px-8 pt-5 pb-4 shrink-0 border-b border-white/5 bg-white/5 z-10 flex items-center gap-3">
                                <motion.div
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ delay: 0.15 }}
                                    className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 border border-white/10"
                                >
                                    <Compass className="w-5 h-5 text-primary drop-shadow-[0_0_8px_rgba(138,43,226,0.6)]" />
                                </motion.div>
                                <div className="min-w-0 flex-1">
                                    <h1 className="text-base sm:text-lg font-extrabold text-white tracking-tight leading-tight truncate">
                                        Master Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-400">Financial Flow</span>
                                    </h1>
                                    <p className="text-white/70 text-[11px] sm:text-xs leading-snug mt-0.5 line-clamp-2">
                                        A quick tour of the 11 core mechanics that make Novira tick.
                                    </p>
                                </div>
                                <button
                                    onClick={onClose}
                                    aria-label="Close"
                                    className="shrink-0 p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-all duration-300"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Scrollable Content Area - Single Column */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 sm:px-8 py-4 sm:py-5">
                                <div className="space-y-3 pb-2">
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
                                                    <p className="text-[12px] sm:text-[13px] text-white/80 leading-relaxed transition-colors">
                                                        {step.desc}
                                                    </p>
                                                    <div className="pt-3 grid grid-cols-1 gap-2">
                                                        {step.subPoints.map((point, idx) => (
                                                            <div key={idx} className="flex items-start gap-2.5 text-[11px] sm:text-[11px] font-semibold text-white/75 transition-colors">
                                                                <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
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
                            <div className="px-5 py-4 sm:px-8 sm:py-5 border-t border-white/5 bg-black/98 backdrop-blur-xl shrink-0 z-10 space-y-2.5">
                                <Button
                                    onClick={onClose}
                                    className="w-full bg-white text-black hover:bg-white/90 font-black h-12 rounded-2xl shadow-[0_0_30px_-5px_rgba(255,255,255,0.3)] transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] text-sm uppercase tracking-widest"
                                >
                                    Got it! Let's Go
                                </Button>
                                <Link
                                    href="/guide"
                                    onClick={onClose}
                                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-2.5 text-[12px] font-medium text-white/80 transition-colors hover:bg-white/[0.06] hover:text-white"
                                >
                                    <BookOpen className="w-3.5 h-3.5" />
                                    Read the full user guide
                                    <ArrowRight className="w-3 h-3" />
                                </Link>
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
