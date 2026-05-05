/**
 * Quiet-hours check for cron-triggered push notifications.
 *
 * The user picks an hour-window in their local timezone (e.g. 22 to 7). Cron
 * jobs run in UTC, so before sending we convert "now" into the user's timezone
 * and check if the hour falls inside the window. The window may wrap midnight
 * (start > end), in which case the inside-range check has two valid arms.
 */
export function isInQuietHours(
    timezone: string | null | undefined,
    start: number | null | undefined,
    end: number | null | undefined,
    now: Date = new Date(),
): boolean {
    if (start == null || end == null) return false;
    if (start === end) return false;

    const hour = currentHourInTimezone(timezone || 'UTC', now);
    if (hour == null) return false;

    if (start < end) {
        // e.g. 13 to 18: inside if 13 <= hour < 18
        return hour >= start && hour < end;
    }
    // wrap-around, e.g. 22 to 7: inside if hour >= 22 OR hour < 7
    return hour >= start || hour < end;
}

function currentHourInTimezone(timeZone: string, now: Date): number | null {
    try {
        const fmt = new Intl.DateTimeFormat('en-US', {
            timeZone,
            hour: 'numeric',
            hour12: false,
        });
        const parts = fmt.formatToParts(now);
        const hourPart = parts.find((p) => p.type === 'hour')?.value;
        if (!hourPart) return null;
        const h = parseInt(hourPart, 10);
        if (isNaN(h)) return null;
        // Intl returns "24" for midnight in some locales; normalize.
        return h === 24 ? 0 : h;
    } catch {
        return null;
    }
}
