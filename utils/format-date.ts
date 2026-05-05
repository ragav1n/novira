'use client';

import { format, parseISO } from 'date-fns';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { useCallback } from 'react';

export type DateFormatPref = 'MDY' | 'DMY' | 'YMD';

const PATTERNS: Record<DateFormatPref, { compact: string; short: string; medium: string; full: string }> = {
    MDY: { compact: 'MM/dd', short: 'MMM d', medium: 'MMM dd, yyyy', full: 'EEEE, MMMM d, yyyy' },
    DMY: { compact: 'dd/MM', short: 'd MMM', medium: 'dd MMM yyyy', full: 'EEEE, d MMMM yyyy' },
    YMD: { compact: 'MM-dd', short: 'MMM d', medium: 'yyyy-MM-dd', full: 'EEEE, yyyy-MM-dd' },
};

export type DateLength = 'compact' | 'short' | 'medium' | 'full';

export function formatDateWith(
    input: Date | string,
    pref: DateFormatPref,
    length: DateLength = 'medium',
): string {
    const date = typeof input === 'string'
        ? (input.length >= 10 ? parseISO(input.slice(0, 10)) : new Date(input))
        : input;
    return format(date, PATTERNS[pref][length]);
}

export function useFormattedDate() {
    const { dateFormat } = useUserPreferences();
    return useCallback(
        (input: Date | string, length: DateLength = 'medium') => formatDateWith(input, dateFormat, length),
        [dateFormat],
    );
}
