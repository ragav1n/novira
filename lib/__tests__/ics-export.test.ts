import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { addDays, addYears, format } from 'date-fns';
import { buildIcs, escapeText } from '../ics-export';
import type { RecurringTemplate } from '@/types/transaction';
import type { SavingsGoal } from '@/types/goal';
import type { Bucket } from '@/types/bucket';

const isoDate = (d: Date) => format(d, 'yyyy-MM-dd');

// Fixed "today" for deterministic tests.
const FIXED_NOW = new Date('2026-05-28T10:00:00Z');

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
    vi.useRealTimers();
});

const baseTemplate: RecurringTemplate = {
    id: 'tpl-1',
    description: 'Netflix',
    amount: 15.99,
    currency: 'USD',
    frequency: 'monthly',
    next_occurrence: isoDate(addDays(new Date(), 3)),
    category: 'entertainment',
    is_active: true,
    created_at: '2026-01-01',
    payment_method: 'card',
};

const baseGoal: SavingsGoal = {
    id: 'goal-1',
    user_id: 'u1',
    name: 'Berlin trip',
    target_amount: 2000,
    current_amount: 800,
    currency: 'EUR',
    deadline: isoDate(addDays(new Date(), 30)),
    icon: 'plane',
    color: 'emerald',
};

const baseBucket: Bucket = {
    id: 'b-1',
    user_id: 'u1',
    name: 'Berlin trip bucket',
    budget: 1500,
    type: 'trip',
    icon: 'plane',
    color: 'emerald',
    is_archived: false,
    created_at: '2026-01-01',
    start_date: isoDate(addDays(new Date(), 10)),
    end_date: isoDate(addDays(new Date(), 17)),
    currency: 'EUR',
};

describe('escapeText', () => {
    it('escapes commas, semicolons, newlines, backslashes', () => {
        expect(escapeText('a,b;c\nd\\e')).toBe('a\\,b\\;c\\nd\\\\e');
    });

    it('handles empty string', () => {
        expect(escapeText('')).toBe('');
    });
});

describe('buildIcs — recurring templates', () => {
    it('emits VEVENT with bounded RRULE and 1-day-before VALARM for bills', () => {
        const ics = buildIcs({ recurringTemplates: [baseTemplate], goals: [], buckets: [] });
        expect(ics).toContain('BEGIN:VEVENT');
        expect(ics).toContain('SUMMARY:Bill: Netflix');
        // Bounded RRULE — UNTIL approximately +5 years
        expect(ics).toMatch(/RRULE:FREQ=MONTHLY;UNTIL=\d{8}T235959Z/);
        const expectedUntil = format(addYears(FIXED_NOW, 5), 'yyyyMMdd');
        expect(ics).toContain(`UNTIL=${expectedUntil}T235959Z`);
        // Alarm
        expect(ics).toContain('BEGIN:VALARM');
        expect(ics).toContain('TRIGGER:-P1D');
        expect(ics).toContain('END:VALARM');
        // DTEND set to next day for all-day events
        const startStr = format(addDays(FIXED_NOW, 3), 'yyyyMMdd');
        const endStr = format(addDays(FIXED_NOW, 4), 'yyyyMMdd');
        expect(ics).toContain(`DTSTART;VALUE=DATE:${startStr}`);
        expect(ics).toContain(`DTEND;VALUE=DATE:${endStr}`);
        // Bills are OPAQUE so they're visible in calendar overlays
        expect(ics).toContain('TRANSP:OPAQUE');
    });

    it('income templates get NO alarm and stay TRANSPARENT', () => {
        const incomeTpl: RecurringTemplate = { ...baseTemplate, id: 'tpl-inc', description: 'Salary', is_income: true };
        const ics = buildIcs({ recurringTemplates: [incomeTpl], goals: [], buckets: [] });
        expect(ics).toContain('SUMMARY:Income: Salary');
        // No alarm block between this event's BEGIN and END
        const evStart = ics.indexOf('BEGIN:VEVENT');
        const evEnd = ics.indexOf('END:VEVENT', evStart);
        const slice = ics.slice(evStart, evEnd);
        expect(slice).not.toContain('BEGIN:VALARM');
        expect(slice).toContain('TRANSP:TRANSPARENT');
    });

    it('skips a paused template (pause_until in the future)', () => {
        const paused: RecurringTemplate = {
            ...baseTemplate,
            metadata: { pause_until: isoDate(addDays(new Date(), 14)) },
        };
        const ics = buildIcs({ recurringTemplates: [paused], goals: [], buckets: [] });
        expect(ics).not.toContain('BEGIN:VEVENT');
    });

    it('includes a paused template if pause_until is in the past', () => {
        const expired: RecurringTemplate = {
            ...baseTemplate,
            metadata: { pause_until: isoDate(addDays(new Date(), -3)) },
        };
        const ics = buildIcs({ recurringTemplates: [expired], goals: [], buckets: [] });
        expect(ics).toContain('BEGIN:VEVENT');
    });

    it('emits a separate Trial Ends event when metadata.trial_ends_at is set', () => {
        const trial: RecurringTemplate = {
            ...baseTemplate,
            metadata: { trial_ends_at: isoDate(addDays(new Date(), 7)) },
        };
        const ics = buildIcs({ recurringTemplates: [trial], goals: [], buckets: [] });
        // Two events: the recurring one + the trial-end one
        const eventCount = (ics.match(/BEGIN:VEVENT/g) || []).length;
        expect(eventCount).toBe(2);
        expect(ics).toContain('SUMMARY:Trial ends: Netflix');
        expect(ics).toContain('TRIGGER:-P3D');
    });

    it('omits inactive templates', () => {
        const ics = buildIcs({
            recurringTemplates: [{ ...baseTemplate, is_active: false }],
            goals: [], buckets: [],
        });
        expect(ics).not.toContain('BEGIN:VEVENT');
    });
});

describe('buildIcs — savings goals', () => {
    it('emits main deadline event + 7-day and 1-day reminder events', () => {
        const ics = buildIcs({ recurringTemplates: [], goals: [baseGoal], buckets: [] });
        const eventCount = (ics.match(/BEGIN:VEVENT/g) || []).length;
        expect(eventCount).toBe(3);
        expect(ics).toContain('SUMMARY:Goal deadline: Berlin trip');
        expect(ics).toMatch(/SUMMARY:Goal due in 7d: Berlin trip/);
        expect(ics).toMatch(/SUMMARY:Goal due in 1d: Berlin trip/);
    });

    it('skips completed goals', () => {
        const done = { ...baseGoal, current_amount: 2000 };
        const ics = buildIcs({ recurringTemplates: [], goals: [done], buckets: [] });
        expect(ics).not.toContain('BEGIN:VEVENT');
    });

    it('skips past-deadline goals', () => {
        const past = { ...baseGoal, deadline: isoDate(addDays(new Date(), -1)) };
        const ics = buildIcs({ recurringTemplates: [], goals: [past], buckets: [] });
        expect(ics).not.toContain('BEGIN:VEVENT');
    });

    it('skips reminder events whose dates are already past', () => {
        // Deadline 2 days out — the 7-day reminder is already past, only main + 1-day fire.
        const soon = { ...baseGoal, deadline: isoDate(addDays(new Date(), 2)) };
        const ics = buildIcs({ recurringTemplates: [], goals: [soon], buckets: [] });
        const eventCount = (ics.match(/BEGIN:VEVENT/g) || []).length;
        expect(eventCount).toBe(2);
        expect(ics).not.toMatch(/SUMMARY:Goal due in 7d/);
    });
});

describe('buildIcs — buckets', () => {
    it('emits multi-day event spanning start_date → end_date+1', () => {
        const ics = buildIcs({ recurringTemplates: [], goals: [], buckets: [baseBucket] });
        const startStr = format(addDays(FIXED_NOW, 10), 'yyyyMMdd');
        const endStr = format(addDays(FIXED_NOW, 18), 'yyyyMMdd'); // end_date + 1
        expect(ics).toContain(`DTSTART;VALUE=DATE:${startStr}`);
        expect(ics).toContain(`DTEND;VALUE=DATE:${endStr}`);
        expect(ics).toContain('SUMMARY:Bucket: Berlin trip bucket');
    });

    it('falls back to single-day event when start_date is missing', () => {
        const noStart = { ...baseBucket, start_date: undefined };
        const ics = buildIcs({ recurringTemplates: [], goals: [], buckets: [noStart] });
        const onlyStart = format(addDays(FIXED_NOW, 17), 'yyyyMMdd');
        const onlyEnd = format(addDays(FIXED_NOW, 18), 'yyyyMMdd');
        expect(ics).toContain(`DTSTART;VALUE=DATE:${onlyStart}`);
        expect(ics).toContain(`DTEND;VALUE=DATE:${onlyEnd}`);
    });

    it('skips archived buckets', () => {
        const ics = buildIcs({
            recurringTemplates: [], goals: [],
            buckets: [{ ...baseBucket, is_archived: true }],
        });
        expect(ics).not.toContain('BEGIN:VEVENT');
    });

    it('skips past buckets', () => {
        const past = { ...baseBucket, end_date: isoDate(addDays(new Date(), -1)) };
        const ics = buildIcs({ recurringTemplates: [], goals: [], buckets: [past] });
        expect(ics).not.toContain('BEGIN:VEVENT');
    });
});

describe('buildIcs — file structure', () => {
    it('emits valid VCALENDAR envelope with CRLF and trailing newline', () => {
        const ics = buildIcs({ recurringTemplates: [], goals: [], buckets: [] });
        expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/);
        expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
        expect(ics).toContain('VERSION:2.0');
        expect(ics).toContain('PRODID:-//Novira//Calendar Export 2.0//EN');
        expect(ics).toContain('X-WR-CALNAME:Novira Bills, Goals & Buckets');
    });

    it('uses CRLF as the line separator throughout', () => {
        const ics = buildIcs({ recurringTemplates: [baseTemplate], goals: [], buckets: [] });
        // Every non-final line ends with CRLF — no bare LFs in content.
        const lfOnly = ics.split('\r\n').join('').includes('\n');
        expect(lfOnly).toBe(false);
    });
});
