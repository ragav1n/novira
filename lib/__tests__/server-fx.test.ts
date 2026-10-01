import { describe, it, expect, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/server-exchange-rates', () => ({
    getServerRatesMap: vi.fn(async (pairs: Array<{ from: string; to: string }>) =>
        new Map(pairs.filter(p => p.from === 'INR' && p.to === 'USD').map(p => [`${p.from}->${p.to}`, 0.012]))),
}));

import { loadConverter } from '@/lib/server/fx';

describe('loadConverter', () => {
    it('converts a foreign row whose stored rate points at an old base', async () => {
        // Entered while the base was INR, so the stored rate is INR->INR.
        const tx = { amount: 479, currency: 'INR', base_currency: 'INR', exchange_rate: 1, converted_amount: 479 };
        const toCurrency = await loadConverter([{ tx, target: 'USD' }]);
        expect(toCurrency(tx, 'USD')).toBeCloseTo(5.748);
    });

    it('prefers the rate stored against the current base', async () => {
        const tx = { amount: 479, currency: 'INR', base_currency: 'USD', exchange_rate: 0.0113, converted_amount: null };
        const toCurrency = await loadConverter([{ tx, target: 'USD' }]);
        expect(toCurrency(tx, 'USD')).toBeCloseTo(479 * 0.0113);
    });

    it('returns null instead of the face value when no rate is known', async () => {
        const tx = { amount: 100, currency: 'EUR', base_currency: null, exchange_rate: null };
        const toCurrency = await loadConverter([{ tx, target: 'USD' }]);
        vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(toCurrency(tx, 'USD')).toBeNull();
    });

    it('scales a split share and leaves same-currency rows alone', async () => {
        const inr = { amount: 1000, currency: 'INR', base_currency: 'INR', exchange_rate: 1 };
        const usd = { amount: 20, currency: 'USD' };
        const toCurrency = await loadConverter([{ tx: inr, target: 'USD' }, { tx: usd, target: 'USD' }]);
        expect(toCurrency(inr, 'USD', 250)).toBeCloseTo(3);
        expect(toCurrency(usd, 'USD')).toBe(20);
    });
});
