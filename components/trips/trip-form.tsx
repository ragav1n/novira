'use client';

import React, { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { CurrencyDropdown } from '@/components/ui/currency-dropdown';
import { TripService } from '@/lib/services/trip-service';
import { useUserPreferences, type Currency } from '@/components/providers/user-preferences-provider';
import { toast } from '@/utils/haptics';
import { cn } from '@/lib/utils';
import type { Trip } from '@/types/trip';

type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved: () => void;
    editing?: Trip | null;
};

export function TripForm({ open, onOpenChange, onSaved, editing }: Props) {
    const { userId, currency: defaultCurrency, activeWorkspaceId } = useUserPreferences();

    const [name, setName] = useState('');
    const [startDate, setStartDate] = useState<Date | undefined>(undefined);
    const [endDate, setEndDate] = useState<Date | undefined>(undefined);
    const [homeCurrency, setHomeCurrency] = useState<Currency>(defaultCurrency);
    const [baseLocation, setBaseLocation] = useState('');
    const [autoTag, setAutoTag] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        if (editing) {
            setName(editing.name);
            setStartDate(parseISO(editing.start_date));
            setEndDate(parseISO(editing.end_date));
            setHomeCurrency((editing.home_currency || defaultCurrency) as Currency);
            setBaseLocation(editing.base_location ?? '');
            setAutoTag(editing.auto_tag_enabled);
        } else {
            setName('');
            setStartDate(new Date());
            setEndDate(undefined);
            setHomeCurrency(defaultCurrency);
            setBaseLocation('');
            setAutoTag(true);
        }
    }, [open, editing, defaultCurrency]);

    const canSave = name.trim().length > 0 && !!startDate && !!endDate && endDate >= startDate;

    const handleSave = async () => {
        if (!userId || !canSave) return;
        setSaving(true);
        try {
            if (editing) {
                await TripService.updateTrip(userId, editing.id, {
                    name: name.trim(),
                    start_date: format(startDate!, 'yyyy-MM-dd'),
                    end_date: format(endDate!, 'yyyy-MM-dd'),
                    home_currency: homeCurrency,
                    base_location: baseLocation.trim() || null,
                    auto_tag_enabled: autoTag,
                });
            } else {
                await TripService.createTrip(userId, {
                    name: name.trim(),
                    start_date: format(startDate!, 'yyyy-MM-dd'),
                    end_date: format(endDate!, 'yyyy-MM-dd'),
                    home_currency: homeCurrency,
                    base_location: baseLocation.trim() || null,
                    auto_tag_enabled: autoTag,
                }, activeWorkspaceId);
            }
            onSaved();
            onOpenChange(false);
        } catch {
            // Toast handled in the service
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!editing) return;
        if (!confirm(`Delete trip "${editing.name}"? Transactions keep their trip tag.`)) return;
        setSaving(true);
        try {
            await TripService.deleteTrip(editing.id);
            onSaved();
            onOpenChange(false);
        } catch {
            toast.error('Failed to delete trip');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md rounded-3xl border-white/10 bg-card/95 backdrop-blur-xl p-5">
                <DialogHeader>
                    <DialogTitle>{editing ? 'Edit trip' : 'New trip'}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 mt-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="trip-name">Name</Label>
                        <Input
                            id="trip-name"
                            value={name}
                            maxLength={80}
                            placeholder="Japan 2026"
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <DateField label="Start" value={startDate} onChange={setStartDate} />
                        <DateField label="End" value={endDate} onChange={setEndDate} minDate={startDate} />
                    </div>

                    <div className="space-y-1.5">
                        <Label>Home currency</Label>
                        <CurrencyDropdown value={homeCurrency} onValueChange={(v) => setHomeCurrency(v as Currency)} compact />
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="trip-location">Base location <span className="text-muted-foreground font-normal">(optional)</span></Label>
                        <Input
                            id="trip-location"
                            value={baseLocation}
                            maxLength={120}
                            placeholder="Tokyo, Japan"
                            onChange={(e) => setBaseLocation(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center justify-between rounded-xl bg-secondary/10 border border-white/5 px-3 py-2.5">
                        <div className="flex flex-col gap-0.5">
                            <Label htmlFor="trip-autotag" className="cursor-pointer">Auto-tag transactions</Label>
                            <p className="text-[11px] text-muted-foreground">Adds the trip tag to expenses with dates inside the window.</p>
                        </div>
                        <Switch
                            id="trip-autotag"
                            checked={autoTag}
                            onCheckedChange={setAutoTag}
                        />
                    </div>
                </div>

                <DialogFooter className="mt-4 flex-row justify-between sm:justify-between gap-2">
                    {editing ? (
                        <Button
                            variant="ghost"
                            onClick={handleDelete}
                            disabled={saving}
                            className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                        >
                            Delete
                        </Button>
                    ) : <span />}
                    <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
                        <Button onClick={handleSave} disabled={!canSave || saving}>
                            {saving ? 'Saving…' : editing ? 'Save changes' : 'Create trip'}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function DateField({
    label, value, onChange, minDate,
}: {
    label: string;
    value: Date | undefined;
    onChange: (d: Date | undefined) => void;
    minDate?: Date;
}) {
    const [open, setOpen] = useState(false);
    return (
        <div className="space-y-1.5">
            <Label>{label}</Label>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        className={cn(
                            'w-full justify-start text-left font-normal',
                            !value && 'text-muted-foreground'
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {value ? format(value, 'MMM d, yyyy') : 'Pick date'}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                        mode="single"
                        selected={value}
                        onSelect={(d) => { onChange(d); setOpen(false); }}
                        disabled={minDate ? { before: minDate } : undefined}
                        initialFocus
                    />
                </PopoverContent>
            </Popover>
        </div>
    );
}
