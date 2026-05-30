'use client';

import { Scale, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { useAccountBalances } from '@/hooks/useAccountBalances';

/**
 * Glanceable net-worth summary across tracked accounts (credit cards, digital
 * wallets, and any account with an opening balance). Renders nothing until at
 * least one such account exists, so spent-only cash/checking users never see a
 * misleading number. Amounts honor privacy mode via formatCurrency.
 */
export function NetWorthCard() {
    const { formatCurrency } = useUserPreferences();
    const { netWorth, totalAssets, totalLiabilities, trackedCount, loading } = useAccountBalances();

    // Hide until there's something real to show — no spinner, and no noisy
    // "$0" card for a freshly-created empty account (e.g. a new wallet with no
    // opening balance or activity yet).
    if (loading || trackedCount === 0) return null;
    if (Math.abs(netWorth) < 0.005 && totalAssets < 0.005 && totalLiabilities < 0.005) return null;

    const hasLiabilities = totalLiabilities >= 0.005;

    return (
        <div className="rounded-2xl bg-card/95 border border-white/5 p-4 shadow-sm">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-1.5">
                <Scale className="w-3.5 h-3.5" />
                Net worth
            </div>
            <p className={cn('text-2xl font-bold tabular-nums', netWorth < 0 ? 'text-rose-300' : 'text-foreground')}>
                {formatCurrency(netWorth)}
            </p>
            {hasLiabilities && (
                <div className="mt-3 flex items-center gap-4 text-[11px]">
                    <span className="flex items-center gap-1 text-emerald-300/90 tabular-nums">
                        <TrendingUp className="w-3.5 h-3.5" />
                        {formatCurrency(totalAssets)}
                        <span className="text-muted-foreground/60 font-medium">assets</span>
                    </span>
                    <span className="flex items-center gap-1 text-rose-300/90 tabular-nums">
                        <TrendingDown className="w-3.5 h-3.5" />
                        {formatCurrency(totalLiabilities)}
                        <span className="text-muted-foreground/60 font-medium">owed</span>
                    </span>
                </div>
            )}
        </div>
    );
}
