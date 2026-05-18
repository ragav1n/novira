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
