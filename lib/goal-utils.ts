import { differenceInCalendarDays, parseISO } from 'date-fns';
import type { SavingsGoal, SavingsDeposit } from '@/types/goal';

export type OnTrackStatus = 'ahead' | 'on-track' | 'behind' | 'unknown';
export type Milestone = 0 | 25 | 50 | 75 | 100;

const AVG_DAYS_PER_MONTH = 30.4375;

export function daysUntilDeadline(deadline: string | null | undefined): number | null {
    if (!deadline) return null;
    return differenceInCalendarDays(parseISO(deadline), new Date());
}

export function monthsRemaining(deadline: string | null | undefined): number | null {
    const days = daysUntilDeadline(deadline);
    if (days === null) return null;
    return Math.max(days, 0) / AVG_DAYS_PER_MONTH;
}

export function requiredMonthlyContribution(goal: Pick<SavingsGoal, 'target_amount' | 'current_amount' | 'deadline'>): number | null {
    const months = monthsRemaining(goal.deadline);
    if (months === null) return null;
    const remaining = Math.max(0, Number(goal.target_amount) - Number(goal.current_amount));
    if (remaining <= 0) return 0;
    if (months <= 0) return remaining;
    return remaining / months;
}

export function monthlyVelocity(deposits: SavingsDeposit[], windowDays = 90): number {
    if (!deposits.length) return 0;
    const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
    const recent = deposits.filter(d => parseISO(d.created_at).getTime() >= cutoff);
    if (!recent.length) return 0;
    const sum = recent.reduce((acc, d) => acc + Number(d.amount), 0);
    return (sum / windowDays) * AVG_DAYS_PER_MONTH;
}

export function projectedCompletionDate(
    goal: Pick<SavingsGoal, 'target_amount' | 'current_amount'>,
    velocity: number
): Date | null {
    const remaining = Number(goal.target_amount) - Number(goal.current_amount);
    if (remaining <= 0) return new Date();
    if (velocity <= 0) return null;
    const monthsToGo = remaining / velocity;
    return new Date(Date.now() + monthsToGo * AVG_DAYS_PER_MONTH * 24 * 60 * 60 * 1000);
}

export function onTrackStatus(required: number | null, velocity: number, hasHistory: boolean): OnTrackStatus {
    if (required === null) return 'unknown';
    if (required === 0) return 'on-track';
    if (!hasHistory) return 'unknown';
    if (velocity >= required * 1.05) return 'ahead';
    if (velocity >= required * 0.85) return 'on-track';
    return 'behind';
}

export function currentMilestone(progressPct: number): Milestone {
    if (progressPct >= 100) return 100;
    if (progressPct >= 75) return 75;
    if (progressPct >= 50) return 50;
    if (progressPct >= 25) return 25;
    return 0;
}

export function monthsDeltaVsDeadline(
    projected: Date | null,
    deadline: string | null | undefined
): number | null {
    if (!projected || !deadline) return null;
    return differenceInCalendarDays(projected, parseISO(deadline)) / AVG_DAYS_PER_MONTH;
}
