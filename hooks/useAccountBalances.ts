import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAccounts } from '@/components/providers/accounts-provider';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { computeNetWorth, type NetWorthSummary } from '@/lib/account-balances';

interface BalanceRow {
    account_id: string;
    tx_currency: string;
    activity_native: number;
    spent_native: number;
}

/**
 * Net-worth summary across the user's accounts, built from the
 * compute_account_balances RPC (the same source the Accounts settings section
 * uses) so the two never disagree. Refreshes on account changes and whenever a
 * transaction is added (the `novira:expense-added` event).
 */
export function useAccountBalances(): NetWorthSummary & { loading: boolean; refetch: () => void } {
    const { accounts } = useAccounts();
    const { userId, currency: baseCurrency, convertAmount } = useUserPreferences();
    // Signed activity (income positive, expenses negative) per account, in base currency.
    const [activity, setActivity] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);

    const fetchBalances = useCallback(async () => {
        if (!userId) {
            setActivity({});
            setLoading(false);
            return;
        }
        const { data, error } = await supabase.rpc('compute_account_balances', { p_user_id: userId });
        if (error) {
            console.error('[useAccountBalances] balances failed', error);
            setLoading(false);
            return;
        }
        const totals: Record<string, number> = {};
        for (const row of (data ?? []) as BalanceRow[]) {
            const currency = row.tx_currency || baseCurrency;
            totals[row.account_id] = (totals[row.account_id] ?? 0)
                + convertAmount(Number(row.activity_native), currency, baseCurrency);
        }
        setActivity(totals);
        setLoading(false);
    }, [userId, baseCurrency, convertAmount]);

    useEffect(() => { fetchBalances(); }, [fetchBalances, accounts]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const onChange = () => fetchBalances();
        window.addEventListener('novira:expense-added', onChange);
        return () => window.removeEventListener('novira:expense-added', onChange);
    }, [fetchBalances]);

    const summary = useMemo(
        () => computeNetWorth(accounts, activity, convertAmount, baseCurrency),
        [accounts, activity, convertAmount, baseCurrency],
    );

    return { ...summary, loading, refetch: fetchBalances };
}
