import 'server-only';
import { getServerRatesMap } from '@/lib/server-exchange-rates';
import { resolveAmountIn, type AmountResolvable } from '@/lib/utils/resolve-amount';

/** Converts `share` (default: the full amount) of `tx` into `target`; null when no rate is known. */
export type ToCurrency = (tx: AmountResolvable, target: string, share?: number) => number | null;

/**
 * Builds a converter for push/cron copy that follows the same ladder as the app
 * (`resolveAmountIn`): same currency → stored conversion into `target` → live rate.
 *
 * Crons used to add a foreign row at face value whenever its stored rate pointed
 * at a different base (it was entered before the user changed currency, or the
 * FX lookup failed at write time), so ₹479 went out as "$479". A row with no
 * usable rate now converts to null and the caller drops it — a total that is
 * missing one row is less wrong than one labelled in the wrong currency.
 *
 * `rows` pairs each transaction with the currency it will be converted into, so
 * live rates are fetched once per source currency up front.
 */
export async function loadConverter(
    rows: Array<{ tx: AmountResolvable; target: string | null | undefined }>,
): Promise<ToCurrency> {
    const pairs = new Map<string, { from: string; to: string }>();
    for (const { tx, target } of rows) {
        const to = (target || 'USD').toUpperCase();
        const from = (tx.currency || to).toUpperCase();
        if (from !== to) pairs.set(`${from}->${to}`, { from, to });
    }
    const rates = pairs.size ? await getServerRatesMap([...pairs.values()]) : new Map<string, number>();
    const missing = new Set<string>();

    return (tx, target, share = Number(tx.amount)) => {
        const { amount } = resolveAmountIn(tx, share, target, (amt, from, to) => {
            const key = `${from.toUpperCase()}->${(to || target).toUpperCase()}`;
            const rate = rates.get(key);
            if (rate === undefined) {
                if (!missing.has(key)) {
                    missing.add(key);
                    console.error(`[fx] no rate for ${key}; row left out of the notification total`);
                }
                return NaN;
            }
            return amt * rate;
        });
        return Number.isFinite(amount) ? amount : null;
    };
}
