import { describe, it, expect, vi } from 'vitest';
import { resolveAmountIn } from '../utils/resolve-amount';

// Stand-in for the live-rate converter. 1 USD = 80 INR.
const LIVE: Record<string, number> = { 'USD->INR': 80, 'INR->USD': 1 / 80 };
const liveConvert = (amount: number, from: string, to?: string) =>
    amount * (LIVE[`${from.toUpperCase()}->${(to || 'INR').toUpperCase()}`] ?? 1);

describe('resolveAmountIn', () => {
    it('passes same-currency amounts through untouched', () => {
        const convert = vi.fn(liveConvert);
        const r = resolveAmountIn({ amount: 250, currency: 'INR' }, 250, 'INR', convert);
        expect(r).toEqual({ amount: 250, usedLiveRate: false });
        expect(convert).not.toHaveBeenCalled();
    });

    it('treats a missing tx currency as already being in the target', () => {
        const r = resolveAmountIn({ amount: 40 }, 40, 'INR', liveConvert);
        expect(r.amount).toBe(40);
        expect(r.usedLiveRate).toBe(false);
    });

    it('uses the stored converted_amount when base_currency matches', () => {
        const r = resolveAmountIn(
            { amount: 10, currency: 'USD', base_currency: 'INR', exchange_rate: 83, converted_amount: 830 },
            10,
            'INR',
            liveConvert,
        );
        // Historical rate (83), not today's 80.
        expect(r).toEqual({ amount: 830, usedLiveRate: false });
    });

    it('scales converted_amount down to a partial split share', () => {
        const r = resolveAmountIn(
            { amount: 10, currency: 'USD', base_currency: 'INR', exchange_rate: 83, converted_amount: 830 },
            2.5, // the user's quarter of a 4-way split
            'INR',
            liveConvert,
        );
        expect(r.amount).toBeCloseTo(207.5, 6);
        expect(r.usedLiveRate).toBe(false);
    });

    it('falls back to exchange_rate when converted_amount is absent', () => {
        const r = resolveAmountIn(
            { amount: 10, currency: 'USD', base_currency: 'INR', exchange_rate: 83 },
            10,
            'INR',
            liveConvert,
        );
        expect(r).toEqual({ amount: 830, usedLiveRate: false });
    });

    it('rejects exchange_rate === 1 on a cross-currency row and uses a live rate', () => {
        // getExchangeRate returns `rate || 1` when the FX lookup fails, so a stored
        // 1 on a USD row with an INR base means "unknown", not "parity".
        const r = resolveAmountIn(
            { amount: 10, currency: 'USD', base_currency: 'INR', exchange_rate: 1, converted_amount: 10 },
            10,
            'INR',
            liveConvert,
        );
        expect(r).toEqual({ amount: 800, usedLiveRate: true });
    });

    it('uses a live rate when base_currency is a stale, non-target currency', () => {
        // User switched base from EUR to INR after this row was written.
        const r = resolveAmountIn(
            { amount: 10, currency: 'USD', base_currency: 'EUR', exchange_rate: 0.92, converted_amount: 9.2 },
            10,
            'INR',
            liveConvert,
        );
        expect(r).toEqual({ amount: 800, usedLiveRate: true });
    });

    it('uses a live rate when no stored conversion data exists', () => {
        const r = resolveAmountIn({ amount: 10, currency: 'USD' }, 10, 'INR', liveConvert);
        expect(r).toEqual({ amount: 800, usedLiveRate: true });
    });

    it('ignores a zero or negative stored exchange_rate', () => {
        for (const rate of [0, -3]) {
            const r = resolveAmountIn(
                { amount: 10, currency: 'USD', base_currency: 'INR', exchange_rate: rate },
                10,
                'INR',
                liveConvert,
            );
            expect(r).toEqual({ amount: 800, usedLiveRate: true });
        }
    });

    it('is case-insensitive about currency codes', () => {
        const r = resolveAmountIn({ amount: 12, currency: 'inr' }, 12, 'INR', liveConvert);
        expect(r.amount).toBe(12);
        expect(r.usedLiveRate).toBe(false);
    });

    it('agrees across the surfaces that used to diverge on a failed-lookup row', () => {
        // Regression guard for the analytics-vs-dashboard drift: the dashboard
        // rejected exchange_rate === 1 while analytics and buckets trusted it, so
        // the same row totalled differently on each screen.
        const row = { amount: 10, currency: 'USD', base_currency: 'INR', exchange_rate: 1, converted_amount: 10 };
        const dashboard = resolveAmountIn(row, 10, 'INR', liveConvert).amount;
        const analytics = resolveAmountIn(row, 10, 'INR', liveConvert).amount;
        const buckets = resolveAmountIn(row, 10, 'INR', liveConvert).amount;
        expect(dashboard).toBe(analytics);
        expect(analytics).toBe(buckets);
    });
});
