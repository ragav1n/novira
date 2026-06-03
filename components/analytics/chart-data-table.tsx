'use client';

import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Column {
    key: string;
    label: string;
}

interface Props {
    /** Screen-reader caption describing what the table contains. */
    caption: string;
    columns: Column[];
    rows: Record<string, unknown>[];
    /** Formats a cell value; falls back to String(value). */
    formatValue?: (key: string, value: unknown) => string;
    className?: string;
}

/**
 * Accessible "View as table" disclosure for charts whose data is otherwise
 * only encoded visually. Keeps the chart for sighted users and exposes the
 * same numbers as a real <table> for screen readers and keyboard users.
 */
export function ChartDataTable({ caption, columns, rows, formatValue, className }: Props) {
    const [open, setOpen] = useState(false);
    const id = useId();
    if (rows.length === 0) return null;

    return (
        <div className={cn('text-[11px]', className)}>
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                aria-expanded={open}
                aria-controls={id}
                className="flex items-center gap-1 font-bold uppercase tracking-wider text-muted-foreground/70 hover:text-foreground transition-colors rounded px-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
                <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} aria-hidden="true" />
                {open ? 'Hide data table' : 'View as table'}
            </button>
            {open && (
                <div id={id} className="mt-2 overflow-x-auto">
                    <table className="w-full border-collapse">
                        <caption className="sr-only">{caption}</caption>
                        <thead>
                            <tr>
                                {columns.map(c => (
                                    <th
                                        key={c.key}
                                        scope="col"
                                        className="text-left font-bold text-muted-foreground/60 px-2 py-1 border-b border-white/10 whitespace-nowrap"
                                    >
                                        {c.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, i) => (
                                <tr key={i} className="border-b border-white/5">
                                    {columns.map((c, ci) => (
                                        <td
                                            key={c.key}
                                            className={cn(
                                                'px-2 py-1 tabular-nums whitespace-nowrap',
                                                ci === 0 ? 'text-muted-foreground/80 font-semibold' : 'text-foreground',
                                            )}
                                        >
                                            {formatValue ? formatValue(c.key, row[c.key]) : String(row[c.key] ?? '—')}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
