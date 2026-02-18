'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { User, Session } from '@supabase/supabase-js';

type Currency = 'USD' | 'EUR' | 'INR';

const DEFAULT_BUDGETS: Record<Currency, number> = {
    USD: 1500,
    EUR: 1000,
    INR: 100000
};

interface UserPreferencesContextType {
    // Auth State
    user: User | null;
    userId: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;

    // Preferences
    currency: Currency;
    setCurrency: (currency: Currency) => Promise<void>;
    formatCurrency: (amount: number, currencyOverride?: string) => string;
    refreshPreferences: () => Promise<void>;
    convertAmount: (amount: number, fromCurrency: string) => number;
    budgetAlertsEnabled: boolean;
    setBudgetAlertsEnabled: (enabled: boolean) => Promise<void>;
    monthlyBudget: number;
    setMonthlyBudget: (budget: number) => Promise<void>;
    avatarUrl: string | null;
    setAvatarUrl: (url: string | null) => void;
    isNavigating: boolean;
    setIsNavigating: (isNavigating: boolean) => void;
}

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined);

export function UserPreferencesProvider({ children }: { children: React.ReactNode }) {
    // Auth State
    const [user, setUser] = useState<User | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Preferences State
    const [currency, setCurrencyState] = useState<Currency>('USD');
    const [budgetAlertsEnabled, setBudgetAlertsEnabledState] = useState(false);
    const [monthlyBudget, setMonthlyBudgetState] = useState(DEFAULT_BUDGETS.USD);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [budgets, setBudgets] = useState<Record<string, number>>({});
    const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});
    const [isNavigating, setIsNavigating] = useState(false);

    const processRecurringExpenses = useCallback(async (uid: string) => {
        try {
            const { error } = await supabase.rpc('process_recurring_transactions', {
                user_id_input: uid
            });
            if (error) {
                console.error('Error processing recurring expenses:', error);
            }
        } catch (error) {
            console.error('Error calling recurring expense RPC:', error);
        }
    }, []);

    const loadPreferences = useCallback(async (uid: string) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('currency, budget_alerts, monthly_budget, budgets, avatar_url')
                .eq('id', uid)
                .single();

            if (data) {
                if (data.currency) setCurrencyState(data.currency as Currency);
                if (data.budget_alerts !== null) setBudgetAlertsEnabledState(data.budget_alerts);
                if (data.monthly_budget) setMonthlyBudgetState(data.monthly_budget);
                if (data.avatar_url) setAvatarUrl(data.avatar_url);
                if (data.budgets) setBudgets(data.budgets as Record<string, number>);
            }
            if (error && error.code !== 'PGRST116') {
                console.error('Error fetching preferences:', error);
            }
        } catch (error) {
            console.error('Error loading preferences:', error);
        }
    }, []);

    const handleSession = useCallback(async (session: Session | null) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        setUserId(currentUser?.id ?? null);

        if (currentUser) {
            await Promise.all([
                loadPreferences(currentUser.id),
                processRecurringExpenses(currentUser.id)
            ]);
        } else {
            // Reset preferences on logout
            setCurrencyState('USD');
            setBudgetAlertsEnabledState(false);
            setMonthlyBudgetState(DEFAULT_BUDGETS.USD);
            setBudgets({});
            setExchangeRates({});
            setAvatarUrl(null);
        }
    }, [loadPreferences]);

    // Initialize Auth and Listen for Changes
    useEffect(() => {
        let mounted = true;

        const initializeAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (mounted) {
                    handleSession(session);
                }
            } catch (error) {
                console.error('Auth initialization error:', error);
            } finally {
                if (mounted) setIsLoading(false);
            }
        };

        initializeAuth();

        // Efficient trigger for recurring expenses:
        // Checks when the user returns to the tab or opens it.
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                supabase.auth.getSession().then(({ data: { session } }) => {
                    if (session?.user?.id) {
                        processRecurringExpenses(session.user.id);
                    }
                });
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (mounted) {
                handleSession(session);
                setIsLoading(false);
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    // Fetch Exchange Rates when currency changes
    useEffect(() => {
        const fetchRates = async () => {
            try {
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

    const refreshPreferences = useCallback(async () => {
        if (userId) {
            await loadPreferences(userId);
        }
    }, [userId, loadPreferences]);

    const formatCurrency = useCallback((amount: number, currencyOverride?: string) => {
        const targetCurrency = currencyOverride || currency;

        if (targetCurrency === 'EUR') {
            return new Intl.NumberFormat('en-IE', {
                style: 'currency',
                currency: 'EUR',
            }).format(amount);
        }

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
    }, [currency]);

    const convertAmount = useCallback((amount: number, fromCurrency: string): number => {
        if (!fromCurrency || fromCurrency === currency) return amount;
        const rate = exchangeRates[fromCurrency];
        return rate ? amount / rate : amount;
    }, [currency, exchangeRates]);

    const setCurrency = useCallback(async (newCurrency: Currency) => {
        if (newCurrency === currency) return;
        const newBudget = budgets[newCurrency] || DEFAULT_BUDGETS[newCurrency];

        setCurrencyState(newCurrency);
        setMonthlyBudgetState(newBudget);

        if (userId) {
            try {
                const { error } = await supabase
                    .from('profiles')
                    .update({
                        currency: newCurrency,
                        monthly_budget: newBudget
                    })
                    .eq('id', userId);

                if (error) throw error;
                toast.success(`Currency switched to ${newCurrency}. Budget set to ${formatCurrency(newBudget, newCurrency)}`);
            } catch (error) {
                console.error('Error updating currency:', error);
                toast.error('Failed to update currency preference');
                refreshPreferences();
            }
        }
    }, [currency, budgets, userId, formatCurrency, refreshPreferences]);

    const setBudgetAlertsEnabled = useCallback(async (enabled: boolean) => {
        setBudgetAlertsEnabledState(enabled);

        if (userId) {
            try {
                const { error } = await supabase
                    .from('profiles')
                    .update({ budget_alerts: enabled })
                    .eq('id', userId);

                if (error) throw error;
            } catch (error) {
                console.error('Error updating budget alerts:', error);
                toast.error('Failed to update budget alert preference');
                refreshPreferences();
            }
        }
    }, [userId, refreshPreferences]);

    const setMonthlyBudget = useCallback(async (budget: number) => {
        const updatedBudgets = { ...budgets, [currency]: budget };
        setMonthlyBudgetState(budget);
        setBudgets(updatedBudgets);

        if (userId) {
            try {
                const { error } = await supabase
                    .from('profiles')
                    .update({
                        monthly_budget: budget,
                        budgets: updatedBudgets
                    })
                    .eq('id', userId);

                if (error) throw error;
            } catch (error) {
                console.error('Error updating budget:', error);
                toast.error('Failed to update budget');
                refreshPreferences();
            }
        }
    }, [currency, budgets, userId, refreshPreferences]);

    const contextValue = useMemo(() => ({
        user,
        userId,
        isAuthenticated: !!userId,
        isLoading,
        currency,
        setCurrency,
        formatCurrency,
        refreshPreferences,
        convertAmount,
        budgetAlertsEnabled,
        setBudgetAlertsEnabled,
        monthlyBudget,
        setMonthlyBudget,
        avatarUrl,
        setAvatarUrl,
        isNavigating,
        setIsNavigating,
    }), [
        user,
        userId,
        isLoading,
        currency,
        setCurrency,
        formatCurrency,
        refreshPreferences,
        convertAmount,
        budgetAlertsEnabled,
        setBudgetAlertsEnabled,
        monthlyBudget,
        setMonthlyBudget,
        avatarUrl,
        isNavigating,
    ]);

    return (
        <UserPreferencesContext.Provider value={contextValue}>
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
