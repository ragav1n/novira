'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Compass, Users, Tag, PieChart, Plus, Wallet, X, CheckCircle2, MapPin, RefreshCcw, Search, Home, Target, CalendarClock, BookOpen, ArrowRight, Hand, Smartphone, Bell, Sparkles } from 'lucide-react';
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
            accent: 'from-emerald-500/30 to-teal-500/10',
            title: "Smart Expense Capture",
            desc: "Tap (+) to log a spend in seconds. Take Photo to scan a receipt with the camera, or pick one from files — Novira auto-fills amount, merchant, date, and category. Type expressions like 12.5+3.20 right in the amount field and they're calculated for you. Description pills suggest past expenses for one-tap fill.",
            subPoints: [
                "AI receipt scan — amount, merchant, date, category in <2s",
                "Inline calculator in amount and split fields",
                "Description autocomplete pills with full prefill",
                "Real-time FX across 20 supported currencies"
            ]
        },
        {
            icon: <Wallet className="w-6 h-6 text-primary" />,
            accent: 'from-primary/30 to-violet-500/10',
            title: "Living Dashboard",
            desc: "Your home screen reads your money at a glance. The big Spent card shows month-to-date with a vs-last-month delta and today's spend pill. Month Forecasting uses a weighted recent run-rate (60% last-7-day pace + 40% month-to-date) and the Cashflow Forecast chart plots your trajectory.",
            subPoints: [
                "vs-last-month delta and Today's spend pill",
                "Weighted-pace forecast + Cashflow chart",
                "Paginated history — 100 rows at a time, smooth on 10k+",
                "Coming-Up-This-Week strip for upcoming charges"
            ]
        },
        {
            icon: <Hand className="w-6 h-6 text-fuchsia-400" />,
            accent: 'from-fuchsia-500/30 to-pink-500/10',
            title: "Gestures Built In",
            desc: "Novira is gesture-first. Swipe-left on any transaction to reveal Edit and Delete with a satisfying spring. Pull-to-refresh anywhere on the dashboard. Drag panels in Settings → Dashboard layout to reorder. Long-press in Search to enter bulk-select mode.",
            subPoints: [
                "Swipe-left → Edit / Delete on every row",
                "Pull-to-refresh on dashboard & lists",
                "Drag-to-reorder dashboard panels per device",
                "Soft haptics on installed iPhone version"
            ]
        },
        {
            icon: <Smartphone className="w-6 h-6 text-sky-400" />,
            accent: 'from-sky-500/30 to-cyan-500/10',
            title: "Install Anywhere",
            desc: "Novira runs in your browser today, on your home screen tomorrow. One tap on iPhone (Share → Add to Home Screen), Android (three dots → Install app), or desktop Chrome / Edge (install icon in the address bar) — Novira gets its own icon, opens in a clean window, and unlocks offline + push.",
            subPoints: [
                "Install banner appears automatically after 3s",
                "Service worker keeps offline data and assets fresh",
                "Background Sync flushes the queue when you reconnect",
                "Tap Settings → About to see your installed version"
            ]
        },
        {
            icon: <Users className="w-6 h-6 text-blue-400" />,
            accent: 'from-blue-500/30 to-indigo-500/10',
            title: "Splits & Friends",
            desc: "Money shouldn't be awkward. Add friends by scanning a QR code or by email. Create Groups for trips, rent, or dinners. Split evenly or by custom amounts (each split field accepts expressions too). Smart Settle clears multiple debts in one tap with the fewest transfers possible.",
            subPoints: [
                "Even or custom-amount splits with calculator support",
                "Scan-to-add friend QR codes",
                "Smart Settle — minimum-transfer settlement",
                "Per-group running balances in any currency"
            ]
        },
        {
            icon: <Home className="w-6 h-6 text-indigo-400" />,
            accent: 'from-indigo-500/30 to-purple-500/10',
            title: "Dedicated Workspaces",
            desc: "Keep personal and shared finances apart. Switch into a Couple, Household, or Trip workspace from the dashboard header — budgets, transactions, and analytics isolate to that group instantly, with their own joint monthly budget.",
            subPoints: [
                "Isolated dashboards per workspace",
                "Custom joint monthly budgets",
                "Per-workspace transaction history & analytics"
            ]
        },
        {
            icon: <Tag className="w-6 h-6 text-cyan-400" />,
            accent: 'from-cyan-500/30 to-teal-500/10',
            title: "Mission Buckets",
            desc: "Create a Mission Bucket for trips or big purchases — each bucket has its own budget, currency, and date range. Use the Focus pill on the dashboard to isolate everything to one mission. Tags add a second dimension you can filter by anywhere.",
            subPoints: [
                "Localized currency and budget per mission",
                "Focus mode isolates the entire dashboard",
                "Transaction tags for cross-cutting filters"
            ]
        },
        {
            icon: <Target className="w-6 h-6 text-emerald-400" />,
            accent: 'from-emerald-500/30 to-green-500/10',
            title: "Savings Goals",
            desc: "Set targets like 'New Car' or 'Emergency Fund' and log periodic deposits. The Goals tab tracks progress, deposit history, and milestones. The What-If simulator on Analytics tells you how many months sooner you'd hit a goal if you cut a category.",
            subPoints: [
                "Visual progress with milestone markers",
                "Deposit log history",
                "What-If simulator links cuts to goal dates"
            ]
        },
        {
            icon: <RefreshCcw className="w-6 h-6 text-orange-400" />,
            accent: 'from-orange-500/30 to-amber-500/10',
            title: "Recurring & Subscriptions",
            desc: "Track everything that hits monthly in the Subscriptions tab. Novira watches your last three months and auto-detects subscriptions you forgot to add. It flags silent price drifts (e.g. Spotify ₹199 → ₹229) so you're never surprised. Bulk edit and Pause-Until make spring cleaning painless.",
            subPoints: [
                "Auto-detect subscriptions from 3 months of activity",
                "Price-drift alerts on quiet price hikes",
                "Pause, pin, bulk-edit",
                "Export bill schedule as a calendar file"
            ]
        },
        {
            icon: <Bell className="w-6 h-6 text-yellow-400" />,
            accent: 'from-yellow-500/30 to-orange-500/10',
            title: "Bills & Nudges",
            desc: "Opt into push notifications in Settings → Notifications and Novira can quietly buzz you for things that matter: a bill due tomorrow, a spending pace warning at 80% of allowance, a bucket deadline, or a daily / weekly recap. Quiet hours respect your local time.",
            subPoints: [
                "Bill reminders — off, 1 day, 3 days, or a week",
                "Spending-pace nudges at 80% of allowance",
                "Daily / weekly digest pushes",
                "Quiet hours (default 22:00 → 07:00)"
            ]
        },
        {
            icon: <CalendarClock className="w-6 h-6 text-amber-400" />,
            accent: 'from-amber-500/30 to-yellow-500/10',
            title: "Calendar & Cashflow",
            desc: "The cash flow calendar visualises day-by-day spending so heavy weeks pop out. Tap any day to drill in. Combined with the dashboard's Cashflow Forecast, you always know what's behind and what's ahead.",
            subPoints: [
                "Day-by-day cash flow heatmap",
                "Drill into any day's transactions",
                "End-of-month trajectory line"
            ]
        },
        {
            icon: <MapPin className="w-6 h-6 text-rose-400" />,
            accent: 'from-rose-500/30 to-pink-500/10',
            title: "Expense Map",
            desc: "Every geo-tagged spend appears on the Expense Map. Drag a pin anywhere, switch to Heatmap for density, or Trip Trails to see day-by-day flows. The map remembers merchants so suggestions get sharper over time.",
            subPoints: [
                "Drag-drop pins, Heatmap & Trip Trails",
                "Smart Quick Pins from your visit history",
                "Place-aware default suggestions"
            ]
        },
        {
            icon: <Search className="w-6 h-6 text-violet-400" />,
            accent: 'from-violet-500/30 to-purple-500/10',
            title: "Search & Analytics",
            desc: "Find anything by description, category, bucket, payment method, or date range — server-side, so it stays fast on 10k+ rows. Analytics now includes Custom Range with This-Week / Last-7 / YTD shortcuts and the What-If simulator that quantifies cuts against your goals.",
            subPoints: [
                "Server-side multi-criteria search",
                "Custom date range + presets in Analytics",
                "What-If simulator — monthly & yearly savings",
                "PDF reports and CSV exports"
            ]
        },
        {
            icon: <PieChart className="w-6 h-6 text-pink-400" />,
            accent: 'from-pink-500/30 to-fuchsia-500/10',
            title: "Allowance & Guardrails",
            desc: "Set a Monthly Allowance to see Safe-to-Spend at all times. Smart alerts fire at 80% and again near the limit. Use Add Funds for income, refunds, or bonuses without polluting expense reports. Privacy mode in the dashboard header blurs every amount on demand.",
            subPoints: [
                "Monthly allowance with weighted pacing",
                "Overspend safety alerts (80% / near-limit)",
                "Add Funds for income & refunds",
                "One-tap privacy blur"
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
                                    <p className="text-white/70 text-[11px] sm:text-xs leading-snug mt-0.5 line-clamp-2 inline-flex items-center gap-1.5">
                                        <Sparkles className="w-3 h-3 text-primary shrink-0" />
                                        A guided tour of the {steps.length} mechanics that make Novira tick.
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
                                            initial={{ opacity: 0, y: 14 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.08 + i * 0.04, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                                            className="group relative p-5 sm:p-6 rounded-3xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] hover:border-white/15 transition-all duration-500 overflow-hidden"
                                        >
                                            {/* Per-card accent glow — fades in on hover */}
                                            <div
                                                aria-hidden
                                                className={`pointer-events-none absolute -top-24 -right-24 w-56 h-56 rounded-full blur-3xl opacity-0 group-hover:opacity-60 transition-opacity duration-700 bg-gradient-to-br ${step.accent}`}
                                            />
                                            {/* Step index — subtle counter */}
                                            <span className="absolute top-3 right-4 text-[10px] font-mono uppercase tracking-widest text-white/30 group-hover:text-white/55 transition-colors">
                                                {String(i + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}
                                            </span>
                                            <div className="relative flex flex-col sm:flex-row gap-5 sm:gap-6">
                                                <motion.div
                                                    whileHover={{ scale: 1.08, rotate: 4 }}
                                                    transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                                                    className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:border-primary/50 group-hover:bg-primary/10 transition-colors duration-500 shadow-sm self-start"
                                                >
                                                    {step.icon}
                                                </motion.div>
                                                <div className="space-y-3 flex-1 min-w-0">
                                                    <h3 className="text-base sm:text-lg font-extrabold text-white group-hover:text-primary transition-colors pr-16">
                                                        {step.title}
                                                    </h3>
                                                    <p className="text-[12px] sm:text-[13px] text-white/80 leading-relaxed transition-colors">
                                                        {step.desc}
                                                    </p>
                                                    <div className="pt-3 grid grid-cols-1 gap-2">
                                                        {step.subPoints.map((point, idx) => (
                                                            <motion.div
                                                                key={idx}
                                                                initial={{ opacity: 0, x: -6 }}
                                                                animate={{ opacity: 1, x: 0 }}
                                                                transition={{ delay: 0.14 + i * 0.04 + idx * 0.04, duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                                                                className="flex items-start gap-2.5 text-[11px] sm:text-[11px] font-semibold text-white/75"
                                                            >
                                                                <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                                                                <span className="leading-tight">{point}</span>
                                                            </motion.div>
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
