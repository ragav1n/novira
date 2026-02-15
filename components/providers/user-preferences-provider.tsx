'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type Currency = 'USD' | 'EUR' | 'INR';

const DEFAULT_BUDGETS: Record<Currency, number> = {
    USD: 1500,
    EUR: 1000,
    INR: 100000
};

interface UserPreferencesContextType {
    currency: Currency;
    setCurrency: (currency: Currency) => Promise<void>;
    formatCurrency: (amount: number, currencyOverride?: string) => string;
    refreshPreferences: () => Promise<void>;
    convertAmount: (amount: number, fromCurrency: string) => number;
    budgetAlertsEnabled: boolean;
    setBudgetAlertsEnabled: (enabled: boolean) => Promise<void>;
    monthlyBudget: number;
    setMonthlyBudget: (budget: number) => Promise<void>;
    userId: string | null;
}

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined);

export function UserPreferencesProvider({ children }: { children: React.ReactNode }) {
    const [currency, setCurrencyState] = useState<Currency>('USD');
    const [budgetAlertsEnabled, setBudgetAlertsEnabledState] = useState(false);
    const [monthlyBudget, setMonthlyBudgetState] = useState(DEFAULT_BUDGETS.USD);
    const [budgets, setBudgets] = useState<Record<string, number>>({});
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);
    const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});


    // Fetch Exchange Rates when currency changes
    useEffect(() => {
        const fetchRates = async () => {
            try {
                // api.frankfurter.dev requires the base currency to be different from the target or it returns empty/error sometimes for same base
                // simpler: just fetch latest with base = currency
                const response = await fetch(`https://api.frankfurter.dev/v1/latest?base=${currency}`);
                if (!response.ok) throw new Error('Failed to fetch rates');
                const data = await response.json();
                setExchangeRates(data.rates);
            } catch (error) {
                console.error('Error fetching exchange rates:', error);
            }
        };

        fetchRates();
    }, [currency]);

    const refreshPreferences = async (currentSession?: any) => {
        try {
            let session = currentSession;
            if (!session) {
                const { data } = await supabase.auth.getSession();
                session = data.session;
            }

            const user = session?.user;
            if (!user) return;
            setUserId(user.id);

            const { data, error } = await supabase
                .from('profiles')
                .select('currency, budget_alerts, monthly_budget, budgets')
                .eq('id', user.id)
                .single();

            if (data) {
                if (data.currency) setCurrencyState(data.currency as Currency);
                if (data.budget_alerts !== null) setBudgetAlertsEnabledState(data.budget_alerts);
                if (data.monthly_budget) setMonthlyBudgetState(data.monthly_budget);
                if (data.budgets) setBudgets(data.budgets as Record<string, number>);
            }
            if (error && error.code !== 'PGRST116') {
                console.error('Error fetching preferences:', error);
            }
        } catch (error) {
            console.error('Error fetching preferences:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchedRef = React.useRef(false);

    useEffect(() => {
        if (fetchedRef.current) return;
        fetchedRef.current = true;

        refreshPreferences();

        // Subscribe to auth state changes
        const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (session?.user) {
                // Determine if we should refresh. 
                // INITIAL_SESSION: happens on mount if session exists.
                // SIGNED_IN: happens on login.
                // TOKEN_REFRESHED: happens periodically.
                if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                    setUserId(session.user.id);
                    refreshPreferences(session);
                }
            }

            if (event === 'SIGNED_OUT') {
                setUserId(null);
                setCurrencyState('USD');
                setBudgetAlertsEnabledState(false);
                setMonthlyBudgetState(DEFAULT_BUDGETS.USD);
                setBudgets({});
            }
        });

        // Subscribe to realtime changes for instant updates across tabs/components
        const channel = supabase
            .channel('schema-db-changes')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                },
                (payload) => {
                    if (payload.new) {
                        const newData = payload.new as any;
                        if (newData.currency) setCurrencyState(newData.currency as Currency);
                        if (newData.budget_alerts !== undefined) setBudgetAlertsEnabledState(newData.budget_alerts);
                        if (newData.monthly_budget) setMonthlyBudgetState(newData.monthly_budget);
                        if (newData.budgets) setBudgets(newData.budgets as Record<string, number>);
                    }
                }
            )
            .subscribe();

        return () => {
            authSubscription.unsubscribe();
            supabase.removeChannel(channel);
        };
    }, []);

    const setCurrency = async (newCurrency: Currency) => {
        if (newCurrency === currency) return;

        // Use stored budget for the currency if it exists, otherwise use default
        const newBudget = budgets[newCurrency] || DEFAULT_BUDGETS[newCurrency];

        // Optimistic update
        setCurrencyState(newCurrency);
        setMonthlyBudgetState(newBudget);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user) return;

            const { error } = await supabase
                .from('profiles')
                .update({
                    currency: newCurrency,
                    monthly_budget: newBudget
                })
                .eq('id', user.id);

            if (error) throw error;

            toast.success(`Currency switched to ${newCurrency}. Budget set to ${formatCurrency(newBudget, newCurrency)}`);
        } catch (error) {
            console.error('Error updating currency:', error);
            toast.error('Failed to update currency preference');
            refreshPreferences();
        }
    };

    const setBudgetAlertsEnabled = async (enabled: boolean) => {
        // Optimistic update
        setBudgetAlertsEnabledState(enabled);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user) return;

            const { error } = await supabase
                .from('profiles')
                .update({ budget_alerts: enabled })
                .eq('id', user.id);

            if (error) throw error;
        } catch (error) {
            console.error('Error updating budget alerts:', error);
            toast.error('Failed to update budget alert preference');
            refreshPreferences();
        }
    };

    const setMonthlyBudget = async (budget: number) => {
        // Update local state for immediate feedback
        const updatedBudgets = { ...budgets, [currency]: budget };

        // Optimistic update
        setMonthlyBudgetState(budget);
        setBudgets(updatedBudgets);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user) return;

            const { error } = await supabase
                .from('profiles')
                .update({
                    monthly_budget: budget,
                    budgets: updatedBudgets
                })
                .eq('id', user.id);

            if (error) throw error;
        } catch (error) {
            console.error('Error updating budget:', error);
            toast.error('Failed to update budget');
            refreshPreferences();
        }
    };

    const formatCurrency = (amount: number, currencyOverride?: string) => {
        const targetCurrency = currencyOverride || currency;

        // Custom formatting for Euro to ensure prefix
        if (targetCurrency === 'EUR') {
            return new Intl.NumberFormat('en-IE', {
                style: 'currency',
                currency: 'EUR',
            }).format(amount);
        }

        // Custom formatting for INR
        if (targetCurrency === 'INR') {
            return new Intl.NumberFormat('en-IN', {
                style: 'currency',
                currency: 'INR',
                maximumFractionDigits: 0
            }).format(amount);
        }

        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: targetCurrency,
        }).format(amount);
    };

    const convertAmount = (amount: number, fromCurrency: string): number => {
        if (!fromCurrency || fromCurrency === currency) return amount;

        const rate = exchangeRates[fromCurrency];
        if (rate) {
            return amount / rate;
        }

        return amount;
    };

    return (
        <UserPreferencesContext.Provider value={{
            currency,
            setCurrency,
            formatCurrency,
            refreshPreferences,
            convertAmount,
            budgetAlertsEnabled,
            setBudgetAlertsEnabled,
            monthlyBudget,
            setMonthlyBudget,
            userId
        }}>
            {children}
        </UserPreferencesContext.Provider>
    );
}

export function useUserPreferences() {
    const context = useContext(UserPreferencesContext);
    if (context === undefined) {
        throw new Error('useUserPreferences must be used within a UserPreferencesProvider');
    }
    return context;
}
