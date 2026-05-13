'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import {
    Wallet, Landmark, PiggyBank, CreditCard, Smartphone, CircleDollarSign, LayoutGrid,
} from 'lucide-react';
import { useAccounts } from '@/components/providers/accounts-provider';
import type { AccountType } from '@/types/account';

const TYPE_ICONS: Record<AccountType, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
    cash: Wallet,
    checking: Landmark,
    savings: PiggyBank,
    credit_card: CreditCard,
    digital_wallet: Smartphone,
    other: CircleDollarSign,
};

/**
 * Compact filter strip. Shows "All" plus each active account; tap to filter
 * the dashboard's transactions and spending summary to that account.
 * Hidden when the user has fewer than 2 accounts (nothing to filter by).
 */
export function AccountFilterChips() {
    const { accounts, activeAccountId, setActiveAccountId } = useAccounts();
    const active = accounts.filter(a => !a.archived_at);
    if (active.length < 2) return null;

    const renderChip = (
        key: string,
        selected: boolean,
        onClick: () => void,
        icon: React.ReactNode,
        label: string,
        color: string,
    ) => (
        <button
            key={key}
            type="button"
            onClick={onClick}
            aria-pressed={selected}
            className={cn(
                'shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12px] font-semibold transition-colors',
                selected
                    ? 'shadow-[0_0_12px_rgba(138,43,226,0.18)]'
                    : 'bg-secondary/10 border-white/5 text-muted-foreground/80 hover:border-white/15 hover:text-foreground',
            )}
            style={selected ? {
                backgroundColor: `${color}1F`,
                borderColor: `${color}80`,
                color,
            } : undefined}
        >
            {icon}
            <span>{label}</span>
        </button>
    );

    return (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
            {renderChip(
                'all',
                activeAccountId === null,
                () => setActiveAccountId(null),
                <LayoutGrid className="w-3 h-3" />,
                'All',
                '#8A2BE2',
            )}
            {active.map(a => {
                const Icon = TYPE_ICONS[a.type] || CircleDollarSign;
                return renderChip(
                    a.id,
                    activeAccountId === a.id,
                    () => setActiveAccountId(a.id),
                    <Icon className="w-3 h-3" style={{ color: a.color }} />,
                    a.name,
                    a.color,
                );
            })}
        </div>
    );
}
