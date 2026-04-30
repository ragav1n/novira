'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Lightbulb, Tags, Store, Wallet, Repeat, BadgePlus, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

export type InsightKind = 'category' | 'merchant' | 'payment' | 'frequency' | 'new';

export interface RecapInsight {
    label: string;
    kind?: InsightKind;
    subject?: string;
    detail: string;
}

export interface RecapData {
    headline: string;
    totalSpent: number;
    previousTotal: number;
    changePercent: number;
    transactionCount?: number;
    insights: RecapInsight[];
    takeaway: string;
}

export interface RecapAnalyzed {
    transactions: number;
    categories: number;
    merchants: number;
    paymentMethods: number;
    comparedToMonth: string;
}

const INSIGHT_ICON: Record<InsightKind, React.ComponentType<{ className?: string }>> = {
    category: Tags,
    merchant: Store,
    payment: Wallet,
    frequency: Repeat,
    new: BadgePlus,
};

// Render text with **bold** segments → <strong>
function RichText({ text, className }: { text: string; className?: string }) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return (
        <span className={className}>
            {parts.map((p, i) => {
                if (p.startsWith('**') && p.endsWith('**')) {
                    return <strong key={i} className="text-foreground font-bold">{p.slice(2, -2)}</strong>;
                }
                return <React.Fragment key={i}>{p}</React.Fragment>;
            })}
        </span>
    );
}

export function RecapBody({
    recap,
    analyzed,
    formatCurrency,
    onInsightClick,
}: {
    recap: RecapData;
    analyzed?: RecapAnalyzed | null;
    formatCurrency: (n: number) => string;
    onInsightClick?: (subject: string, kind?: InsightKind) => void;
}) {
    return (
        <div className="space-y-4" aria-live="polite">
            {/* Headline + change */}
            <div className="space-y-3">
                <p className="text-[15px] leading-snug font-semibold text-foreground">
                    <RichText text={recap.headline} />
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex flex-col">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/80">Spent</span>
                        <span className="text-lg font-bold text-foreground">{formatCurrency(recap.totalSpent)}</span>
                    </div>
                    <div className="h-8 w-px bg-border/60" />
                    <div className="flex flex-col">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/80">vs Last Month</span>
                        <span className={cn(
                            'text-sm font-bold flex items-center gap-1',
                            recap.changePercent > 0 ? 'text-rose-400' : recap.changePercent < 0 ? 'text-emerald-400' : 'text-foreground/70'
                        )}>
                            {recap.changePercent > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : recap.changePercent < 0 ? <TrendingDown className="w-3.5 h-3.5" /> : null}
                            {recap.changePercent === 0 ? 'No change' : `${recap.changePercent > 0 ? '+' : ''}${recap.changePercent.toFixed(1)}%`}
                        </span>
                    </div>
                    {typeof recap.transactionCount === 'number' && (
                        <>
                            <div className="h-8 w-px bg-border/60" />
                            <div className="flex flex-col">
                                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/80">Transactions</span>
                                <span className="text-sm font-bold text-foreground">{recap.transactionCount}</span>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Insights */}
            {recap.insights.length > 0 && (
                <div className="space-y-2">
                    {recap.insights.map((ins, i) => {
                        const Icon = INSIGHT_ICON[(ins.kind as InsightKind) || 'category'] || Tags;
                        const drillable = !!onInsightClick && !!ins.subject && ins.kind !== 'frequency';
                        const content = (
                            <div className="rounded-2xl bg-secondary/30 border border-white/8 backdrop-blur-sm p-3 flex gap-3 w-full text-left">
                                <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
                                    <Icon className="w-3.5 h-3.5 text-primary" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary/90">{ins.label}</p>
                                    <p className="text-[13px] leading-snug text-foreground/85 mt-0.5">
                                        <RichText text={ins.detail} />
                                    </p>
                                    {drillable && (
                                        <p className="text-[10px] text-primary/70 font-medium mt-1.5">
                                            View matching transactions →
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                        return drillable ? (
                            <button
                                key={i}
                                type="button"
                                onClick={() => onInsightClick!(ins.subject!, ins.kind)}
                                className="block w-full hover:bg-primary/5 rounded-2xl transition-colors active:scale-[0.99]"
                            >
                                {content}
                            </button>
                        ) : (
                            <div key={i}>{content}</div>
                        );
                    })}
                </div>
            )}

            {/* Takeaway */}
            <div className="rounded-2xl bg-gradient-to-br from-amber-400/15 to-amber-400/5 border border-amber-400/25 p-3 flex gap-2.5">
                <Lightbulb className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-amber-300/90 mb-1">Takeaway</p>
                    <p className="text-[13px] leading-snug text-foreground/95">
                        <RichText text={recap.takeaway} />
                    </p>
                </div>
            </div>

            {/* Analyzed footer */}
            {analyzed && (
                <div className="flex items-center gap-1.5 pt-1 text-[10px] text-muted-foreground/70 font-medium">
                    <Database className="w-3 h-3" />
                    <span>Analyzed {analyzed.transactions} txns · {analyzed.categories} categories · {analyzed.merchants} merchants · {analyzed.paymentMethods} payment methods</span>
                </div>
            )}
        </div>
    );
}

export function RecapSkeleton() {
    return (
        <div className="space-y-4 animate-pulse">
            <div className="space-y-3">
                <div className="h-4 w-3/4 bg-secondary/30 rounded" />
                <div className="flex gap-4">
                    <div className="space-y-1.5">
                        <div className="h-2 w-12 bg-secondary/20 rounded" />
                        <div className="h-5 w-20 bg-secondary/30 rounded" />
                    </div>
                    <div className="h-8 w-px bg-border/60" />
                    <div className="space-y-1.5">
                        <div className="h-2 w-16 bg-secondary/20 rounded" />
                        <div className="h-5 w-14 bg-secondary/30 rounded" />
                    </div>
                </div>
            </div>
            {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-2xl bg-secondary/20 border border-white/5 p-3 flex gap-3">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 shrink-0" />
                    <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="h-2 w-20 bg-secondary/30 rounded" />
                        <div className="h-3 w-full bg-secondary/25 rounded" />
                        <div className="h-3 w-2/3 bg-secondary/25 rounded" />
                    </div>
                </div>
            ))}
            <div className="rounded-2xl bg-amber-400/10 border border-amber-400/20 p-3 space-y-1.5">
                <div className="h-2 w-16 bg-amber-300/30 rounded" />
                <div className="h-3 w-full bg-amber-300/15 rounded" />
            </div>
        </div>
    );
}
