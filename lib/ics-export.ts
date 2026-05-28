import { addDays, addYears, parseISO, format, isValid } from 'date-fns';
import type { RecurringTemplate } from '@/types/transaction';
import type { Bucket } from '@/types/bucket';
import type { SavingsGoal } from '@/types/goal';

const APP_HOST = 'novira-one.vercel.app';

const FREQ_MAP: Record<RecurringTemplate['frequency'], string> = {
    daily: 'DAILY',
    weekly: 'WEEKLY',
    monthly: 'MONTHLY',
    yearly: 'YEARLY',
};

export function escapeText(s: string): string {
    return s
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\r?\n/g, '\\n');
}

function toIcsDate(iso: string): string {
    return iso.slice(0, 10).replace(/-/g, '');
}

function nextDay(iso: string): string {
    const d = parseISO(iso.slice(0, 10));
    return format(addDays(d, 1), 'yyyyMMdd');
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

function isFutureDate(iso: string, today: Date): boolean {
    const d = parseISO(iso.slice(0, 10));
    if (!isValid(d)) return false;
    return d.getTime() > today.getTime();
}

function rruleUntil(frequency: RecurringTemplate['frequency'], horizonYears = 5): string {
    const until = format(addYears(new Date(), horizonYears), "yyyyMMdd'T'235959'Z'");
    return `RRULE:FREQ=${FREQ_MAP[frequency]};UNTIL=${until}`;
}

interface AlarmSpec {
    trigger: string; // e.g. '-P1D' (1 day before), '-P7D' (7 days)
    description: string;
}

function alarmBlock({ trigger, description }: AlarmSpec): string[] {
    return [
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `TRIGGER:${trigger}`,
        `DESCRIPTION:${escapeText(description)}`,
        'END:VALARM',
    ];
}

interface EventSpec {
    uid: string;
    dtstart: string; // YYYYMMDD
    dtend?: string;  // YYYYMMDD (exclusive — RFC 5545 convention for all-day)
    summary: string;
    description: string;
    category?: string;
    url?: string;
    rrule?: string;
    transp?: 'OPAQUE' | 'TRANSPARENT';
    alarms?: AlarmSpec[];
}

function eventBlock(stamp: string, ev: EventSpec): string[] {
    const lines: string[] = [
        'BEGIN:VEVENT',
        `UID:${ev.uid}`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${ev.dtstart}`,
    ];
    if (ev.dtend) lines.push(`DTEND;VALUE=DATE:${ev.dtend}`);
    lines.push(`SUMMARY:${escapeText(ev.summary)}`);
    lines.push(`DESCRIPTION:${escapeText(ev.description)}`);
    if (ev.category) lines.push(`CATEGORIES:${ev.category}`);
    if (ev.url) lines.push(`URL:${ev.url}`);
    if (ev.rrule) lines.push(ev.rrule);
    lines.push(`TRANSP:${ev.transp ?? 'TRANSPARENT'}`);
    if (ev.alarms) for (const a of ev.alarms) lines.push(...alarmBlock(a));
    lines.push('END:VEVENT');
    return lines;
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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = format(today, 'yyyy-MM-dd');
    const fmt = (amount: number, cur: string) =>
        formatAmount ? formatAmount(amount, cur) : `${amount} ${cur}`;

    const events: string[] = [];

    // ── Recurring templates ──────────────────────────────────────────────────
    for (const t of recurringTemplates) {
        if (!t.is_active || !t.next_occurrence) continue;
        const pause = t.metadata?.pause_until;
        if (typeof pause === 'string' && isFutureDate(pause, today)) continue;

        const amount = fmt(t.amount, t.currency);
        const kind = t.is_income ? 'Income' : 'Bill';
        const cat = (t.category || '').toString();
        const method = t.payment_method ? ` · ${t.payment_method}` : '';
        const desc = [
            `${amount}`,
            cat ? `Category: ${cat}` : null,
            method ? `Paid by:${method}` : null,
            'Manage in Novira → https://' + APP_HOST + '/settings#subs',
        ].filter(Boolean).join('\n');

        events.push(...eventBlock(stamp, {
            uid: `novira-recurring-${t.id}@${APP_HOST}`,
            dtstart: toIcsDate(t.next_occurrence),
            dtend: nextDay(t.next_occurrence),
            summary: `${kind}: ${t.description} — ${amount}`,
            description: desc,
            category: t.is_income ? 'Novira/Income' : 'Novira/Bills',
            url: `https://${APP_HOST}/settings#subs`,
            rrule: rruleUntil(t.frequency, 5),
            transp: t.is_income ? 'TRANSPARENT' : 'OPAQUE',
            alarms: t.is_income ? [] : [{
                trigger: '-P1D',
                description: `Bill due tomorrow: ${t.description} (${amount})`,
            }],
        }));

        // Trial-end milestone — one-shot event when a subscription is in trial.
        const trialEnds = t.metadata?.trial_ends_at;
        if (typeof trialEnds === 'string' && isFutureDate(trialEnds, today)) {
            events.push(...eventBlock(stamp, {
                uid: `novira-trial-${t.id}@${APP_HOST}`,
                dtstart: toIcsDate(trialEnds),
                dtend: nextDay(trialEnds),
                summary: `Trial ends: ${t.description}`,
                description: `Your trial converts to a paid charge of ${amount}. Cancel before this date if you don't want to be billed.\nManage in Novira → https://${APP_HOST}/settings#subs`,
                category: 'Novira/Trials',
                url: `https://${APP_HOST}/settings#subs`,
                transp: 'OPAQUE',
                alarms: [{
                    trigger: '-P3D',
                    description: `Trial ending in 3 days: ${t.description} (${amount})`,
                }],
            }));
        }
    }

    // ── Savings goals ────────────────────────────────────────────────────────
    for (const g of goals) {
        if (!g.deadline) continue;
        if (g.deadline.slice(0, 10) < todayIso) continue;
        if (g.current_amount >= g.target_amount) continue; // already complete

        const remaining = Math.max(0, g.target_amount - g.current_amount);
        const pct = g.target_amount > 0 ? (g.current_amount / g.target_amount) * 100 : 0;
        const remainingText = fmt(remaining, g.currency);
        const targetText = fmt(g.target_amount, g.currency);
        const desc = [
            `Goal: ${g.name}`,
            `Target: ${targetText}`,
            `Remaining: ${remainingText} (${pct.toFixed(0)}% complete)`,
            `Track in Novira → https://${APP_HOST}/?tab=goals`,
        ].join('\n');

        // Main deadline event
        events.push(...eventBlock(stamp, {
            uid: `novira-goal-${g.id}@${APP_HOST}`,
            dtstart: toIcsDate(g.deadline),
            dtend: nextDay(g.deadline),
            summary: `Goal deadline: ${g.name}`,
            description: desc,
            category: 'Novira/Goals',
            url: `https://${APP_HOST}/?tab=goals`,
            transp: 'OPAQUE',
        }));

        // Pre-deadline reminder events — only if the date hasn't passed.
        const deadlineDate = parseISO(g.deadline.slice(0, 10));
        for (const offset of [7, 1]) {
            const remindOn = addDays(deadlineDate, -offset);
            if (remindOn.getTime() <= today.getTime()) continue;
            const remindIso = format(remindOn, 'yyyy-MM-dd');
            events.push(...eventBlock(stamp, {
                uid: `novira-goal-${g.id}-warn${offset}@${APP_HOST}`,
                dtstart: toIcsDate(remindIso),
                dtend: nextDay(remindIso),
                summary: `Goal due in ${offset}d: ${g.name} — ${remainingText} to go`,
                description: desc,
                category: 'Novira/Goals',
                url: `https://${APP_HOST}/?tab=goals`,
                transp: 'TRANSPARENT',
            }));
        }
    }

    // ── Buckets ──────────────────────────────────────────────────────────────
    for (const b of buckets) {
        if (b.is_archived) continue;
        if (!b.end_date) continue;
        if (b.end_date.slice(0, 10) < todayIso) continue;

        const budgetText = b.budget > 0 ? fmt(b.budget, b.currency || 'USD') : null;
        const descLines = [
            budgetText ? `Budget: ${budgetText}` : null,
            b.type ? `Type: ${b.type}` : null,
            `Open in Novira → https://${APP_HOST}/?tab=buckets`,
        ].filter(Boolean) as string[];

        const hasSpan = !!b.start_date && b.start_date.slice(0, 10) <= b.end_date.slice(0, 10);

        events.push(...eventBlock(stamp, {
            uid: `novira-bucket-${b.id}@${APP_HOST}`,
            dtstart: hasSpan ? toIcsDate(b.start_date!) : toIcsDate(b.end_date),
            dtend: nextDay(b.end_date),
            summary: `Bucket: ${b.name}`,
            description: descLines.join('\n'),
            category: 'Novira/Buckets',
            url: `https://${APP_HOST}/?tab=buckets`,
            transp: 'TRANSPARENT',
            alarms: [
                { trigger: '-P1D', description: `Bucket "${b.name}" ends tomorrow` },
            ],
        }));
    }

    return [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Novira//Calendar Export 2.0//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:Novira Bills, Goals & Buckets',
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
