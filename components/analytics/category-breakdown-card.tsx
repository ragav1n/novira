'use client';

import { memo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { ChartConfig, BasePieChart } from '@/components/charts/base-pie-chart';
import { CHART_CONFIG } from '@/lib/categories';

type CategoryBreakdownItem = {
    name: string;
    rawKey: string;
    amount: number;
    value: number;
    fill: string;
};

interface Props {
    title: string;
    categoryBreakdown: { name: string; value: number; fill: string }[];
    categorizedBreakdown: CategoryBreakdownItem[];
    formatCurrency: (amount: number) => string;
    analyticsDateRange: () => { from: string; to: string } | null;
    /** Map of category rawKey → percent above prior-window per-month rate. */
    anomalies?: Record<string, { pct: number }>;
}

function CategoryBreakdownCardInner({ title, categoryBreakdown, categorizedBreakdown, formatCurrency, analyticsDateRange, anomalies }: Props) {
    const router = useRouter();

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80">
                    {title}
                </span>
            </div>
            <Card className="bg-card/40 border-none shadow-none backdrop-blur-md overflow-hidden">
                <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-start gap-6">
                    <div className="w-36 h-36 relative flex-shrink-0">
                        {categoryBreakdown.length > 0 ? (
                            <BasePieChart
                                data={categoryBreakdown}
                                config={CHART_CONFIG as ChartConfig}
                                innerRadius={46}
                                outerRadius={68}
                                hideLabel={true}
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground text-[10px] font-bold uppercase">
                                No Data
                            </div>
                        )}
                    </div>

                    <div className="w-full flex-1 space-y-3">
                        {categorizedBreakdown.slice(0, 5).map((cat) => {
                            const anomaly = anomalies?.[cat.rawKey];
                            return (
                                <button
                                    key={cat.name}
                                    onClick={() => {
                                        const params = new URLSearchParams({ category: cat.rawKey });
                                        const range = analyticsDateRange();
                                        if (range) {
                                            params.set('from', range.from);
                                            params.set('to', range.to);
                                        }
                                        router.push(`/search?${params.toString()}`);
                                    }}
                                    className="w-full text-left space-y-1.5 rounded-lg -mx-1 px-1 py-1 hover:bg-white/5 transition-colors"
                                >
                                    <div className="flex justify-between text-[11px] font-bold">
                                        <span className="flex items-center gap-2 text-muted-foreground/80">
                                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.fill }} />
                                            {cat.name}
                                        </span>
                                        <span className="flex items-center gap-1.5 text-foreground">
                                            {anomaly && (
                                                <span
                                                    className="text-[9px] font-bold tabular-nums px-1.5 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/30 text-rose-300"
                                                    title={`Up ~${anomaly.pct.toFixed(0)}% vs. prior period's monthly rate`}
                                                >
                                                    ▲ {anomaly.pct.toFixed(0)}%
                                                </span>
                                            )}
                                            {formatCurrency(cat.amount)}
                                        </span>
                                    </div>
                                    <div className="h-1 w-full bg-secondary/20 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-700"
                                            style={{ width: `${cat.value}%`, backgroundColor: cat.fill }}
                                        />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export const CategoryBreakdownCard = memo(CategoryBreakdownCardInner);
