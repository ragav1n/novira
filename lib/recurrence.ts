export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

/**
 * The next occurrence after `from`.
 *
 * Monthly is the whole reason this is a shared function: plain `setMonth` rolls
 * short months over (Jan 31 + 1 month lands on Mar 3), so it steps to the 1st,
 * advances, then clamps to the intended day. The add-expense form had a second,
 * naive copy of this for its "Next bill" preview, which promised the user a date
 * the stored next_occurrence never matched.
 */
export function nextOccurrence(from: Date, frequency: RecurrenceFrequency): Date {
    const intendedDay = from.getDate();
    const next = new Date(from);
    if (frequency === 'daily') {
        next.setDate(next.getDate() + 1);
    } else if (frequency === 'weekly') {
        next.setDate(next.getDate() + 7);
    } else if (frequency === 'monthly') {
        next.setDate(1);
        next.setMonth(next.getMonth() + 1);
        const lastDayOfMonth = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
        next.setDate(Math.min(intendedDay, lastDayOfMonth));
    } else if (frequency === 'yearly') {
        next.setFullYear(next.getFullYear() + 1);
    }
    return next;
}
