import { describe, it, expect } from 'vitest';
import { nextOccurrence } from '../recurrence';

const d = (s: string) => new Date(`${s}T12:00:00`);
const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;

describe('nextOccurrence', () => {
    it('advances daily and weekly', () => {
        expect(iso(nextOccurrence(d('2026-08-21'), 'daily'))).toBe('2026-08-22');
        expect(iso(nextOccurrence(d('2026-08-21'), 'weekly'))).toBe('2026-08-28');
    });

    /**
     * Plain setMonth rolls over: Jan 31 + 1 month is Mar 3. The preview in the
     * add-expense form used to do exactly that, so it promised the user a date
     * the stored next_occurrence never matched.
     */
    it('clamps a month-end date instead of rolling over', () => {
        expect(iso(nextOccurrence(d('2026-01-31'), 'monthly'))).toBe('2026-02-28');
        expect(iso(nextOccurrence(d('2026-03-31'), 'monthly'))).toBe('2026-04-30');
        expect(iso(nextOccurrence(d('2026-05-31'), 'monthly'))).toBe('2026-06-30');
    });

    it('clamps to Feb 29 in a leap year', () => {
        expect(iso(nextOccurrence(d('2028-01-31'), 'monthly'))).toBe('2028-02-29');
    });

    it('leaves an ordinary monthly date alone', () => {
        expect(iso(nextOccurrence(d('2026-08-15'), 'monthly'))).toBe('2026-09-15');
        expect(iso(nextOccurrence(d('2026-12-15'), 'monthly'))).toBe('2027-01-15');
    });

    it('advances yearly, including across a leap day', () => {
        expect(iso(nextOccurrence(d('2026-08-21'), 'yearly'))).toBe('2027-08-21');
        expect(iso(nextOccurrence(d('2028-02-29'), 'yearly'))).toBe('2029-03-01');
    });

    it('does not mutate its input', () => {
        const src = d('2026-01-31');
        nextOccurrence(src, 'monthly');
        expect(iso(src)).toBe('2026-01-31');
    });
});
