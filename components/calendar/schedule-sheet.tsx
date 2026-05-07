'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { Bell, RotateCw, Tag, Target, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useUserPreferences, CURRENCY_DETAILS, type Currency } from '@/components/providers/user-preferences-provider';
import { useWorkspaceTheme } from '@/hooks/useWorkspaceTheme';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetClose } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/utils/haptics';

interface ScheduleSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedDate: Date;
    onCreated: () => void;
}

export function ScheduleSheet({ open, onOpenChange, selectedDate, onCreated }: ScheduleSheetProps) {
    const router = useRouter();
    const { userId, activeWorkspaceId, currency } = useUserPreferences();
    const { theme: themeConfig } = useWorkspaceTheme();

    const [label, setLabel] = useState('');
    const [amount, setAmount] = useState('');
    const [eventCurrency, setEventCurrency] = useState<Currency>(currency);
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open) {
            setLabel('');
            setAmount('');
            setEventCurrency(currency);
            setNotes('');
            setSaving(false);
        }
    }, [open, currency]);

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const dateLabel = format(selectedDate, 'EEEE, MMM d');

    const handleSave = async () => {
        if (!userId) return;
        const trimmed = label.trim();
        if (!trimmed) {
            toast.error('Add a label first');
            return;
        }
        const parsedAmount = amount.trim() === '' ? null : Number(amount);
        if (parsedAmount != null && (isNaN(parsedAmount) || parsedAmount < 0)) {
            toast.error('Enter a valid amount');
            return;
        }

        setSaving(true);
        try {
            const groupId = activeWorkspaceId ?? null;
            const { error } = await supabase.from('scheduled_events').insert({
                user_id: userId,
                group_id: groupId,
                date: dateStr,
                label: trimmed,
                amount: parsedAmount,
                currency: parsedAmount != null ? eventCurrency : null,
                notes: notes.trim() || null,
                is_completed: false,
            });
            if (error) throw error;
            toast.success('Scheduled');
            onCreated();
            onOpenChange(false);
        } catch (err) {
            console.error('Error saving scheduled event:', err);
            toast.error('Could not save');
        } finally {
            setSaving(false);
        }
    };

    const goTo = (path: string) => {
        onOpenChange(false);
        router.push(path);
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="bottom"
                className="rounded-t-3xl bg-card/95 backdrop-blur-xl border-white/10 max-h-[92vh] overflow-y-auto p-0"
            >
                <div className="max-w-md lg:max-w-xl mx-auto w-full">
                    <SheetHeader className="px-5 pt-6 pb-3">
                        <SheetTitle className="text-base">Schedule for {dateLabel}</SheetTitle>
                        <SheetDescription className="text-xs">
                            Drop a one-off bill or reminder, or jump into a richer flow.
                        </SheetDescription>
                    </SheetHeader>

                    <div className="px-5 pb-6 space-y-5">
                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <label htmlFor="schedule-label" className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">
                                    Label
                                </label>
                                <Input
                                    id="schedule-label"
                                    value={label}
                                    onChange={(e) => setLabel(e.target.value)}
                                    placeholder="Tuition payment"
                                    autoFocus
                                    disabled={saving}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="schedule-amount" className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">
                                    Amount <span className="text-muted-foreground/60 normal-case">(optional)</span>
                                </label>
                                <div className="flex gap-2">
                                    <Input
                                        id="schedule-amount"
                                        inputMode="decimal"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        placeholder="Leave blank for reminder"
                                        disabled={saving}
                                        className="flex-1"
                                    />
                                    <Select
                                        value={eventCurrency}
                                        onValueChange={(v) => setEventCurrency(v as Currency)}
                                        disabled={saving}
                                    >
                                        <SelectTrigger
                                            aria-label="Currency"
                                            className="h-9 w-[92px] shrink-0"
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-72">
                                            {(Object.keys(CURRENCY_DETAILS) as Currency[]).map((c) => (
                                                <SelectItem key={c} value={c}>
                                                    {c} <span className="text-muted-foreground">{CURRENCY_DETAILS[c].symbol}</span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="schedule-notes" className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">
                                    Notes <span className="text-muted-foreground/60 normal-case">(optional)</span>
                                </label>
                                <Textarea
                                    id="schedule-notes"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Any details to remember"
                                    rows={2}
                                    disabled={saving}
                                />
                            </div>

                            <Button
                                onClick={handleSave}
                                disabled={saving || !label.trim()}
                                className="w-full h-10 font-semibold"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                                <span className="ml-1">Save one-off</span>
                            </Button>
                        </div>

                        <div className="space-y-1 pt-3 border-t border-white/5">
                            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/70 px-1 pb-1">
                                Or schedule something bigger
                            </p>
                            <button
                                type="button"
                                onClick={() => goTo(`/add?recurring=1&date=${dateStr}`)}
                                className="group w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs text-left transition-all hover:bg-primary/15 hover:translate-x-0.5"
                            >
                                <RotateCw className={cn('w-3.5 h-3.5 transition-transform group-hover:rotate-45', themeConfig.text)} />
                                <span className="flex-1">Recurring expense</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => goTo(`/groups?bucket=new&end=${dateStr}`)}
                                className="group w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs text-left transition-all hover:bg-cyan-500/15 hover:translate-x-0.5"
                            >
                                <Tag className="w-3.5 h-3.5 text-cyan-300 group-hover:scale-110 transition-transform" />
                                <span className="flex-1">Bucket ending here</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => goTo(`/goals?goal=new&deadline=${dateStr}`)}
                                className="group w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs text-left transition-all hover:bg-emerald-500/15 hover:translate-x-0.5"
                            >
                                <Target className="w-3.5 h-3.5 text-emerald-300 group-hover:scale-110 transition-transform" />
                                <span className="flex-1">Goal deadline</span>
                            </button>
                        </div>
                    </div>
                </div>

                <SheetClose className="hidden" />
            </SheetContent>
        </Sheet>
    );
}
