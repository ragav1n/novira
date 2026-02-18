'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';

import { useIsMobile } from '@/components/ui/use-mobile';
import { PopoverContentProps } from '@radix-ui/react-popover';

interface DateRangePickerProps {
    className?: string;
    date: DateRange | undefined;
    setDate: (date: DateRange | undefined) => void;
    align?: PopoverContentProps['align'];
    numberOfMonths?: number;
}

export function DateRangePicker({
    className,
    date,
    setDate,
    align = 'start',
    numberOfMonths
}: DateRangePickerProps) {
    const isMobile = useIsMobile();
    const monthsToShow = numberOfMonths ?? (isMobile ? 1 : 2);
    const [open, setOpen] = useState(false);

    const dateDisplay = date?.from ? (
        date.to ? (
            <>
                <span className="hidden sm:inline">{format(date.from, 'LLL dd, y')} - {format(date.to, 'LLL dd, y')}</span>
                <span className="sm:hidden">{format(date.from, 'MMM d')} - {format(date.to, 'MMM d')}</span>
            </>
        ) : (
            format(date.from, 'LLL dd, y')
        )
    ) : (
        <span>Pick a date range</span>
    );

    return (
        <div className={cn('grid gap-2', className)}>
            <Popover modal={true} open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        id="date"
                        variant={'outline'}
                        className={cn(
                            'w-full justify-start text-left font-normal bg-secondary/10 border-white/10 hover:bg-secondary/20 h-12 rounded-xl px-3',
                            !date && 'text-muted-foreground'
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                        <div className="flex-1 truncate text-xs sm:text-sm">
                            {dateDisplay}
                        </div>
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    className="w-auto p-0 rounded-2xl border-white/10 overflow-hidden shadow-2xl"
                    align={isMobile ? 'center' : align}
                    sideOffset={8}
                >
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={date?.from}
                        selected={date}
                        onSelect={setDate}
                        numberOfMonths={monthsToShow}
                        className="bg-card"
                    />
                </PopoverContent>
            </Popover>
        </div>
    );
}
