import type { Account } from '@/types/account';

export interface NetWorthSummary {
    /** Total assets minus total liabilities, in the user's base currency. */
    netWorth: number;
    /** Sum of positive account balances (cash, wallets, positive-balance cards). */
    totalAssets: number;
    /** Sum of debts as a positive magnitude (e.g. credit-card balances owed). */
    totalLiabilities: number;
    /** How many accounts actually contributed a balance (see isTrackedForNetWorth). */
    trackedCount: number;
}

/**
 * Whether an account contributes a meaningful current balance to net worth.
 *
 * Cash / checking / savings accounts are framed as "spent" in the UI because
 * most users never set their opening balance — so summing opening+activity for
 * them would surface a misleading negative (just the inverse of what was spent).
 * Only count accounts that genuinely carry a balance:
 *   - credit cards (debt) and digital wallets (held funds) always do
 *   - any account where the user set a non-zero opening balance
 */
export function isTrackedForNetWorth(account: Account): boolean {
    if (account.archived_at) return false;
    if (account.type === 'credit_card' || account.type === 'digital_wallet') return true;
    if (Math.abs(account.opening_balance) >= 0.005) return true;
    const map = account.opening_balances ?? {};
    return Object.values(map).some(v => Math.abs(Number(v)) >= 0.005);
}

/**
 * The account's opening balance expressed in the user's base currency, summed
 * across every currency leg. Mirrors the per-currency opening resolution used
 * by the Accounts settings section.
 */
export function openingInBase(
    account: Account,
    convertAmount: (amount: number, fromCurrency: string, toCurrency?: string) => number,
    baseCurrency: string,
): number {
    const openings: Record<string, number> = (account.opening_balances && Object.keys(account.opening_balances).length > 0)
        ? account.opening_balances
        : (Math.abs(account.opening_balance) >= 0.005 ? { [account.currency]: account.opening_balance } : {});
    return Object.entries(openings)
        .reduce((acc, [curr, val]) => acc + convertAmount(Number(val), curr, baseCurrency), 0);
}

/**
 * Aggregate net worth across tracked accounts. `activityByAccount` is the
 * signed transaction activity per account, already converted to base currency
 * (income positive, expenses negative) — exactly what compute_account_balances
 * yields once summed per account.
 */
export function computeNetWorth(
    accounts: Account[],
    activityByAccount: Record<string, number>,
    convertAmount: (amount: number, fromCurrency: string, toCurrency?: string) => number,
    baseCurrency: string,
): NetWorthSummary {
    let totalAssets = 0;
    let totalLiabilities = 0;
    let trackedCount = 0;
    for (const a of accounts) {
        if (!isTrackedForNetWorth(a)) continue;
        const balance = openingInBase(a, convertAmount, baseCurrency) + (activityByAccount[a.id] ?? 0);
        trackedCount++;
        if (balance >= 0) totalAssets += balance;
        else totalLiabilities += -balance;
    }
    return { netWorth: totalAssets - totalLiabilities, totalAssets, totalLiabilities, trackedCount };
}
