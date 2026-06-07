import { describe, it, expect } from 'vitest';
import { computeSafeToSpend } from '../utils/run-rate';

describe('computeSafeToSpend', () => {
    it('spreads remaining-minus-bills across the days left (incl. today)', () => {
        // Day 20 of a 30-day month → 11 days left (20..30 inclusive).
        const r = computeSafeToSpend({
            remaining: 330,
            committedUpcoming: 110,
            daysInMonth: 30,
            currentDayOfMonth: 20,
        });
        expect(r.daysRemaining).toBe(11);
        expect(r.afterCommitments).toBe(220);
        expect(r.dailyAllowance).toBe(20);
        expect(r.billsExceedBudget).toBe(false);
    });

    it('flags when upcoming bills exceed the remaining budget', () => {
        const r = computeSafeToSpend({
            remaining: 50,
            committedUpcoming: 200,
            daysInMonth: 31,
            currentDayOfMonth: 10,
        });
        expect(r.billsExceedBudget).toBe(true);
        expect(r.afterCommitments).toBe(-150);
        expect(r.dailyAllowance).toBe(0); // never negative
    });

    it('floors daysRemaining at 1 on the last day of the month', () => {
        const r = computeSafeToSpend({
            remaining: 90,
            committedUpcoming: 0,
            daysInMonth: 30,
            currentDayOfMonth: 30,
        });
        expect(r.daysRemaining).toBe(1);
        expect(r.dailyAllowance).toBe(90);
    });

    it('handles no committed bills', () => {
        const r = computeSafeToSpend({
            remaining: 100,
            committedUpcoming: 0,
            daysInMonth: 30,
            currentDayOfMonth: 21,
        });
        expect(r.daysRemaining).toBe(10);
        expect(r.committedUpcoming).toBe(0);
        expect(r.dailyAllowance).toBe(10);
    });
});
