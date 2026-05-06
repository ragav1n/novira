import type { RecurringTemplate } from '@/types/transaction';
import type { Bucket } from '@/types/bucket';
import type { SavingsGoal } from '@/types/goal';

const FREQ_MAP: Record<RecurringTemplate['frequency'], string> = {
    daily: 'DAILY',
    weekly: 'WEEKLY',
    monthly: 'MONTHLY',
    yearly: 'YEARLY',
};

function escapeText(s: string): string {
    return s
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\r?\n/g, '\\n');
}

function toIcsDate(iso: string): string {
    return iso.slice(0, 10).replace(/-/g, '');
}

function nowStamp(): string {
    const d = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return (
        d.getUTCFullYear().toString() +
        pad(d.getUTCMonth() + 1) +
        pad(d.getUTCDate()) +
        'T' +
        pad(d.getUTCHours()) +
        pad(d.getUTCMinutes()) +
        pad(d.getUTCSeconds()) +
        'Z'
    );
}

interface BuildArgs {
    recurringTemplates: RecurringTemplate[];
    goals: SavingsGoal[];
    buckets: Bucket[];
    formatAmount?: (amount: number, currency: string) => string;
}

export function buildIcs({
    recurringTemplates,
    goals,
    buckets,
    formatAmount,
}: BuildArgs): string {
    const stamp = nowStamp();
    const today = new Date().toISOString().slice(0, 10);
    const events: string[] = [];

    for (const t of recurringTemplates) {
        if (!t.is_active || !t.next_occurrence) continue;
        const pause = t.metadata?.pause_until;
        if (pause && typeof pause === 'string' && pause > today) continue;

        const amount = formatAmount ? formatAmount(t.amount, t.currency) : `${t.amount} ${t.currency}`;
        const kindLabel = t.is_income ? 'Income' : 'Bill';
        const summary = escapeText(`${kindLabel}: ${t.description} — ${amount}`);
        const desc = escapeText(t.is_income ? 'Novira recurring income' : 'Novira recurring expense');

        events.push(
            'BEGIN:VEVENT',
            `UID:novira-recurring-${t.id}@novira-one.vercel.app`,
            `DTSTAMP:${stamp}`,
            `DTSTART;VALUE=DATE:${toIcsDate(t.next_occurrence)}`,
            `SUMMARY:${summary}`,
            `DESCRIPTION:${desc}`,
            `RRULE:FREQ=${FREQ_MAP[t.frequency]}`,
            'TRANSP:TRANSPARENT',
            'END:VEVENT',
        );
    }

    for (const g of goals) {
        if (!g.deadline) continue;
        if (g.deadline.slice(0, 10) < today) continue;

        const remaining = Math.max(0, g.target_amount - g.current_amount);
        const remainingText = formatAmount ? formatAmount(remaining, g.currency) : `${remaining} ${g.currency}`;
        const summary = escapeText(`Goal deadline: ${g.name}`);
        const desc = escapeText(`Remaining: ${remainingText}`);

        events.push(
            'BEGIN:VEVENT',
            `UID:novira-goal-${g.id}@novira-one.vercel.app`,
            `DTSTAMP:${stamp}`,
            `DTSTART;VALUE=DATE:${toIcsDate(g.deadline)}`,
            `SUMMARY:${summary}`,
            `DESCRIPTION:${desc}`,
            'TRANSP:TRANSPARENT',
            'END:VEVENT',
        );
    }

    for (const b of buckets) {
        if (!b.end_date || b.is_archived) continue;
        if (b.end_date.slice(0, 10) < today) continue;

        const summary = escapeText(`Bucket ends: ${b.name}`);
        const budgetText = formatAmount ? formatAmount(b.budget, b.currency || 'USD') : `${b.budget} ${b.currency || ''}`.trim();

        events.push(
            'BEGIN:VEVENT',
            `UID:novira-bucket-${b.id}@novira-one.vercel.app`,
            `DTSTAMP:${stamp}`,
            `DTSTART;VALUE=DATE:${toIcsDate(b.end_date)}`,
            `SUMMARY:${summary}`,
            `DESCRIPTION:${escapeText(`Budget: ${budgetText}`)}`,
            'TRANSP:TRANSPARENT',
            'END:VEVENT',
        );
    }

    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Novira//Calendar Export//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:Novira',
        ...events,
        'END:VCALENDAR',
        '',
    ].join('\r\n');
}

export function downloadIcs(filename: string, ics: string): void {
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
