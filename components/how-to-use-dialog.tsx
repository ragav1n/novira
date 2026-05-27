'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
    Compass, Users, Tag, PieChart, Plus, Wallet, X, CheckCircle2, MapPin,
    RefreshCcw, Search, Home, Target, CalendarClock, BookOpen, ArrowRight,
    Hand, Smartphone, Bell, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type HowToUseDialogProps = {
    isOpen: boolean;
    onClose: () => void;
};

type StepGroup = 'Capture' | 'Plan' | 'Share' | 'Understand' | 'Platform';

const GROUP_ORDER: StepGroup[] = ['Capture', 'Plan', 'Share', 'Understand', 'Platform'];

const GROUP_BLURB: Record<StepGroup, string> = {
    Capture: 'Get spending into Novira fast.',
    Plan: 'Budgets, allowances, and forecasting.',
    Share: 'Splits, friends, and shared workspaces.',
    Understand: 'Search the past, project the future.',
    Platform: 'Install, gesture, notify.',
};

type Step = {
    group: StepGroup;
    icon: React.ReactNode;
    title: string;
    desc: string;
    subPoints: string[];
};

const STEPS: Step[] = [
    {
        group: 'Capture',
        icon: <Plus className="w-5 h-5 text-emerald-300" />,
        title: 'Capture expenses',
        desc: "Tap (+) to log a spend. Scan a receipt with the camera or pick one from files; the form auto-fills amount, merchant, date, and category. Dictate the description with the mic, or type expressions like 12.5+3.20 in the amount field. Description pills suggest past entries for one-tap fill.",
        subPoints: [
            'Receipt scan — amount, merchant, date, category in under 2s',
            'Voice-to-description with live transcript preview',
            'Inline calculator in amount and split fields',
            'Description autocomplete pills with full prefill',
        ],
    },
    {
        group: 'Capture',
        icon: <RefreshCcw className="w-5 h-5 text-orange-300" />,
        title: 'Recurring & subscriptions',
        desc: "Track everything that hits monthly in the Subscriptions tab. Novira watches the last three months and auto-detects subscriptions you forgot to add. Silent price drifts get flagged (Spotify ₹199 → ₹229). Bulk edit and Pause-Until handle the rest.",
        subPoints: [
            'Auto-detect subscriptions from 3 months of activity',
            'Price-drift alerts on quiet price hikes',
            'Pause, pin, bulk-edit',
            'Export bill schedule as a calendar file',
        ],
    },
    {
        group: 'Plan',
        icon: <Wallet className="w-5 h-5 text-primary" />,
        title: 'Dashboard',
        desc: "The home screen reads your money at a glance. Spent shows month-to-date with a vs-last-month delta and today's pill. Forecasting uses a weighted run-rate (60% last-7-day pace + 40% month-to-date), and analytics shows the same projection against your budget. Green on pace, amber near the line, red over.",
        subPoints: [
            'Burn-rate projection chip with %-of-budget colors',
            "vs-last-month delta and Today's spend pill",
            'Paginated history — 100 rows at a time, smooth on 10k+',
            'Coming-Up-This-Week strip for upcoming charges',
        ],
    },
    {
        group: 'Plan',
        icon: <PieChart className="w-5 h-5 text-pink-300" />,
        title: 'Allowance & guardrails',
        desc: "Set a monthly allowance for a Safe-to-Spend number you can trust. Alerts fire at 80% and again near the limit. Add Funds covers income, refunds, and bonuses without polluting expense reports. Privacy mode blurs every amount on demand.",
        subPoints: [
            'Monthly allowance with weighted pacing',
            'Overspend alerts at 80% and near-limit',
            'Add Funds for income & refunds',
            'One-tap privacy blur',
        ],
    },
    {
        group: 'Plan',
        icon: <Tag className="w-5 h-5 text-cyan-300" />,
        title: 'Buckets',
        desc: "Create a bucket for a trip or a big purchase. Each one carries its own budget, currency, and date range. The Focus pill on the dashboard isolates everything to that bucket. Tags add a second axis you can filter by anywhere.",
        subPoints: [
            'Per-bucket currency and budget',
            'Focus mode isolates the whole dashboard',
            'Transaction tags for cross-cutting filters',
        ],
    },
    {
        group: 'Plan',
        icon: <Target className="w-5 h-5 text-emerald-300" />,
        title: 'Savings goals',
        desc: "Set targets like 'New car' or 'Emergency fund' and log deposits. The Goals tab tracks progress, deposit history, and milestones. The what-if simulator in Analytics shows how many months sooner you'd hit a goal by cutting a category.",
        subPoints: [
            'Progress with milestone markers',
            'Deposit log history',
            'What-if simulator links cuts to goal dates',
        ],
    },
    {
        group: 'Plan',
        icon: <CalendarClock className="w-5 h-5 text-amber-300" />,
        title: 'Calendar & cashflow',
        desc: "The calendar shows day-by-day spending so heavy weeks stand out. Tap any day to drill in. Paired with the dashboard's Cashflow Forecast, you can see what's behind and what's ahead.",
        subPoints: [
            'Day-by-day cash flow heatmap',
            "Drill into any day's transactions",
            'End-of-month trajectory line',
        ],
    },
    {
        group: 'Share',
        icon: <Users className="w-5 h-5 text-blue-300" />,
        title: 'Splits & friends',
        desc: "Add friends by QR code or email. Create groups for trips, rent, or dinners. Split evenly or by custom amounts; each split field accepts math expressions. Settle clears multiple debts in one tap using the fewest transfers possible. When a friend splits with you, balances update in real time.",
        subPoints: [
            'Real-time balance updates from friend splits',
            'One-tap 50/50 with your most-frequent partner',
            'Even or custom-amount splits with calculator support',
            'Settle — minimum-transfer settlement',
        ],
    },
    {
        group: 'Share',
        icon: <Home className="w-5 h-5 text-indigo-300" />,
        title: 'Workspaces',
        desc: "Keep personal and shared finances apart. Switch into a Couple, Household, or Trip workspace from the dashboard header. Budgets, transactions, and analytics isolate to that group, with its own joint monthly budget.",
        subPoints: [
            'Isolated dashboards per workspace',
            'Custom joint monthly budgets',
            'Per-workspace history & analytics',
        ],
    },
    {
        group: 'Understand',
        icon: <Search className="w-5 h-5 text-violet-300" />,
        title: 'Search & analytics',
        desc: "Find anything by description, category, bucket, payment method, or date range. Search runs server-side, so it stays fast on 10k+ rows. Analytics covers a custom range with This week, Last 7, and YTD shortcuts, plus the what-if simulator that quantifies cuts against your goals.",
        subPoints: [
            'Server-side multi-criteria search',
            'Custom date range + presets',
            'What-if simulator — monthly & yearly savings',
            'PDF reports and CSV exports',
        ],
    },
    {
        group: 'Understand',
        icon: <MapPin className="w-5 h-5 text-rose-300" />,
        title: 'Expense map',
        desc: "Every geo-tagged spend lands on the map. Drag a pin anywhere, switch to Heatmap for density, or Trip Trails to see day-by-day flow. The map remembers merchants and reuses them as defaults.",
        subPoints: [
            'Drag-drop pins, Heatmap, and Trip Trails',
            'Quick Pins from your visit history',
            'Place-aware default suggestions',
        ],
    },
    {
        group: 'Platform',
        icon: <Smartphone className="w-5 h-5 text-sky-300" />,
        title: 'Install anywhere',
        desc: "Novira runs in the browser, and on your home screen too. One tap on iPhone (Share → Add to Home Screen), Android (three dots → Install app), or desktop Chrome and Edge (install icon in the address bar). You get an icon, a clean window, offline, and push.",
        subPoints: [
            'Install banner appears after 3s',
            'Service worker keeps offline data and assets fresh',
            'Background Sync flushes the queue on reconnect',
            'Settings → About shows your installed version',
        ],
    },
    {
        group: 'Platform',
        icon: <Hand className="w-5 h-5 text-fuchsia-300" />,
        title: 'Gestures',
        desc: "Swipe-left on any transaction to reveal Edit and Delete. Pull-to-refresh on the dashboard and lists. Drag panels in Settings → Dashboard layout to reorder. Long-press in Search to enter bulk-select mode.",
        subPoints: [
            'Swipe-left → Edit / Delete on every row',
            'Pull-to-refresh on dashboard & lists',
            'Drag-to-reorder dashboard panels per device',
            'Soft haptics on installed iPhone',
        ],
    },
    {
        group: 'Platform',
        icon: <Bell className="w-5 h-5 text-yellow-300" />,
        title: 'Bills & nudges',
        desc: "Opt into push in Settings → Notifications. Novira can ping for a bill due tomorrow, a pace warning at 80% of allowance, a bucket deadline, or a daily or weekly recap. Quiet hours respect your local time.",
        subPoints: [
            'Bill reminders — off, 1 day, 3 days, or a week',
            'Spending-pace nudges at 80%',
            'Daily / weekly digest pushes',
            'Quiet hours (default 22:00 → 07:00)',
        ],
    },
];

export function HowToUseDialog({ isOpen, onClose }: HowToUseDialogProps) {
    const [mounted, setMounted] = useState(false);
    const [openGroups, setOpenGroups] = useState<Set<StepGroup>>(new Set(['Capture']));

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (isOpen) setOpenGroups(new Set(['Capture']));
    }, [isOpen]);

    const stepsByGroup = useMemo(() => {
        const m = new Map<StepGroup, Step[]>();
        for (const g of GROUP_ORDER) m.set(g, []);
        for (const s of STEPS) m.get(s.group)!.push(s);
        return m;
    }, []);

    const toggleGroup = (group: StepGroup) => {
        setOpenGroups((prev) => {
            const next = new Set(prev);
            if (next.has(group)) next.delete(group);
            else next.add(group);
            return next;
        });
    };

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
                        transition={{ type: 'spring', duration: 0.6, bounce: 0.3 }}
                        className="relative w-full max-w-2xl bg-[#0A0A0B]/98 backdrop-blur-xl border border-white/10 rounded-[2.5rem] shadow-[0_0_50px_-12px_rgba(138,43,226,0.3)] overflow-hidden z-[1100]"
                    >
                        <div className="pointer-events-none absolute -top-32 -left-32 w-80 h-80 bg-primary/20 rounded-full blur-[100px] opacity-40" />
                        <div className="pointer-events-none absolute -bottom-32 -right-32 w-80 h-80 bg-purple-600/20 rounded-full blur-[100px] opacity-40" />
                        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

                        <div className="relative flex flex-col max-h-[90vh]">
                            <div className="px-5 sm:px-7 pt-5 pb-4 shrink-0 border-b border-white/5 flex items-center gap-3">
                                <div className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white/5 border border-white/10">
                                    <Compass className="w-5 h-5 text-primary drop-shadow-[0_0_8px_rgba(138,43,226,0.6)]" aria-hidden="true" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary mb-0.5">
                                        Help
                                    </div>
                                    <h1 className="text-base sm:text-lg font-extrabold text-white tracking-tight leading-tight">
                                        How Novira works
                                    </h1>
                                    <p className="text-[11.5px] text-white/55 leading-snug mt-0.5">
                                        Five sections. Tap one to expand.
                                    </p>
                                </div>
                                <button
                                    onClick={onClose}
                                    aria-label="Close"
                                    className="shrink-0 p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 sm:px-7 py-4 sm:py-5">
                                <div className="space-y-2.5">
                                    {GROUP_ORDER.map((group) => {
                                        const groupSteps = stepsByGroup.get(group) ?? [];
                                        const isExpanded = openGroups.has(group);
                                        return (
                                            <div
                                                key={group}
                                                className="rounded-2xl border border-white/8 bg-white/[0.025] overflow-hidden"
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => toggleGroup(group)}
                                                    aria-expanded={isExpanded}
                                                    className="w-full px-4 sm:px-5 py-3.5 flex items-center gap-3 text-left hover:bg-white/[0.03] transition-colors"
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-baseline gap-2">
                                                            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                                                                {group}
                                                            </span>
                                                            <span className="text-[10px] font-mono text-white/35">
                                                                {groupSteps.length}
                                                            </span>
                                                        </div>
                                                        <p className="text-[12px] text-white/65 leading-snug mt-0.5">
                                                            {GROUP_BLURB[group]}
                                                        </p>
                                                    </div>
                                                    <ChevronDown
                                                        className={cn(
                                                            'w-4 h-4 text-white/55 shrink-0 transition-transform duration-300',
                                                            isExpanded && 'rotate-180'
                                                        )}
                                                        aria-hidden="true"
                                                    />
                                                </button>

                                                <AnimatePresence initial={false}>
                                                    {isExpanded && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                                                            className="overflow-hidden"
                                                        >
                                                            <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-1 space-y-2">
                                                                {groupSteps.map((step, i) => (
                                                                    <motion.div
                                                                        key={step.title}
                                                                        initial={{ opacity: 0, y: 6 }}
                                                                        animate={{ opacity: 1, y: 0 }}
                                                                        transition={{ delay: i * 0.04, duration: 0.3 }}
                                                                        className="rounded-xl border border-white/5 bg-white/[0.02] p-4 sm:p-5"
                                                                    >
                                                                        <div className="flex flex-col sm:flex-row gap-4">
                                                                            <div className="shrink-0 w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center self-start">
                                                                                {step.icon}
                                                                            </div>
                                                                            <div className="space-y-2.5 flex-1 min-w-0">
                                                                                <h3 className="text-[14px] sm:text-[15px] font-bold text-white tracking-tight">
                                                                                    {step.title}
                                                                                </h3>
                                                                                <p className="text-[12px] sm:text-[12.5px] text-white/70 leading-relaxed">
                                                                                    {step.desc}
                                                                                </p>
                                                                                <div className="pt-1 grid grid-cols-1 gap-1.5">
                                                                                    {step.subPoints.map((point) => (
                                                                                        <div
                                                                                            key={point}
                                                                                            className="flex items-start gap-2 text-[11.5px] text-white/65"
                                                                                        >
                                                                                            <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" aria-hidden="true" />
                                                                                            <span className="leading-snug">{point}</span>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </motion.div>
                                                                ))}
                                                            </div>
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="px-5 py-4 sm:px-7 sm:py-5 border-t border-white/5 bg-black/40 backdrop-blur-xl shrink-0 space-y-2.5">
                                <Button
                                    onClick={onClose}
                                    className="w-full bg-white text-black hover:bg-white/90 font-bold h-11 rounded-2xl text-sm"
                                >
                                    Close
                                </Button>
                                <Link
                                    href="/guide"
                                    onClick={onClose}
                                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-2.5 text-[12px] font-medium text-white/75 hover:bg-white/[0.06] hover:text-white transition-colors"
                                >
                                    <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                                    Full guide
                                    <ArrowRight className="w-3 h-3" aria-hidden="true" />
                                </Link>
                            </div>
                        </div>

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
