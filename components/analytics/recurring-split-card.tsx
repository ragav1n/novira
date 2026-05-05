'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Repeat, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ItemAgg {
    label: string;
    amount: number;
    count: number;
}

interface CategoryAgg {
    category: string;
    amount: number;
}

interface Props {
    recurringTotal: number;
    discretionaryTotal: number;
    recurringTopCategories: CategoryAgg[];
    discretionaryTopCategories: CategoryAgg[];
    recurringTopItems: ItemAgg[];
    discretionaryTopItems: ItemAgg[];
    formatCurrency: (amount: number) => string;
}

// Dark, readable surface — overrides the default light tooltip used elsewhere.
const TOOLTIP_SURFACE =
    "bg-popover/95 text-foreground border border-white/10 backdrop-blur-md shadow-xl";

function BreakdownList({
    title,
    color,
    total,
    items,
    categories,
    formatCurrency,
}: {
    title: string;
    color: 'violet' | 'cyan';
    total: number;
    items: ItemAgg[];
    categories: CategoryAgg[];
    formatCurrency: (amount: number) => string;
}) {
    const dot = color === 'violet' ? 'bg-violet-400' : 'bg-cyan-400';
    const accent = color === 'violet' ? 'text-violet-300' : 'text-cyan-300';

    if (items.length === 0) {
        return (
            <div className="text-[11px] text-white/80">No {title.toLowerCase()} spend in this range.</div>
        );
    }

    return (
        <div className="space-y-2 min-w-[240px]">
            <div className="flex items-center justify-between gap-3 pb-1.5 border-b border-white/15">
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider">
                    <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                    <span className={accent}>{title}</span>
                </span>
                <span className="text-[11px] font-bold tabular-nums text-white">{formatCurrency(total)}</span>
            </div>

            <div>
                <p className="text-[9px] uppercase tracking-widest font-bold text-white/60 mb-1">Top categories</p>
                <ul className="space-y-0.5">
                    {categories.slice(0, 3).map(c => (
                        <li key={c.category} className="flex justify-between text-[11px]">
                            <span className="text-white truncate mr-2">{c.category}</span>
                            <span className="tabular-nums text-white/85">{formatCurrency(Math.round(c.amount))}</span>
                        </li>
                    ))}
                </ul>
            </div>

            <div>
                <p className="text-[9px] uppercase tracking-widest font-bold text-white/60 mb-1">Top items</p>
                <ul className="space-y-0.5">
                    {items.slice(0, 4).map(i => (
                        <li key={i.label} className="flex justify-between text-[11px]">
                            <span className="text-white truncate mr-2">
                                {i.label}
                                {i.count > 1 && <span className="text-white/60"> · {i.count}×</span>}
                            </span>
                            <span className="tabular-nums text-white/85">{formatCurrency(Math.round(i.amount))}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

export function RecurringSplitCard({
    recurringTotal,
    discretionaryTotal,
    recurringTopCategories,
    discretionaryTopCategories,
    recurringTopItems,
    discretionaryTopItems,
    formatCurrency,
}: Props) {
    const total = recurringTotal + discretionaryTotal;
    if (total <= 0) return null;

    const recurringPct = (recurringTotal / total) * 100;
    const discretionaryPct = 100 - recurringPct;

    const recurringTooltip = (
        <BreakdownList
            title="Recurring"
            color="violet"
            total={recurringTotal}
            items={recurringTopItems}
            categories={recurringTopCategories}
            formatCurrency={formatCurrency}
        />
    );

    const discretionaryTooltip = (
        <BreakdownList
            title="Discretionary"
            color="cyan"
            total={discretionaryTotal}
            items={discretionaryTopItems}
            categories={discretionaryTopCategories}
            formatCurrency={formatCurrency}
        />
    );

    return (
        <TooltipProvider delayDuration={150}>
            <Card className="bg-card/40 backdrop-blur-md border-white/5 shadow-none">
                <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <h3 className="font-bold text-[13px] uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5">
                            <Repeat className="w-3.5 h-3.5" />
                            Locked-in vs. Discretionary
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        aria-label="What does this mean?"
                                        className="text-muted-foreground/60 hover:text-foreground transition-colors"
                                    >
                                        <Info className="w-3 h-3" />
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" align="start" className={`${TOOLTIP_SURFACE} max-w-[300px] p-3 text-[11px] leading-relaxed`}>
                                    <p className="font-bold mb-1.5 text-white">How spending splits this period</p>
                                    <p className="text-white/85">
                                        <span className="text-violet-300 font-bold">Recurring</span> = transactions flagged as recurring (subscriptions, bills, rent). Already committed before the period began.
                                    </p>
                                    <p className="text-white/85 mt-1.5">
                                        <span className="text-cyan-300 font-bold">Discretionary</span> = everything else — flexible spend you can adjust day-to-day.
                                    </p>
                                    <p className="text-white/65 mt-2">Hover any segment to see exactly which items make it up.</p>
                                </TooltipContent>
                            </Tooltip>
                        </h3>
                        <span
                            className="text-[10px] font-bold tabular-nums px-2 py-0.5 rounded-md bg-secondary/30 text-muted-foreground"
                            title="Sum of recurring transactions in this range"
                        >
                            {formatCurrency(Math.round(recurringTotal))} locked
                        </span>
                    </div>

                    {/* Stacked bar — split into two trigger regions so the tooltip targets the segment under the cursor. */}
                    <div className="h-3 w-full rounded-full overflow-hidden flex bg-secondary/20 border border-white/5">
                        {recurringPct > 0 && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        aria-label={`Recurring ${recurringPct.toFixed(0)}%, ${formatCurrency(recurringTotal)}`}
                                        style={{ width: `${recurringPct}%` }}
                                        className="h-full bg-gradient-to-r from-violet-500 to-violet-400 transition-[width] duration-700 cursor-help"
                                    />
                                </TooltipTrigger>
                                <TooltipContent side="top" className={`${TOOLTIP_SURFACE} p-3`}>{recurringTooltip}</TooltipContent>
                            </Tooltip>
                        )}
                        {discretionaryPct > 0 && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        aria-label={`Discretionary ${discretionaryPct.toFixed(0)}%, ${formatCurrency(discretionaryTotal)}`}
                                        style={{ width: `${discretionaryPct}%` }}
                                        className="h-full bg-gradient-to-r from-cyan-500/70 to-cyan-400/70 transition-[width] duration-700 cursor-help"
                                    />
                                </TooltipTrigger>
                                <TooltipContent side="top" className={`${TOOLTIP_SURFACE} p-3`}>{discretionaryTooltip}</TooltipContent>
                            </Tooltip>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button type="button" className="text-left rounded-xl bg-violet-500/10 border border-violet-500/20 px-3 py-2 cursor-help hover:bg-violet-500/15 transition-colors">
                                    <p className="text-[9px] uppercase tracking-widest font-bold text-violet-300/80">Recurring</p>
                                    <p className="text-[13px] font-bold mt-0.5 tabular-nums text-violet-200">
                                        {formatCurrency(recurringTotal)}
                                        <span className="ml-1.5 text-[10px] text-violet-300/60">{recurringPct.toFixed(0)}%</span>
                                    </p>
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" align="start" className={`${TOOLTIP_SURFACE} p-3`}>{recurringTooltip}</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button type="button" className="text-left rounded-xl bg-cyan-500/10 border border-cyan-500/20 px-3 py-2 cursor-help hover:bg-cyan-500/15 transition-colors">
                                    <p className="text-[9px] uppercase tracking-widest font-bold text-cyan-300/80">Discretionary</p>
                                    <p className="text-[13px] font-bold mt-0.5 tabular-nums text-cyan-200">
                                        {formatCurrency(discretionaryTotal)}
                                        <span className="ml-1.5 text-[10px] text-cyan-300/60">{discretionaryPct.toFixed(0)}%</span>
                                    </p>
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" align="end" className={`${TOOLTIP_SURFACE} p-3`}>{discretionaryTooltip}</TooltipContent>
                        </Tooltip>
                    </div>

                    {recurringTotal === 0 && (
                        <p className="text-[10px] text-muted-foreground/70 text-center pt-1">
                            No recurring transactions yet — set them up in Settings.
                        </p>
                    )}
                </CardContent>
            </Card>
        </TooltipProvider>
    );
}
