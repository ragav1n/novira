import React from 'react';
import { isSameDay, startOfDay, endOfDay, subDays, startOfMonth } from 'date-fns';

export type DateRange = {
    from: Date | undefined;
    to: Date | undefined;
};

export type SortOption = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

export type QuickRangeId = 'today' | '7d' | '30d' | 'month';

export type NumericOp = '>' | '<' | '>=' | '<=' | '=';

export function parseNumericQuery(q: string): { op: NumericOp; value: number } | null {
    const m = /^(>=|<=|>|<|=)\s*(\d+(?:\.\d+)?)$/.exec(q.trim());
    if (!m) return null;
    const value = Number(m[2]);
    if (!Number.isFinite(value)) return null;
    return { op: m[1] as NumericOp, value };
}

export function highlightMatch(text: string | null | undefined, query: string): React.ReactNode {
    if (!text) return text;
    const trimmed = query.trim();
    if (!trimmed) return text;
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const splitter = new RegExp(`(${escaped})`, 'gi');
    const matcher = new RegExp(`^${escaped}$`, 'i');
    const parts = text.split(splitter);
    return parts.map((part, i) =>
        matcher.test(part)
            ? <mark key={i} className="bg-primary/25 text-primary rounded px-0.5">{part}</mark>
            : <React.Fragment key={i}>{part}</React.Fragment>
    );
}

export function rangeMatches(from: Date | undefined, to: Date | undefined, target: { from: Date; to: Date }): boolean {
    if (!from || !to) return false;
    return isSameDay(from, target.from) && isSameDay(to, target.to);
}

export function getQuickRange(id: QuickRangeId): { from: Date; to: Date } {
    const now = new Date();
    switch (id) {
        case 'today':
            return { from: startOfDay(now), to: endOfDay(now) };
        case '7d':
            return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
        case '30d':
            return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
        case 'month':
            return { from: startOfMonth(now), to: endOfDay(now) };
    }
}
