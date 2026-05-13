'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import type { Account, AccountType } from '@/types/account';

interface AccountsContextType {
    accounts: Account[];
    loading: boolean;
    primaryAccount: Account | null;
    /** Active filter selection for the dashboard etc. `null` = "all accounts". Persisted per-user in localStorage. */
    activeAccountId: string | null;
    setActiveAccountId: (id: string | null) => void;
    createAccount: (data: Partial<Account> & { name: string; type: AccountType; currency: string }) => Promise<Account | null>;
    updateAccount: (id: string, patch: Partial<Account>) => Promise<void>;
    archiveAccount: (id: string, archive: boolean) => Promise<void>;
    deleteAccount: (id: string) => Promise<void>;
    setPrimary: (id: string) => Promise<void>;
}

const AccountsContext = createContext<AccountsContextType | undefined>(undefined);

export function useAccounts() {
    const ctx = useContext(AccountsContext);
    if (!ctx) throw new Error('useAccounts must be used inside <AccountsProvider>');
    return ctx;
}

export function AccountsProvider({ children }: { children: React.ReactNode }) {
    const { userId, currency: defaultCurrency } = useUserPreferences();
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState<boolean>(!!userId);
    const [activeAccountId, setActiveAccountIdState] = useState<string | null>(null);
    const fetchGenRef = useRef(0);
    const ensuredDefaultForRef = useRef<string | null>(null);

    const fetchAccounts = useCallback(async () => {
        if (!userId) {
            setAccounts([]);
            setLoading(false);
            return;
        }
        const myGen = fetchGenRef.current;
        try {
            const { data, error } = await supabase
                .from('accounts')
                .select('*')
                .eq('user_id', userId)
                .order('archived_at', { ascending: true, nullsFirst: true })
                .order('is_primary', { ascending: false })
                .order('created_at', { ascending: true });
            if (fetchGenRef.current !== myGen) return;
            if (error) throw error;
            const list = (data as Account[]) ?? [];
            setAccounts(list);

            // Auto-create a default "Cash" account on first run so the user
            // always has at least one account to assign transactions to.
            const active = list.filter(a => !a.archived_at);
            if (active.length === 0 && ensuredDefaultForRef.current !== userId) {
                ensuredDefaultForRef.current = userId;
                const { data: created, error: createErr } = await supabase
                    .from('accounts')
                    .insert({
                        user_id: userId,
                        name: 'Cash',
                        type: 'cash',
                        currency: defaultCurrency || 'USD',
                        is_primary: true,
                    })
                    .select()
                    .single();
                if (!createErr && created && fetchGenRef.current === myGen) {
                    setAccounts(prev => [...prev, created as Account]);
                }
            }
        } catch (e) {
            console.error('[AccountsProvider] fetch failed', e);
        } finally {
            if (fetchGenRef.current === myGen) setLoading(false);
        }
    }, [userId, defaultCurrency]);

    // Restore last-active selection per user from localStorage.
    useEffect(() => {
        if (!userId || typeof window === 'undefined') {
            setActiveAccountIdState(null);
            return;
        }
        try {
            const stored = localStorage.getItem(`novira_active_account_${userId}`);
            setActiveAccountIdState(stored && stored !== 'all' ? stored : null);
        } catch {
            setActiveAccountIdState(null);
        }
    }, [userId]);

    const setActiveAccountId = useCallback((id: string | null) => {
        setActiveAccountIdState(id);
        if (typeof window === 'undefined' || !userId) return;
        try {
            if (id) localStorage.setItem(`novira_active_account_${userId}`, id);
            else localStorage.removeItem(`novira_active_account_${userId}`);
        } catch { /* storage disabled */ }
    }, [userId]);

    useEffect(() => {
        if (!userId) {
            setAccounts([]);
            setLoading(false);
            return;
        }
        fetchGenRef.current++;
        setLoading(true);
        fetchAccounts();

        const channel = supabase
            .channel(`accounts-${userId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'accounts', filter: `user_id=eq.${userId}` },
                () => { fetchAccounts(); },
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId, fetchAccounts]);

    const createAccount = useCallback(async (data: Partial<Account> & { name: string; type: AccountType; currency: string }) => {
        if (!userId) return null;
        // Keep opening_balance (default currency) in sync with the map so
        // back-compat readers see the same number.
        const map = data.opening_balances ?? {};
        const defaultOpening = data.opening_balance ?? map[data.currency] ?? 0;
        const finalMap: Record<string, number> = { ...map };
        if (defaultOpening !== 0 || Object.keys(finalMap).length === 0) {
            finalMap[data.currency] = defaultOpening;
        }
        const payload = {
            user_id: userId,
            name: data.name,
            type: data.type,
            currency: data.currency,
            opening_balance: defaultOpening,
            opening_balances: finalMap,
            credit_limit: data.type === 'credit_card' ? (data.credit_limit ?? null) : null,
            color: data.color ?? '#8A2BE2',
            icon: data.icon ?? 'wallet',
            is_primary: data.is_primary ?? false,
        };
        const { data: created, error } = await supabase
            .from('accounts')
            .insert(payload)
            .select()
            .single();
        if (error) throw error;
        const next = created as Account;
        setAccounts(prev => {
            const merged = [...prev, next];
            // If the new one is primary, demote any other primary in local state
            // so the optimistic UI doesn't show two primaries between the insert
            // and the realtime catch-up.
            if (next.is_primary) {
                return merged.map(a => a.id === next.id ? a : { ...a, is_primary: false });
            }
            return merged;
        });
        return next;
    }, [userId]);

    const updateAccount = useCallback(async (id: string, patch: Partial<Account>) => {
        // If either opening_balance or opening_balances is in the patch, keep
        // the default-currency entry consistent across both fields.
        const finalPatch: Partial<Account> = { ...patch };
        if (patch.opening_balances || patch.opening_balance !== undefined) {
            const existing = accounts.find(a => a.id === id);
            const currency = patch.currency ?? existing?.currency;
            const map = patch.opening_balances ?? existing?.opening_balances ?? {};
            const merged: Record<string, number> = { ...map };
            if (currency && patch.opening_balance !== undefined) {
                merged[currency] = patch.opening_balance;
            } else if (currency && merged[currency] === undefined && existing?.opening_balance !== undefined) {
                merged[currency] = existing.opening_balance;
            }
            finalPatch.opening_balances = merged;
            if (currency && finalPatch.opening_balance === undefined) {
                finalPatch.opening_balance = merged[currency] ?? 0;
            }
        }
        const { data, error } = await supabase
            .from('accounts')
            .update(finalPatch)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        setAccounts(prev => prev.map(a => a.id === id ? (data as Account) : a));
    }, [accounts]);

    const archiveAccount = useCallback(async (id: string, archive: boolean) => {
        const { data, error } = await supabase
            .from('accounts')
            .update({ archived_at: archive ? new Date().toISOString() : null, is_primary: false })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        setAccounts(prev => prev.map(a => a.id === id ? (data as Account) : a));
    }, []);

    const deleteAccount = useCallback(async (id: string) => {
        const { error } = await supabase.from('accounts').delete().eq('id', id);
        if (error) throw error;
        setAccounts(prev => prev.filter(a => a.id !== id));
        if (activeAccountId === id) setActiveAccountId(null);
    }, [activeAccountId, setActiveAccountId]);

    const setPrimary = useCallback(async (id: string) => {
        if (!userId) return;
        // Two-step under a single RLS-checked owner: demote others first to
        // satisfy the unique-primary index, then promote the target.
        const prev = [...accounts];
        setAccounts(curr => curr.map(a => ({ ...a, is_primary: a.id === id })));
        try {
            const { error: clearErr } = await supabase
                .from('accounts')
                .update({ is_primary: false })
                .eq('user_id', userId)
                .neq('id', id);
            if (clearErr) throw clearErr;
            const { error: setErr } = await supabase
                .from('accounts')
                .update({ is_primary: true })
                .eq('id', id);
            if (setErr) throw setErr;
        } catch (e) {
            setAccounts(prev);
            throw e;
        }
    }, [accounts, userId]);

    const primaryAccount = accounts.find(a => a.is_primary && !a.archived_at) ?? null;

    return (
        <AccountsContext.Provider
            value={{
                accounts,
                loading,
                primaryAccount,
                activeAccountId,
                setActiveAccountId,
                createAccount,
                updateAccount,
                archiveAccount,
                deleteAccount,
                setPrimary,
            }}
        >
            {children}
        </AccountsContext.Provider>
    );
}
