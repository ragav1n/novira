// Weighted run-rate projection shared between the dashboard and analytics views.
// Blends the last-7-day rate (0.6) with the month-to-date rate (0.4) so the
// projection adapts to recent spending shifts without overreacting to a single
// outlier day.

export interface RunRateInput {
    totalSpent: number;
    recentSpent: number;
    daysIntoMonth: number;
    daysInMonth: number;
    budget: number;
}

export interface RunRateOutput {
    last7DayRate: number;
    mtdRate: number;
    dailyAverage: number;
    daysRemaining: number;
    projectedSpend: number;
    isExceeding: boolean;
    percentOfBudget: number | null;
    overshoot: number;
}

export function computeWeightedRunRate({
    totalSpent,
    recentSpent,
    daysIntoMonth,
    daysInMonth,
    budget,
}: RunRateInput): RunRateOutput {
    const recentDays = Math.min(7, Math.max(0, daysIntoMonth));
    const last7DayRate = recentDays > 0 ? recentSpent / recentDays : 0;
    const mtdRate = daysIntoMonth > 0 ? totalSpent / daysIntoMonth : 0;
    const dailyAverage = 0.6 * last7DayRate + 0.4 * mtdRate;
    const daysRemaining = Math.max(0, daysInMonth - daysIntoMonth);
    const projectedSpend = totalSpent + daysRemaining * dailyAverage;
    const hasBudget = budget > 0;
    return {
        last7DayRate,
        mtdRate,
        dailyAverage,
        daysRemaining,
        projectedSpend,
        isExceeding: hasBudget && projectedSpend > budget,
        percentOfBudget: hasBudget ? (projectedSpend / budget) * 100 : null,
        overshoot: hasBudget ? Math.max(0, projectedSpend - budget) : 0,
    };
}

// Prescriptive "safe to spend per day" for the rest of the month. Unlike the
// run-rate projection (which extrapolates past spending), this sets aside the
// money already committed to upcoming bills, then spreads what's left evenly
// across the remaining days — telling the user what they can actually spend.

export interface SafeToSpendInput {
    remaining: number;          // displayBudget - totalSpent
    committedUpcoming: number;  // upcoming recurring bills due this month, in display currency
    daysInMonth: number;
    currentDayOfMonth: number;
}

export interface SafeToSpendOutput {
    daysRemaining: number;      // includes today
    committedUpcoming: number;
    afterCommitments: number;   // remaining - committedUpcoming (can be negative)
    dailyAllowance: number;     // max(0, afterCommitments / daysRemaining)
    billsExceedBudget: boolean; // afterCommitments < 0
}

export function computeSafeToSpend({
    remaining,
    committedUpcoming,
    daysInMonth,
    currentDayOfMonth,
}: SafeToSpendInput): SafeToSpendOutput {
    const daysRemaining = Math.max(1, daysInMonth - currentDayOfMonth + 1);
    const afterCommitments = remaining - committedUpcoming;
    return {
        daysRemaining,
        committedUpcoming,
        afterCommitments,
        dailyAllowance: Math.max(0, afterCommitments / daysRemaining),
        billsExceedBudget: afterCommitments < 0,
    };
}
