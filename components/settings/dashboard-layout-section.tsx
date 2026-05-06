'use client';

import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { TrendingUp, RotateCw, PieChart, Receipt, RotateCcw } from 'lucide-react';
import { useDashboardLayout, type DashboardCardId } from '@/hooks/useDashboardLayout';

const CARDS: { id: DashboardCardId; label: string; description: string; icon: React.ReactNode }[] = [
    {
        id: 'cashflow_forecast',
        label: 'Cashflow forecast',
        description: 'Per-day actual + projected line through end of month',
        icon: <TrendingUp className="w-4 h-4" />,
    },
    {
        id: 'upcoming_recurring',
        label: 'Upcoming recurring',
        description: 'Next-due bills & subscriptions',
        icon: <RotateCw className="w-4 h-4" />,
    },
    {
        id: 'category_donut',
        label: 'Category donut',
        description: 'Pie chart of spend by category',
        icon: <PieChart className="w-4 h-4" />,
    },
    {
        id: 'transaction_list',
        label: 'Recent transactions',
        description: 'Feed of latest transactions on the dashboard',
        icon: <Receipt className="w-4 h-4" />,
    },
];

export function DashboardLayoutSection() {
    const { layout, setCard, reset } = useDashboardLayout();

    return (
        <div className="space-y-3">
            <p className="text-[11px] text-muted-foreground">
                Hide widgets you don&apos;t use. Saved on this device.
            </p>
            <div className="space-y-2">
                {CARDS.map((card) => (
                    <div
                        key={card.id}
                        className="flex items-center gap-3 rounded-xl border border-white/5 bg-card/40 p-3"
                    >
                        <div className="w-8 h-8 rounded-lg bg-secondary/30 flex items-center justify-center text-muted-foreground shrink-0">
                            {card.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold">{card.label}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{card.description}</p>
                        </div>
                        <Switch
                            checked={layout[card.id]}
                            onCheckedChange={(v) => setCard(card.id, v)}
                            aria-label={`Show ${card.label}`}
                        />
                    </div>
                ))}
            </div>
            <Button
                variant="outline"
                onClick={reset}
                className="h-9 text-xs border-white/10 text-muted-foreground gap-1.5"
            >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                Reset to defaults
            </Button>
        </div>
    );
}
