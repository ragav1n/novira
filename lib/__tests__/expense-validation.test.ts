import { describe, it, expect } from 'vitest';
import { getExpenseFormErrors } from '../expense-validation';

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
