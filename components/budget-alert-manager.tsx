'use client';

import React, { useEffect, useState } from 'react';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { AlertTriangle, X, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsNative } from '@/hooks/use-native';
import { toast, ImpactStyle } from '@/utils/haptics';

interface BudgetAlertManagerProps {
    totalSpent: number;
}

export function BudgetAlertManager({ totalSpent }: BudgetAlertManagerProps) {
    const { budgetAlertsEnabled, monthlyBudget, formatCurrency } = useUserPreferences();
    const [showAlert, setShowAlert] = useState(false);
    const [hasTriggered, setHasTriggered] = useState(false);
    const router = useRouter();
    const isNative = useIsNative();

    useEffect(() => {
        if (!budgetAlertsEnabled || monthlyBudget <= 0) {
            setShowAlert(false);
            return;
        }

        const percentage = (totalSpent / monthlyBudget) * 100;

        if (percentage >= 80) {
            if (!hasTriggered) {
                setShowAlert(true);
                setHasTriggered(true);
                // Haptic feedback when alert first appears
                if (isNative) toast.haptic(ImpactStyle.Heavy);
            }
        } else {
            setShowAlert(false);
            setHasTriggered(false);
        }
    }, [totalSpent, monthlyBudget, budgetAlertsEnabled, hasTriggered, isNative]);

    const percentage = Math.min((totalSpent / monthlyBudget) * 100, 100);
    const isOverBudget = totalSpent > monthlyBudget;

    return (
        <AnimatePresence>
            {showAlert && (
                <motion.div
                    initial={{ opacity: 0, y: 40, scale: 0.9 }}
                    animate={{
                        opacity: 1,
                        y: 0,
                        scale: 1,
                        transition: { type: 'spring', stiffness: 380, damping: 22, mass: 0.8 }
                    }}
                    exit={{ opacity: 0, y: 20, scale: 0.95, transition: { duration: 0.2 } }}
                    className="fixed bottom-24 left-4 right-4 z-50 md:left-1/2 md:-translate-x-1/2 md:max-w-md"
                >
                    <div className={cn(
                        "relative overflow-hidden rounded-2xl border p-4 shadow-2xl backdrop-blur-xl",
                        isOverBudget
                            ? "bg-gradient-to-br from-red-950/95 to-rose-950/90 border-red-500/40 shadow-red-500/25"
                            : "bg-gradient-to-br from-amber-950/95 to-orange-950/90 border-amber-500/40 shadow-amber-500/25"
                    )}>
                        {/* Ambient glow pulse */}
                        <motion.div
                            animate={{ opacity: [0.4, 0.8, 0.4] }}
                            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                            className={cn(
                                "absolute inset-0 rounded-2xl pointer-events-none",
                                isOverBudget
                                    ? "shadow-[inset_0_0_30px_rgba(239,68,68,0.12)]"
                                    : "shadow-[inset_0_0_30px_rgba(245,158,11,0.12)]"
                            )}
                        />

                        {/* Dismiss */}
                        <button
                            onClick={() => setShowAlert(false)}
                            aria-label="Dismiss alert"
                            className="absolute right-3 top-3 p-1 rounded-full text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        <div className="flex items-start gap-3 pr-6">
                            {/* Icon with pulse ring */}
                            <div className="relative shrink-0 mt-0.5">
                                <motion.div
                                    animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
                                    transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                                    className={cn(
                                        "absolute inset-0 rounded-full",
                                        isOverBudget ? "bg-red-500/50" : "bg-amber-500/50"
                                    )}
                                />
                                <div className={cn(
                                    "relative w-9 h-9 rounded-full flex items-center justify-center",
                                    isOverBudget ? "bg-red-500/20 border border-red-500/40" : "bg-amber-500/20 border border-amber-500/40"
                                )}>
                                    <AlertTriangle className={cn(
                                        "w-4 h-4",
                                        isOverBudget ? "text-red-400" : "text-amber-400"
                                    )} />
                                </div>
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <p className={cn(
                                    "text-sm font-bold",
                                    isOverBudget ? "text-red-300" : "text-amber-300"
                                )}>
                                    {isOverBudget ? 'Budget Exceeded' : 'Approaching Budget Limit'}
                                </p>
                                <p className="text-xs text-white/60 mt-0.5 leading-relaxed">
                                    {isOverBudget
                                        ? `You've spent ${formatCurrency(totalSpent)}, which is ${formatCurrency(totalSpent - monthlyBudget)} over your budget.`
                                        : `You've used ${percentage.toFixed(0)}% of your ${formatCurrency(monthlyBudget)} monthly budget.`
                                    }
                                </p>
                                <button
                                    onClick={() => { setShowAlert(false); router.push('/settings'); }}
                                    className={cn(
                                        "mt-2.5 flex items-center gap-1 text-xs font-bold transition-opacity hover:opacity-80",
                                        isOverBudget ? "text-red-400" : "text-amber-400"
                                    )}
                                >
                                    Adjust Budget <ArrowRight className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
