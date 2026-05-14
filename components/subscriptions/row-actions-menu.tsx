'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { MoreVertical, Star, Pause, Play, Clock, Trash2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { SubscriptionMetadata } from '@/types/transaction';
import type { Tpl } from '@/lib/subscriptions-utils';

interface Props {
    template: Tpl;
    meta: SubscriptionMetadata;
    paused: boolean;
    onTogglePin: (t: Tpl) => void;
    onSetPause: (t: Tpl, dateStr: string | null) => void;
    onSetTrial: (t: Tpl, dateStr: string | null) => void;
    onCancel: (id: string) => void;
}

export function RowActionsMenu({ template, meta, paused, onTogglePin, onSetPause, onSetTrial, onCancel }: Props) {
    const [open, setOpen] = useState(false);
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground p-1 transition-colors"
                    aria-label="Subscription actions"
                >
                    <MoreVertical className="w-4 h-4" aria-hidden="true" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-1 bg-card/95 backdrop-blur-xl border-white/10">
                <button
                    type="button"
                    onClick={() => { onTogglePin(template); setOpen(false); }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-secondary/30 transition-colors text-left"
                >
                    <Star className={cn("w-3.5 h-3.5", meta.pinned && "fill-amber-400 text-amber-400")} aria-hidden="true" />
                    <span>{meta.pinned ? 'Unpin' : 'Pin to top'}</span>
                </button>

                {paused ? (
                    <button
                        type="button"
                        onClick={() => { onSetPause(template, null); setOpen(false); }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-secondary/30 transition-colors text-left"
                    >
                        <Play className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                        <span>Resume now</span>
                    </button>
                ) : (
                    <label className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-secondary/30 transition-colors cursor-pointer">
                        <Pause className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                        <span className="flex-1">Pause until…</span>
                        <input
                            type="date"
                            min={todayStr}
                            onChange={(e) => {
                                if (e.target.value) {
                                    onSetPause(template, e.target.value);
                                    setOpen(false);
                                }
                            }}
                            className="bg-transparent text-[10px] w-[88px] text-muted-foreground"
                            aria-label="Pause until date"
                        />
                    </label>
                )}

                {meta.trial_ends_at ? (
                    <button
                        type="button"
                        onClick={() => { onSetTrial(template, null); setOpen(false); }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-secondary/30 transition-colors text-left"
                    >
                        <Clock className="w-3.5 h-3.5 text-rose-300" aria-hidden="true" />
                        <span>Clear trial</span>
                    </button>
                ) : (
                    <label className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-secondary/30 transition-colors cursor-pointer">
                        <Clock className="w-3.5 h-3.5 text-rose-300" aria-hidden="true" />
                        <span className="flex-1">Trial ends…</span>
                        <input
                            type="date"
                            min={todayStr}
                            onChange={(e) => {
                                if (e.target.value) {
                                    onSetTrial(template, e.target.value);
                                    setOpen(false);
                                }
                            }}
                            className="bg-transparent text-[10px] w-[88px] text-muted-foreground"
                            aria-label="Trial ends date"
                        />
                    </label>
                )}

                <div className="my-1 h-px bg-white/10" />

                <button
                    type="button"
                    onClick={() => { onCancel(template.id); setOpen(false); }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-rose-500/10 text-rose-400 transition-colors text-left"
                >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Cancel subscription</span>
                </button>
            </PopoverContent>
        </Popover>
    );
}
