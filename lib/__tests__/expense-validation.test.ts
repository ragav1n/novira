import { describe, it, expect } from 'vitest';
import { getExpenseFormErrors, parseAmountStrict, toCents } from '../expense-validation';

const DATE = new Date('2026-08-21T00:00:00Z');
const amountError = (amount: string) =>
    getExpenseFormErrors(amount, 'Groceries', DATE)?.amount;

describe('getExpenseFormErrors — amount', () => {
    it('accepts plain numbers', () => {
        for (const ok of ['51.72', '0.01', '1', '.5', '999999999']) {
            expect(amountError(ok), ok).toBeUndefined();
        }
    });

    /**
     * These all used to pass validation, because parseFloat accepts a numeric
     * prefix. "1,234" saved as 1 — a 1000x error, with a success toast and no
     * inline message.
     */
    it.each([
        ['1,234', 1],
        ['20-30', 20],
        ['2/0', 2],
        ['10+5)', 10],
        ['12+', 12],
        ['5%2', 5],
    ])('rejects %s, which parseFloat would have read as %i', (input, wouldHaveBeen) => {
        expect(parseFloat(input)).toBe(wouldHaveBeen); // documents the old behaviour
        expect(amountError(input)).toBeTruthy();
    });

    it('tells the user to finish an unresolved calculation', () => {
        expect(amountError('12+')).toMatch(/calculation/i);
        expect(amountError('(3+4')).toMatch(/calculation/i);
    });

    it('gives a plain-number message when there is no operator', () => {
        expect(amountError('1,234')).toMatch(/plain number/i);
        expect(amountError('abc')).toMatch(/plain number/i);
    });

    it('still enforces the range', () => {
        expect(amountError('0')).toMatch(/greater than 0/);
        expect(amountError('1000000000')).toMatch(/too large/);
    });

    it('still requires an amount', () => {
        expect(amountError('')).toMatch(/required/);
        expect(amountError('   ')).toMatch(/required/);
    });
});

describe('getExpenseFormErrors — other fields', () => {
    it('requires a description and a date', () => {
        const e = getExpenseFormErrors('10', '   ', undefined);
        expect(e?.description).toMatch(/required/);
        expect(e?.date).toMatch(/required/);
    });

    it('caps description length', () => {
        expect(getExpenseFormErrors('10', 'x'.repeat(301), DATE)?.description).toMatch(/too long/);
        expect(getExpenseFormErrors('10', 'x'.repeat(300), DATE)).toBeNull();
    });

    it('returns null when everything is valid', () => {
        expect(getExpenseFormErrors('51.72', 'Groceries', DATE)).toBeNull();
    });
});

describe('parseAmountStrict', () => {
    it('parses plain numbers', () => {
        expect(parseAmountStrict('51.72')).toBe(51.72);
        expect(parseAmountStrict('  10 ')).toBe(10);
        expect(parseAmountStrict('.5')).toBe(0.5);
    });

    it('returns null where parseFloat would have taken a prefix', () => {
        for (const bad of ['1,234', '12+', '20-30', '5%2', 'abc', '', '  ']) {
            expect(parseAmountStrict(bad), bad).toBeNull();
        }
    });
});

describe('toCents', () => {
    it('makes an exactly-balanced split compare as balanced', () => {
        // The bug: 1.1 + 2.2 === 3.3000000000000003, so splitting 3.30 into
        // 1.10 and 2.20 was rejected as exceeding the total.
        expect(1.1 + 2.2 > 3.3).toBe(true);
        expect(toCents(1.1) + toCents(2.2) > toCents(3.3)).toBe(false);
        expect(toCents(1.1) + toCents(2.2)).toBe(toCents(3.3));
    });

    it('still catches a genuine over-allocation', () => {
        expect(toCents(2.0) + toCents(2.0) > toCents(3.3)).toBe(true);
        expect(toCents(3.31) > toCents(3.3)).toBe(true);
    });

    it('rounds half-cents rather than truncating', () => {
        expect(toCents(0.005)).toBe(1);
        expect(toCents(10.994)).toBe(1099);
    });
});
