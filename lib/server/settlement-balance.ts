import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface SettlementBalance {
    /** Sum of unpaid splits where the user is the creditor (transaction.user_id = userId). */
    owedToMe: number;
    /** Sum of unpaid splits where the user is the debtor (splits.user_id = userId). */
    iOwe: number;
    /** Count of unpaid splits the user is a party to (debtor or creditor). */
    unpaidCount: number;
    /** Same counts, restricted to splits older than `staleAfterDays` (default 3). */
    staleOwedToMe: number;
    staleIOwe: number;
    staleCount: number;
    /** Dominant currency on the unpaid splits — picked as the most frequent (count). */
    currency: string;
    /**
     * True when the unpaid splits span more than one currency. Summed amounts
     * across currencies are meaningless, so callers should show counts (not a
     * single-currency total) when this is set.
     */
    mixedCurrency: boolean;
}

interface DebtRow {
    amount: number;
    created_at: string;
    transaction: { currency: string | null } | { currency: string | null }[] | null;
}

interface CreditRow {
    amount: number;
    created_at: string;
    transaction: { currency: string | null } | { currency: string | null }[] | null;
}

function txCurrency(row: { transaction: DebtRow['transaction'] }, fallback: string): string {
    const tx = Array.isArray(row.transaction) ? row.transaction[0] : row.transaction;
    return (tx?.currency || fallback).toUpperCase();
}

/**
 * Compute the user's outstanding split balance. Amounts are summed in the
 * row's source currency (no FX conversion server-side — the dominant currency
 * is reported back so the caller can format consistently). For users who
 * routinely transact across currencies this is intentionally approximate; the
 * notification copy just frames it as "$X across N splits".
 */
export async function loadSettlementBalance(
    supabase: SupabaseClient,
    userId: string,
    profileCurrency: string,
    staleAfterDays: number = 3,
    now: Date = new Date(),
): Promise<SettlementBalance> {
    const baseCcy = (profileCurrency || 'USD').toUpperCase();
    const staleCutoff = new Date(now.getTime() - staleAfterDays * 24 * 60 * 60 * 1000).toISOString();

    const [debtsResult, creditsResult] = await Promise.all([
        supabase
            .from('splits')
            .select('amount, created_at, transaction:transactions!inner(currency, user_id)')
            .eq('user_id', userId)
            .eq('is_paid', false)
            .returns<DebtRow[]>(),
        supabase
            .from('splits')
            .select('amount, created_at, transaction:transactions!inner(currency, user_id)')
            .eq('transaction.user_id', userId)
            .eq('is_paid', false)
            .neq('user_id', userId)
            .returns<CreditRow[]>(),
    ]);

    const debts = debtsResult.data || [];
    const credits = creditsResult.data || [];

    let iOwe = 0, staleIOwe = 0, staleIOweCount = 0;
    let owedToMe = 0, staleOwedToMe = 0, staleOwedToMeCount = 0;
    const currencyCounts = new Map<string, number>();

    for (const row of debts) {
        const amt = Number(row.amount) || 0;
        iOwe += amt;
        const ccy = txCurrency(row, baseCcy);
        currencyCounts.set(ccy, (currencyCounts.get(ccy) || 0) + 1);
        if (row.created_at < staleCutoff) {
            staleIOwe += amt;
            staleIOweCount += 1;
        }
    }
    for (const row of credits) {
        const amt = Number(row.amount) || 0;
        owedToMe += amt;
        const ccy = txCurrency(row, baseCcy);
        currencyCounts.set(ccy, (currencyCounts.get(ccy) || 0) + 1);
        if (row.created_at < staleCutoff) {
            staleOwedToMe += amt;
            staleOwedToMeCount += 1;
        }
    }

    let currency = baseCcy;
    let topCount = 0;
    for (const [c, n] of currencyCounts.entries()) {
        if (n > topCount) { currency = c; topCount = n; }
    }

    return {
        owedToMe,
        iOwe,
        unpaidCount: debts.length + credits.length,
        staleOwedToMe,
        staleIOwe,
        staleCount: staleIOweCount + staleOwedToMeCount,
        currency,
        mixedCurrency: currencyCounts.size > 1,
    };
}
