'use client';

import { format, parseISO } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { CATEGORY_COLORS } from '@/lib/categories';

type LargestTx = {
    id: string;
    description: string;
    amount: number;
    date: string;
    category: string;
    place_name?: string;
};

interface Props {
    top3Largest: LargestTx[];
    formatCurrency: (amount: number) => string;
}

export function LargestTransactionsCard({ top3Largest, formatCurrency }: Props) {
    if (top3Largest.length === 0) return null;

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80">
                    Largest Transactions
                </span>
            </div>
            <Card className="bg-card/40 border-none shadow-none backdrop-blur-md overflow-hidden">
                <CardContent className="p-4 space-y-2.5">
                    {top3Largest.map((tx) => {
                        const dotColor = CATEGORY_COLORS[tx.category.toLowerCase()] || CATEGORY_COLORS.others;
                        return (
                            <div key={tx.id} className="flex items-center gap-3">
                                <div
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: dotColor }}
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="text-[12px] font-bold truncate">{tx.description}</p>
                                    <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/60 truncate">
                                        {format(parseISO(tx.date.slice(0, 10)), 'd MMM')}
                                        {tx.place_name ? ` · ${tx.place_name}` : ''}
                                    </p>
                                </div>
                                <span className="text-[12px] font-bold tabular-nums">{formatCurrency(tx.amount)}</span>
                            </div>
                        );
                    })}
                </CardContent>
            </Card>
        </div>
    );
}
