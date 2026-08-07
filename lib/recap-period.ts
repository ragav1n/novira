// Display helpers for recap period keys. A period is either `YYYY-MM` (a
// calendar month) or `YYYY-FY` (a full calendar year). Kept out of the recap
// components so both client and server can use them, and so they're testable
// without pulling React in.

export function isYearlyPeriod(period?: string | null): boolean {
    return !!period && period.endsWith('-FY');
}

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Label a recap period for display. Parses the key directly rather than going
 * through `new Date()` — `YYYY-FY` has no month, and date-fns `format` throws
 * a RangeError on the resulting Invalid Date.
 */
export function formatRecapPeriod(period?: string | null): string {
    if (!period) return '';
    const year = period.slice(0, 4);
    if (!/^\d{4}$/.test(year)) return period;
    if (isYearlyPeriod(period)) return `${year} · Full year`;
    const month = Number(period.slice(5, 7));
    if (!Number.isInteger(month) || month < 1 || month > 12) return period;
    return `${MONTH_NAMES[month - 1]} ${year}`;
}
