import 'server-only';

/** The civil date (YYYY-MM-DD) in `timezone` at instant `d`; UTC when the zone is missing or invalid. */
export function localDate(timezone: string | null | undefined, d: Date = new Date()): string {
    try {
        return new Intl.DateTimeFormat('en-CA', {
            timeZone: timezone || 'UTC',
            year: 'numeric', month: '2-digit', day: '2-digit',
        }).format(d);
    } catch {
        return d.toISOString().slice(0, 10);
    }
}

export function shiftDays(yyyymmdd: string, n: number): string {
    const d = new Date(yyyymmdd + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
}
