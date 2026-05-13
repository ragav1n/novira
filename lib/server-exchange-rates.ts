import 'server-only';

// Server-side exchange rate fetcher.
// Same upstream as /api/exchange-rate (v6.exchangerate-api.com latest endpoint),
// but callable from cron routes and other server code without an auth context.
// Per-process LRU-style cache to avoid hammering the upstream during a single
// cron invocation that scans many users.

interface CacheEntry {
    rates: Record<string, number>;
    expires: number;
}

const cache = new Map<string, CacheEntry>();
const TTL_MS = 60 * 60 * 1000; // 1 hour — recap math doesn't need sub-hour freshness

async function fetchRatesFromBase(base: string): Promise<Record<string, number> | null> {
    const normalized = base.toUpperCase();
    const cached = cache.get(normalized);
    if (cached && cached.expires > Date.now()) return cached.rates;

    const apiKey = process.env.EXCHANGERATE_API_KEY ?? process.env.NEXT_PUBLIC_EXCHANGERATE_API_KEY;
    if (!apiKey) return null;
    try {
        const res = await fetch(`https://v6.exchangerate-api.com/v6/${apiKey}/latest/${normalized}`, {
            cache: 'no-store',
        });
        if (!res.ok) return null;
        const body = await res.json() as { conversion_rates?: Record<string, number> };
        if (!body.conversion_rates) return null;
        cache.set(normalized, {
            rates: body.conversion_rates,
            expires: Date.now() + TTL_MS,
        });
        return body.conversion_rates;
    } catch (err) {
        console.error('[server-exchange-rates] fetch failed', err);
        return null;
    }
}

/** Single pair lookup. Returns null if rates aren't available. */
export async function getServerRate(from: string, to: string): Promise<number | null> {
    const f = from.toUpperCase();
    const t = to.toUpperCase();
    if (f === t) return 1;
    const rates = await fetchRatesFromBase(f);
    if (!rates) return null;
    const rate = rates[t];
    return typeof rate === 'number' ? rate : null;
}

/**
 * Batch lookup. Useful when a recap / insights snapshot needs many distinct
 * conversions to the same target — one fetch per source currency.
 */
export async function getServerRatesMap(
    pairs: Array<{ from: string; to: string }>,
): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    const uniqueFroms = new Set(pairs.map(p => p.from.toUpperCase()));
    // Prime the cache once per unique source currency.
    await Promise.all([...uniqueFroms].map(from => fetchRatesFromBase(from)));
    for (const { from, to } of pairs) {
        const rate = await getServerRate(from, to);
        if (rate !== null) {
            result.set(`${from.toUpperCase()}->${to.toUpperCase()}`, rate);
        }
    }
    return result;
}
