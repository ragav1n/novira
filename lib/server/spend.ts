import 'server-only';

/**
 * The payer's share of a transaction, in its own currency — the same rule as the
 * dashboard's `calculateUserShare` for the payer: the full amount, less whatever
 * the splits say other people owe. Push totals use this so a ₹3,000 dinner split
 * three ways counts as ₹1,000, as it does on the home screen.
 */
export function payerShare(tx: { amount: number | string; splits?: { amount: number | string }[] | null }): number {
    const othersOwe = (tx.splits || []).reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
    return Number(tx.amount) - othersOwe;
}
