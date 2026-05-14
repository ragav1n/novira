import { describe, it, expect } from 'vitest';
import { addDays, format } from 'date-fns';
import {
    monthsDeltaVsDeadline,
    projectedCompletionDate,
    monthlyVelocity,
    requiredMonthlyContribution,
    onTrackStatus,
} from '../goal-utils';

const isoDate = (d: Date) => format(d, 'yyyy-MM-dd');

describe('monthsDeltaVsDeadline', () => {
    it('returns null when projected is null', () => {
        expect(monthsDeltaVsDeadline(null, '2026-12-01')).toBeNull();
    });

    it('returns null when deadline is null/undefined', () => {
        expect(monthsDeltaVsDeadline(new Date(), null)).toBeNull();
        expect(monthsDeltaVsDeadline(new Date(), undefined)).toBeNull();
    });

    it('is negative when projected finishes before deadline (ahead)', () => {
        const deadline = isoDate(addDays(new Date(), 90));
        const projected = addDays(new Date(), 30);
        const delta = monthsDeltaVsDeadline(projected, deadline);
        expect(delta).not.toBeNull();
        expect(delta!).toBeLessThan(0);
    });

    it('is positive when projected finishes after deadline (behind)', () => {
        const deadline = isoDate(addDays(new Date(), 30));
        const projected = addDays(new Date(), 120);
        const delta = monthsDeltaVsDeadline(projected, deadline);
        expect(delta).not.toBeNull();
        expect(delta!).toBeGreaterThan(0);
    });

    it('is near zero when projected matches deadline', () => {
        const deadline = isoDate(addDays(new Date(), 60));
        const projected = addDays(new Date(), 60);
        const delta = monthsDeltaVsDeadline(projected, deadline);
        expect(Math.abs(delta!)).toBeLessThan(0.05);
    });
});

describe('projectedCompletionDate', () => {
    it('returns today when goal is already met', () => {
        const result = projectedCompletionDate({ target_amount: 100, current_amount: 100 }, 50);
        expect(result).not.toBeNull();
        expect(Math.abs((result!.getTime() - Date.now()) / 1000)).toBeLessThan(5);
    });

    it('returns null when velocity is zero', () => {
        expect(projectedCompletionDate({ target_amount: 100, current_amount: 0 }, 0)).toBeNull();
    });

    it('returns null when velocity is negative', () => {
        expect(projectedCompletionDate({ target_amount: 100, current_amount: 0 }, -10)).toBeNull();
    });

    it('projects future date proportional to remaining / velocity', () => {
        const result = projectedCompletionDate({ target_amount: 1200, current_amount: 0 }, 100);
        expect(result).not.toBeNull();
        const monthsAhead = (result!.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30.4375);
        expect(monthsAhead).toBeGreaterThan(11.5);
        expect(monthsAhead).toBeLessThan(12.5);
    });
});

describe('monthlyVelocity', () => {
    it('returns 0 for no deposits', () => {
        expect(monthlyVelocity([], 90)).toBe(0);
    });

    it('returns 0 when all deposits are outside the window', () => {
        const old = addDays(new Date(), -200).toISOString();
        const result = monthlyVelocity(
            [{ id: 'a', goal_id: 'g', user_id: 'u', amount: 100, currency: 'USD', created_at: old }],
            90
        );
        expect(result).toBe(0);
    });

    it('annualizes recent deposit total to monthly rate', () => {
        const recent = addDays(new Date(), -30).toISOString();
        const result = monthlyVelocity(
            [{ id: 'a', goal_id: 'g', user_id: 'u', amount: 300, currency: 'USD', created_at: recent }],
            90
        );
        expect(result).toBeGreaterThan(95);
        expect(result).toBeLessThan(110);
    });
});

describe('requiredMonthlyContribution', () => {
    it('returns null when no deadline', () => {
        expect(requiredMonthlyContribution({ target_amount: 100, current_amount: 0, deadline: null })).toBeNull();
    });

    it('returns 0 when target already met', () => {
        const deadline = isoDate(addDays(new Date(), 60));
        expect(requiredMonthlyContribution({ target_amount: 100, current_amount: 100, deadline })).toBe(0);
    });

    it('returns remaining amount when deadline is in the past', () => {
        const deadline = isoDate(addDays(new Date(), -10));
        expect(requiredMonthlyContribution({ target_amount: 100, current_amount: 25, deadline })).toBe(75);
    });

    it('scales with months remaining', () => {
        const deadline = isoDate(addDays(new Date(), 90));
        const r = requiredMonthlyContribution({ target_amount: 600, current_amount: 0, deadline });
        expect(r).not.toBeNull();
        expect(r!).toBeGreaterThan(195);
        expect(r!).toBeLessThan(205);
    });
});

describe('onTrackStatus', () => {
    it('is unknown when required is null', () => {
        expect(onTrackStatus(null, 100, true)).toBe('unknown');
    });

    it('is on-track when required is 0', () => {
        expect(onTrackStatus(0, 0, false)).toBe('on-track');
    });

    it('is unknown when no history', () => {
        expect(onTrackStatus(100, 0, false)).toBe('unknown');
    });

    it('is ahead when velocity >= required * 1.05', () => {
        expect(onTrackStatus(100, 110, true)).toBe('ahead');
    });

    it('is on-track when velocity is within 85%-105% of required', () => {
        expect(onTrackStatus(100, 90, true)).toBe('on-track');
    });

    it('is behind when velocity < required * 0.85', () => {
        expect(onTrackStatus(100, 50, true)).toBe('behind');
    });
});
