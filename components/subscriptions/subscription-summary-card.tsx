'use client';

import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { useWorkspaceTheme } from '@/hooks/useWorkspaceTheme';
import { ALL_FREQUENCIES, type Frequency } from '@/lib/subscriptions-utils';

interface Props {
    totalMonthly: number;
    totalYearly: number;
    totalActiveCount: number;
    pausedCount: number;
    breakdown: Record<Frequency, { count: number; monthly: number }>;
}

export function SubscriptionSummaryCard({ totalMonthly, totalYearly, totalActiveCount, pausedCount, breakdown }: Props) {
    const { formatCurrency } = useUserPreferences();
    const { theme: themeConfig } = useWorkspaceTheme();

    return (
        <Card className={cn(`bg-gradient-to-br backdrop-blur-md`, themeConfig.gradient, themeConfig.border)}>
            <CardContent className="p-6">
                <p className="text-sm text-muted-foreground font-medium mb-1">Estimated Monthly Cost</p>
                <h2 className={`text-3xl font-bold ${themeConfig.text}`}>{formatCurrency(totalMonthly)}</h2>
                <p className="text-xs text-muted-foreground mt-1">
                    ≈ {formatCurrency(totalYearly)} / yr
                    <span className="opacity-60">
                        {' · '}{totalActiveCount} active
                        {pausedCount > 0 ? ` · ${pausedCount} paused` : ''}
                    </span>
                </p>
                {totalActiveCount > 0 && (
                    <div className="grid grid-cols-2 gap-2 mt-4">
                        {ALL_FREQUENCIES.filter(f => breakdown[f].count > 0).map(f => (
                            <div
                                key={f}
                                className={cn(
                                    "rounded-xl border px-3 py-2 bg-card/30",
                                    themeConfig.border
                                )}
                            >
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                                    {f}
                                </p>
                                <p className="text-sm font-bold mt-0.5">
                                    {breakdown[f].count} <span className="text-[10px] text-muted-foreground font-normal">·</span>{' '}
                                    <span className={themeConfig.text}>{formatCurrency(breakdown[f].monthly)}/mo</span>
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
