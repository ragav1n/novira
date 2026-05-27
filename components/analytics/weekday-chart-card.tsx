'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type WeekdayTotal = { label: string; total: number };

interface Props {
    weekdayTotals: WeekdayTotal[];
    totalSpentInRange: number;
    formatCurrency: (amount: number) => string;
    themeHex: { base: string; light: string };
}

function WeekdayChartCardInner({ weekdayTotals, totalSpentInRange, formatCurrency, themeHex }: Props) {
    if (totalSpentInRange <= 0) return null;
    const maxWd = Math.max(...weekdayTotals.map(w => w.total));
    if (maxWd <= 0) return null;
    const peak = weekdayTotals.reduce((a, b) => (a.total >= b.total ? a : b));

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80">
                    By Weekday
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                    Peak · {peak.label}
                </span>
            </div>
            <Card className="bg-card/20 border-none shadow-none">
                <CardContent className="p-4">
                    <div className="grid grid-cols-7 gap-2 h-[110px] items-end">
                        {weekdayTotals.map((w, i) => {
                            const ratio = w.total / maxWd;
                            const isPeak = w.total === peak.total && peak.total > 0;
                            return (
                                <div key={w.label} className="flex flex-col items-center gap-1.5 h-full justify-end">
                                    <span className="text-[10px] font-bold tabular-nums text-muted-foreground/60">
                                        {w.total > 0 ? formatCurrency(Math.round(w.total)) : ''}
                                    </span>
                                    <motion.div
                                        initial={{ scaleY: 0, opacity: 0 }}
                                        animate={{ scaleY: ratio, opacity: 1 }}
                                        transition={{
                                            delay: i * 0.05,
                                            duration: 0.6,
                                            ease: [0.22, 1, 0.36, 1],
                                        }}
                                        style={{
                                            transformOrigin: 'bottom',
                                            backgroundColor: isPeak ? themeHex.light : `${themeHex.base}4D`,
                                        }}
                                        className="w-full rounded-md min-h-[6px] h-[60px]"
                                    />
                                    <span className={cn(
                                        'text-[10px] font-bold uppercase tracking-wider',
                                        isPeak ? 'text-foreground' : 'text-muted-foreground/60'
                                    )}>
                                        {w.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export const WeekdayChartCard = memo(WeekdayChartCardInner);
