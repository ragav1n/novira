'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tags, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TagAgg } from '@/hooks/useAnalyticsData';

interface Props {
    tagBreakdown: TagAgg[];
    activeTags: string[];
    onToggle: (tag: string) => void;
    onClear: () => void;
    formatCurrency: (amount: number) => string;
}

export function TagsFilterCard({ tagBreakdown, activeTags, onToggle, onClear, formatCurrency }: Props) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [overflow, setOverflow] = useState({ left: false, right: false });

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        const update = () => {
            const left = el.scrollLeft > 4;
            const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
            setOverflow(prev => (prev.left === left && prev.right === right) ? prev : { left, right });
        };
        update();
        el.addEventListener('scroll', update, { passive: true });
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => {
            el.removeEventListener('scroll', update);
            ro.disconnect();
        };
    }, [tagBreakdown.length]);

    if (tagBreakdown.length === 0) return null;

    const visible = tagBreakdown.slice(0, 20);

    return (
        <Card className="bg-card/40 backdrop-blur-md border-white/5 shadow-none">
            <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <h3 className="font-bold text-[13px] uppercase tracking-wider text-muted-foreground/80 flex items-center gap-1.5">
                        <Tags className="w-3.5 h-3.5" />
                        Tags
                    </h3>
                    {activeTags.length > 0 && (
                        <button
                            onClick={onClear}
                            className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Clear tag filters"
                        >
                            <X className="w-3 h-3" />
                            Clear
                        </button>
                    )}
                </div>

                <div className="relative -mx-1">
                    <div
                        ref={scrollRef}
                        className="flex gap-1.5 overflow-x-auto pb-1 px-1 no-scrollbar scroll-smooth"
                    >
                        {visible.map(({ tag, amount, count }) => {
                            const selected = activeTags.includes(tag);
                            return (
                                <button
                                    key={tag}
                                    onClick={() => onToggle(tag)}
                                    className={cn(
                                        "shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider border transition-all",
                                        selected
                                            ? "bg-primary/20 border-primary/40 text-primary"
                                            : "bg-secondary/20 border-white/5 text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                                    )}
                                    aria-pressed={selected}
                                >
                                    <span>#{tag}</span>
                                    <span className={cn(
                                        "tabular-nums normal-case font-bold",
                                        selected ? "text-primary/80" : "text-muted-foreground/60"
                                    )}>
                                        {formatCurrency(Math.round(amount))} · {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    <div
                        aria-hidden
                        className={cn(
                            "pointer-events-none absolute left-0 top-0 bottom-1 w-6 bg-gradient-to-r from-card to-transparent transition-opacity duration-200",
                            overflow.left ? "opacity-100" : "opacity-0"
                        )}
                    />
                    <div
                        aria-hidden
                        className={cn(
                            "pointer-events-none absolute right-0 top-0 bottom-1 w-6 bg-gradient-to-l from-card to-transparent transition-opacity duration-200",
                            overflow.right ? "opacity-100" : "opacity-0"
                        )}
                    />
                </div>

                {activeTags.length > 0 && (
                    <p className="text-[10px] text-muted-foreground/70 px-1">
                        Showing data for transactions with {activeTags.length === 1 ? 'tag' : 'all tags'}: {activeTags.map(t => `#${t}`).join(', ')}
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
