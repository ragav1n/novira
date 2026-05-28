'use client';

import { cn } from '@/lib/utils';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { useWorkspaceTheme } from '@/hooks/useWorkspaceTheme';
import { ALL_FREQUENCIES, type Frequency } from '@/lib/subscriptions-utils';
import { Sparkles } from 'lucide-react';

export type TrialPill = {
    description: string;
    daysLeft: number;
};

interface Props {
    totalMonthly: number;
    totalYearly: number;
    totalActiveCount: number;
    pausedCount: number;
    breakdown: Record<Frequency, { count: number; monthly: number }>;
    nextTrialEnding: TrialPill | null;
}

export function SubscriptionSummaryCard({
    totalMonthly,
    totalYearly,
    totalActiveCount,
    pausedCount,
    breakdown,
    nextTrialEnding,
}: Props) {
    const { formatCurrency } = useUserPreferences();
    const { theme: themeConfig } = useWorkspaceTheme();

    const activeFrequencies = ALL_FREQUENCIES.filter(f => breakdown[f].count > 0);

    return (
        <section className="space-y-3 text-center">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                Estimated monthly
                <span className="opacity-70">
                    {' · '}{totalActiveCount} active
                    {pausedCount > 0 ? ` · ${pausedCount} paused` : ''}
                </span>
            </p>

            <div className="flex items-end justify-center gap-3 flex-wrap">
                <h3 className={cn('text-[40px] leading-none font-bold tracking-tight tabular-nums', themeConfig.text)}>
                    {formatCurrency(totalMonthly)}
                </h3>
                {totalActiveCount > 0 && (
                    <span className="text-[11px] text-muted-foreground/70 mb-1.5 tabular-nums">
                        ≈ {formatCurrency(totalYearly)} / yr
                    </span>
                )}
            </div>

            {nextTrialEnding && (
                <div className="flex justify-center pt-0.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 border border-amber-500/25 text-amber-300">
                        <Sparkles className="w-3 h-3" aria-hidden="true" />
                        <span>
                            Trial ends in {Math.max(0, nextTrialEnding.daysLeft)}d
                        </span>
                        <span className="text-amber-200/70">·</span>
                        <span className="truncate max-w-[140px]">{nextTrialEnding.description}</span>
                    </span>
                </div>
            )}

            {activeFrequencies.length > 0 && (
                <div className="flex items-center justify-center gap-1.5 flex-wrap pt-1">
                    {activeFrequencies.map(f => (
                        <span
                            key={f}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] bg-card/40 border border-white/[0.06] backdrop-blur-sm"
                        >
                            <span className="font-semibold text-foreground/85 tabular-nums">{breakdown[f].count}</span>
                            <span className="capitalize text-muted-foreground/70">{f}</span>
                            <span className="text-muted-foreground/30">·</span>
                            <span className={cn('font-semibold tabular-nums', themeConfig.text)}>
                                {formatCurrency(breakdown[f].monthly)}/mo
                            </span>
                        </span>
                    ))}
                </div>
            )}
        </section>
    );
}
