'use client';

import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type WeekdayTotal = { label: string; total: number };

interface Props {
    weekdayTotals: WeekdayTotal[];
    totalSpentInRange: number;
    formatCurrency: (amount: number) => string;
}

export function WeekdayChartCard({ weekdayTotals, totalSpentInRange, formatCurrency }: Props) {
    if (totalSpentInRange <= 0) return null;
    const maxWd = Math.max(...weekdayTotals.map(w => w.total));
    if (maxWd <= 0) return null;
    const peak = weekdayTotals.reduce((a, b) => (a.total >= b.total ? a : b));

    return (
        <Card className="bg-card/40 border-white/5 shadow-none backdrop-blur-md">
            <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-[13px] uppercase tracking-wider text-muted-foreground/80">By Weekday</h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
                        Peak · {peak.label}
                    </span>
                </div>
                <div className="grid grid-cols-7 gap-2 h-[110px] items-end">
                    {weekdayTotals.map((w, i) => {
                        const ratio = w.total / maxWd;
                        const isPeak = w.total === peak.total && peak.total > 0;
                        return (
                            <div key={w.label} className="flex flex-col items-center gap-1.5 h-full justify-end">
                                <span className="text-[9px] font-bold tabular-nums text-muted-foreground/60">
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
                                        backgroundColor: isPeak ? '#A855F7' : 'rgba(168,85,247,0.3)',
                                    }}
                                    className="w-full rounded-md min-h-[6px] h-[60px]"
                                />
                                <span className={cn(
                                    "text-[9px] font-bold uppercase tracking-wider",
                                    isPeak ? "text-foreground" : "text-muted-foreground/60"
                                )}>
                                    {w.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}
