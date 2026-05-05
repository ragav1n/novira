'use client';

import { Banknote, CalendarDays, CalendarRange } from 'lucide-react';
import { CurrencyDropdown } from '@/components/ui/currency-dropdown';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Currency } from '@/components/providers/user-preferences-provider';

interface Props {
    currency: Currency;
    setCurrency: (val: Currency) => void;
    firstDayOfWeek: 0 | 1;
    setFirstDayOfWeek: (day: 0 | 1) => Promise<void> | void;
    dateFormat: 'MDY' | 'DMY' | 'YMD';
    setDateFormat: (fmt: 'MDY' | 'DMY' | 'YMD') => Promise<void> | void;
}

export function LocaleSection({
    currency,
    setCurrency,
    firstDayOfWeek,
    setFirstDayOfWeek,
    dateFormat,
    setDateFormat,
}: Props) {
    return (
        <div className="bg-secondary/5 rounded-xl border border-white/5 divide-y divide-white/5">
            <div className="flex flex-col gap-3 p-3">
                <div className="flex items-center gap-3">
                    <Banknote className="w-4 h-4 text-muted-foreground" />
                    <div>
                        <p className="text-sm font-medium">Currency</p>
                        <p className="text-[11px] text-muted-foreground">Select your preferred currency</p>
                    </div>
                </div>
                <div className="mt-1">
                    <CurrencyDropdown value={currency} onValueChange={(val) => setCurrency(val as Currency)} />
                </div>
            </div>

            <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3 min-w-0">
                    <CalendarRange className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                        <p className="text-sm font-medium">First Day of Week</p>
                        <p className="text-[11px] text-muted-foreground">
                            Affects analytics weekly grouping
                        </p>
                    </div>
                </div>
                <Select
                    value={String(firstDayOfWeek)}
                    onValueChange={(val) => setFirstDayOfWeek(Number(val) as 0 | 1)}
                >
                    <SelectTrigger className="w-[120px] h-9 rounded-xl bg-secondary/20 border-white/10 text-xs font-bold">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="0">Sunday</SelectItem>
                        <SelectItem value="1">Monday</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3 min-w-0">
                    <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                        <p className="text-sm font-medium">Date Format</p>
                        <p className="text-[11px] text-muted-foreground">
                            How dates are shown across the app
                        </p>
                    </div>
                </div>
                <Select
                    value={dateFormat}
                    onValueChange={(val) => setDateFormat(val as 'MDY' | 'DMY' | 'YMD')}
                >
                    <SelectTrigger className="w-[140px] h-9 rounded-xl bg-secondary/20 border-white/10 text-xs font-bold">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="MDY">MM/DD/YYYY</SelectItem>
                        <SelectItem value="DMY">DD/MM/YYYY</SelectItem>
                        <SelectItem value="YMD">YYYY-MM-DD</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
