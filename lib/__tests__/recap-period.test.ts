import { describe, expect, it } from 'vitest';
import { formatRecapPeriod, isYearlyPeriod } from '@/lib/recap-period';

describe('isYearlyPeriod', () => {
    it('recognises the full-year key', () => {
        expect(isYearlyPeriod('2025-FY')).toBe(true);
    });

    it('rejects month keys and empty input', () => {
        expect(isYearlyPeriod('2025-07')).toBe(false);
        expect(isYearlyPeriod(null)).toBe(false);
        expect(isYearlyPeriod(undefined)).toBe(false);
        expect(isYearlyPeriod('')).toBe(false);
    });
});

describe('formatRecapPeriod', () => {
    it('labels month keys', () => {
        expect(formatRecapPeriod('2026-01')).toBe('January 2026');
        expect(formatRecapPeriod('2026-12')).toBe('December 2026');
    });

    // The yearly cron writes `YYYY-FY` rows into the same table the month
    // picker reads, and date-fns throws on the Invalid Date they used to produce.
    it('labels the full-year key without going through Date', () => {
        expect(formatRecapPeriod('2025-FY')).toBe('2025 · Full year');
    });

    it('returns a usable string for junk input', () => {
        expect(formatRecapPeriod('2025-13')).toBe('2025-13');
        expect(formatRecapPeriod('nonsense')).toBe('nonsense');
        expect(formatRecapPeriod(null)).toBe('');
    });
});
