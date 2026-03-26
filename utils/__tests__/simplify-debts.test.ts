import { describe, it, expect } from 'vitest';
import { simplifyDebts } from '../simplify-debts';

const noConvert = (amount: number, _from: string, _to?: string) => amount;

describe('simplifyDebts', () => {
    it('returns empty array for no splits', () => {
        expect(simplifyDebts([], 'user-a', noConvert, 'INR')).toEqual([]);
    });

    it('handles a single direct debt', () => {
        const splits = [{
            id: 'split-1',
            user_id: 'user-b',
            amount: 500,
            transaction: { user_id: 'user-a', currency: 'INR' },
        }];

        const payments = simplifyDebts(splits, 'user-a', noConvert, 'INR');
        expect(payments).toHaveLength(1);
        expect(payments[0].from).toBe('user-b');
        expect(payments[0].to).toBe('user-a');
        expect(payments[0].amount).toBe(500);
        expect(payments[0].splitIds).toContain('split-1');
    });

    it('names current user as "You"', () => {
        const splits = [{
            id: 'split-1',
            user_id: 'me',
            amount: 200,
            transaction: { user_id: 'friend', currency: 'INR', payer_name: 'Friend' },
        }];

        const payments = simplifyDebts(splits, 'me', noConvert, 'INR');
        expect(payments[0].fromName).toBe('You');
        expect(payments[0].toName).toBe('Friend');
    });

    it('simplifies transitive debts (A→B→C becomes A→C)', () => {
        // A owes B 500, B owes C 500
        // Net: A = -500, B = 0, C = +500 → A pays C directly
        const splits = [
            {
                id: 'split-1',
                user_id: 'user-a',
                amount: 500,
                transaction: { user_id: 'user-b', currency: 'INR' },
            },
            {
                id: 'split-2',
                user_id: 'user-b',
                amount: 500,
                transaction: { user_id: 'user-c', currency: 'INR' },
            },
        ];

        const payments = simplifyDebts(splits, 'user-a', noConvert, 'INR');
        expect(payments).toHaveLength(1);
        expect(payments[0].from).toBe('user-a');
        expect(payments[0].to).toBe('user-c');
        expect(payments[0].amount).toBe(500);
        // transitive case — no direct edge, splitIds should be empty
        expect(payments[0].splitIds).toEqual([]);
    });

    it('handles multiple debtors to one creditor', () => {
        const splits = [
            {
                id: 'split-1',
                user_id: 'user-b',
                amount: 300,
                transaction: { user_id: 'user-a', currency: 'INR' },
            },
            {
                id: 'split-2',
                user_id: 'user-c',
                amount: 200,
                transaction: { user_id: 'user-a', currency: 'INR' },
            },
        ];

        const payments = simplifyDebts(splits, 'user-a', noConvert, 'INR');
        expect(payments).toHaveLength(2);
        const total = payments.reduce((sum, p) => sum + p.amount, 0);
        expect(total).toBeCloseTo(500);
    });

    it('skips self-debts (debtor === creditor)', () => {
        const splits = [{
            id: 'split-1',
            user_id: 'user-a',
            amount: 100,
            transaction: { user_id: 'user-a', currency: 'INR' }, // same user
        }];

        const payments = simplifyDebts(splits, 'user-a', noConvert, 'INR');
        expect(payments).toHaveLength(0);
    });

    it('skips splits with no transaction.user_id', () => {
        const splits = [{
            id: 'split-1',
            user_id: 'user-b',
            amount: 100,
            transaction: undefined,
        }];

        const payments = simplifyDebts(splits, 'user-a', noConvert, 'INR');
        expect(payments).toHaveLength(0);
    });

    it('applies currency conversion when currencies differ', () => {
        // 1 USD = 83 INR
        const convertAt83 = (amount: number, from: string, to?: string) => {
            if (from === 'USD') return amount * 83;
            return amount;
        };

        const splits = [{
            id: 'split-1',
            user_id: 'user-b',
            amount: 10, // 10 USD
            transaction: { user_id: 'user-a', currency: 'USD' },
        }];

        const payments = simplifyDebts(splits, 'user-a', convertAt83, 'INR');
        expect(payments[0].amount).toBeCloseTo(830);
    });

    it('rounds amounts to 2 decimal places', () => {
        const splits = [{
            id: 'split-1',
            user_id: 'user-b',
            amount: 100 / 3, // 33.333...
            transaction: { user_id: 'user-a', currency: 'INR' },
        }];

        const payments = simplifyDebts(splits, 'user-a', noConvert, 'INR');
        expect(payments[0].amount).toBe(33.33);
    });

    it('excludes splits below floating-point threshold (< 0.01)', () => {
        const splits = [{
            id: 'split-1',
            user_id: 'user-b',
            amount: 0.001,
            transaction: { user_id: 'user-a', currency: 'INR' },
        }];

        const payments = simplifyDebts(splits, 'user-a', noConvert, 'INR');
        expect(payments).toHaveLength(0);
    });

    it('accumulates multiple splits between same pair into one payment', () => {
        const splits = [
            {
                id: 'split-1',
                user_id: 'user-b',
                amount: 100,
                transaction: { user_id: 'user-a', currency: 'INR' },
            },
            {
                id: 'split-2',
                user_id: 'user-b',
                amount: 200,
                transaction: { user_id: 'user-a', currency: 'INR' },
            },
        ];

        const payments = simplifyDebts(splits, 'user-a', noConvert, 'INR');
        expect(payments).toHaveLength(1);
        expect(payments[0].amount).toBeCloseTo(300);
        expect(payments[0].splitIds).toContain('split-1');
        expect(payments[0].splitIds).toContain('split-2');
    });

    it('uses "Unknown" for users with no name info', () => {
        const splits = [{
            id: 'split-1',
            user_id: 'user-b',
            amount: 100,
            transaction: { user_id: 'user-c', currency: 'INR' }, // no payer_name
        }];

        const payments = simplifyDebts(splits, 'other-user', noConvert, 'INR');
        expect(payments[0].fromName).toBe('Unknown');
        expect(payments[0].toName).toBe('Unknown');
    });
});
