// Single source of truth for "what is this transaction worth in currency X".
//
// Five call sites used to reimplement this ladder inline and disagreed with each
// other, so the same transaction could total differently on the dashboard, in
// analytics, inside a bucket, and in an export. Everything client-side now routes
// through resolveAmountIn.
//
// The `app/api/cron/*` routes deliberately keep their own inline handling: they run
// server-side with no live-rate access and simply skip rows they can't convert.

export interface AmountResolvable {
    amount: number | string;
    currency?: string | null;
    base_currency?: string | null;
    exchange_rate?: number | null;
    converted_amount?: number | null;
}

export interface ResolvedAmount {
    amount: number;
    /** True when a live/session rate was used rather than a rate stored on the row. */
    usedLiveRate: boolean;
}

/**
 * An `exchange_rate` of exactly 1 on a cross-currency row means the FX lookup
 * failed, not that the pair trades at parity — `TransactionService.getExchangeRate`
 * returns `rate || 1` as its fallback. Trusting it would silently price a foreign
 * purchase at 1:1.
 */
function storedRateIsUsable(rate: number | null | undefined): rate is number {
    return typeof rate === 'number' && Number.isFinite(rate) && rate > 0 && rate !== 1;
}

/**
 * Resolve `share` of `tx` into `targetCurrency`.
 *
 * `share` is the caller's slice of the transaction (the full amount for an
 * unsplit row, the user's portion for a split one) expressed in `tx.currency`.
 *
 * Resolution order, most to least exact:
 *   1. tx.currency === target                          → share unchanged
 *   2. base_currency === target, converted_amount set   → scaled by share/amount
 *   3. base_currency === target, exchange_rate usable   → share * exchange_rate
 *   4. live rate via `convert`
 *
 * Tiers 2 and 3 use the rate captured when the transaction was written, so
 * historical spend doesn't shift as today's rates move.
 */
export function resolveAmountIn(
    tx: AmountResolvable,
    share: number,
    targetCurrency: string,
    convert: (amount: number, from: string, to?: string) => number,
): ResolvedAmount {
    const target = (targetCurrency || 'USD').toUpperCase();
    const txCurr = (tx.currency || target).toUpperCase();

    if (txCurr === target) return { amount: share, usedLiveRate: false };

    const baseCurr = (tx.base_currency || '').toUpperCase();
    if (baseCurr === target) {
        // converted_amount covers the whole transaction; scale it to this share.
        const full = Number(tx.amount);
        const converted = tx.converted_amount;
        if (typeof converted === 'number' && Number.isFinite(converted) && Number.isFinite(full) && full !== 0) {
            const scaled = converted * (share / full);
            // A stored converted_amount that mirrors the amount exactly is the same
            // failed-lookup signal as exchange_rate === 1 — fall through to a live rate.
            if (scaled !== share) return { amount: scaled, usedLiveRate: false };
        }
        if (storedRateIsUsable(tx.exchange_rate)) {
            return { amount: share * tx.exchange_rate, usedLiveRate: false };
        }
    }

    return { amount: convert(share, txCurr, target), usedLiveRate: true };
}
