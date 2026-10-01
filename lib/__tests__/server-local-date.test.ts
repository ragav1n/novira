import { describe, it, expect, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { localDate, shiftDays } from '@/lib/server/local-date';
import { payerShare } from '@/lib/server/spend';

describe('localDate', () => {
    // 02:30 UTC — when the daily crons run.
    const cronRun = new Date('2026-10-01T02:30:00Z');

    it('is still the previous day in the Americas at cron time', () => {
        expect(localDate('America/New_York', cronRun)).toBe('2026-09-30');
        expect(localDate('America/Los_Angeles', cronRun)).toBe('2026-09-30');
    });

    it('is the UTC day east of UTC', () => {
        expect(localDate('Asia/Kolkata', cronRun)).toBe('2026-10-01');
    });

    it('falls back to UTC for a missing or invalid zone', () => {
        expect(localDate(null, cronRun)).toBe('2026-10-01');
        expect(localDate('Not/AZone', cronRun)).toBe('2026-10-01');
    });
});

describe('shiftDays', () => {
    it('crosses month and year boundaries', () => {
        expect(shiftDays('2026-10-01', -1)).toBe('2026-09-30');
        expect(shiftDays('2026-12-31', 1)).toBe('2027-01-01');
        expect(shiftDays('2024-03-01', -1)).toBe('2024-02-29');
    });
});

describe('payerShare', () => {
    it('is the full amount for an unsplit row', () => {
        expect(payerShare({ amount: 479 })).toBe(479);
        expect(payerShare({ amount: '479', splits: [] })).toBe(479);
    });

    it('subtracts what the other people owe', () => {
        expect(payerShare({ amount: 3000, splits: [{ amount: 1000 }, { amount: '1000' }] })).toBe(1000);
    });
});
