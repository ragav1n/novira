'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/utils/haptics';
import { User, Session } from '@supabase/supabase-js';

export type Currency = 'USD' | 'EUR' | 'INR' | 'GBP' | 'SGD' | 'VND' | 'TWD' | 'JPY' | 'KRW' | 'HKD' | 'MYR' | 'PHP' | 'THB' | 'CAD' | 'AUD' | 'MXN' | 'BRL' | 'IDR';

const DEFAULT_BUDGETS: Record<Currency, number> = {
    USD: 1500,
    EUR: 1200,
    INR: 100000,
    GBP: 1000,
    SGD: 2000,
    VND: 35000000,
    TWD: 50000,
    JPY: 200000,
    KRW: 2000000,
    HKD: 12000,
    MYR: 6000,
    PHP: 80000,
    THB: 50000,
    CAD: 2000,
    AUD: 2000,
    MXN: 25000,
    BRL: 7000,
    IDR: 25000000
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
    convertAmount: (amount: number, fromCurrency: string, toCurrency?: string) => number;
    budgetAlertsEnabled: boolean;
    setBudgetAlertsEnabled: (enabled: boolean) => Promise<void>;
    monthlyBudget: number;
    setMonthlyBudget: (budget: number) => Promise<void>;
    avatarUrl: string | null;
    setAvatarUrl: (url: string | null) => void;
    isNavigating: boolean;
    setIsNavigating: (isNavigating: boolean) => void;
    isRatesLoading: boolean;
    CURRENCY_SYMBOLS: Record<Currency, string>;
    CURRENCY_DETAILS: Record<Currency, { name: string; symbol: string }>;
}

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
    USD: '$', EUR: '€', INR: '₹', GBP: '£', SGD: 'S$', VND: '₫',
    TWD: 'NT$', JPY: '¥', KRW: '₩', HKD: 'HK$', MYR: 'RM',
    PHP: '₱', THB: '฿', CAD: 'C$', AUD: 'A$', MXN: 'Mex$', BRL: 'R$', IDR: 'Rp'
};

export const CURRENCY_DETAILS: Record<Currency, { name: string; symbol: string }> = {
    INR: { name: 'Indian Rupee', symbol: '₹' },
    USD: { name: 'US Dollar', symbol: '$' },
    EUR: { name: 'Euro', symbol: '€' },
    GBP: { name: 'British Pound', symbol: '£' },
    SGD: { name: 'Singapore Dollar', symbol: 'S$' },
    VND: { name: 'Vietnamese Dong', symbol: '₫' },
    TWD: { name: 'Taiwan Dollar', symbol: 'NT$' },
    JPY: { name: 'Japanese Yen', symbol: '¥' },
    KRW: { name: 'South Korean Won', symbol: '₩' },
    HKD: { name: 'Hong Kong Dollar', symbol: 'HK$' },
    MYR: { name: 'Malaysian Ringgit', symbol: 'RM' },
    PHP: { name: 'Philippine Peso', symbol: '₱' },
    THB: { name: 'Thai Baht', symbol: '฿' },
    CAD: { name: 'Canadian Dollar', symbol: 'C$' },
    AUD: { name: 'Australian Dollar', symbol: 'A$' },
    MXN: { name: 'Mexican Peso', symbol: 'Mex$' },
    BRL: { name: 'Brazilian Real', symbol: 'R$' },
    IDR: { name: 'Indonesian Rupiah', symbol: 'Rp' }
};

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined);

export function UserPreferencesProvider({ children }: { children: React.ReactNode }) {
    // Auth State
    const [user, setUser] = useState<User | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // Preferences State
    const [currency, setCurrencyState] = useState<Currency>('INR');
    const [budgetAlertsEnabled, setBudgetAlertsEnabledState] = useState(false);
    const [monthlyBudget, setMonthlyBudgetState] = useState(DEFAULT_BUDGETS.INR);
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
            setCurrencyState('INR');
            setBudgetAlertsEnabledState(false);
            setMonthlyBudgetState(DEFAULT_BUDGETS.INR);
            setBudgets({});
            setExchangeRates({});
            setAvatarUrl(null);
        }
    }, [loadPreferences, processRecurringExpenses]);

    // Initialize Auth and Listen for Changes
    useEffect(() => {
        let mounted = true;

        const initializeAuth = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (mounted) {
                    // Construct a minimal session-like object for handleSession
                    handleSession(user ? { user } as any : null);
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
                supabase.auth.getUser().then(({ data: { user } }) => {
                    if (user?.id) {
                        processRecurringExpenses(user.id);
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
    }, [handleSession, processRecurringExpenses]);

    // Fetch Exchange Rates when currency changes (with localStorage caching)
    useEffect(() => {
        const CACHE_TTL = 60 * 60 * 1000; // 1 hour
        const cacheKey = `novira_rates_${currency}`;
        const API_KEY = process.env.NEXT_PUBLIC_EXCHANGERATE_API_KEY;

        const FRANKFURTER_SUPPORTED = [
            'AUD', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK', 'EUR', 'GBP', 'HKD',
            'HUF', 'IDR', 'ILS', 'INR', 'ISK', 'JPY', 'KRW', 'MXN', 'MYR', 'NOK',
            'NZD', 'PHP', 'PLN', 'RON', 'SEK', 'SGD', 'THB', 'TRY', 'USD', 'ZAR'
        ];

        const fetchRates = async () => {
            // Check cache first
            try {
                const cached = localStorage.getItem(cacheKey);
                if (cached) {
                    const { rates, timestamp } = JSON.parse(cached);
                    if (Date.now() - timestamp < CACHE_TTL) {
                        setExchangeRates(rates);
                        return;
                    }
                }
            } catch {}

            let ratesRes: Record<string, number> | null = null;

            // Step 1: Try Frankfurter if currency is supported
            if (FRANKFURTER_SUPPORTED.includes(currency)) {
                try {
                    const response = await fetch(`https://api.frankfurter.dev/v1/latest?base=${currency}`);
                    if (response.ok) {
                        const data = await response.json();
                        ratesRes = data.rates;
                        // Frankfurter doesn't include the base currency in the rates object, add it
                        if (ratesRes) ratesRes[currency] = 1;
                    }
                } catch (e) {
                    console.warn('Frankfurter fetch failed, trying fallback...');
                }
            }

            // Step 2: Try ExchangeRate-API if Frankfurter failed or doesn't support the currency (TWD/VND)
            if (!ratesRes && API_KEY) {
                try {
                    const response = await fetch(`https://v6.exchangerate-api.com/v6/${API_KEY}/latest/${currency}`);
                    if (response.ok) {
                        const data = await response.json();
                        if (data.result === 'success') {
                            ratesRes = data.conversion_rates;
                        }
                    }
                } catch (e) {
                    console.warn('ExchangeRate-API fetch failed');
                }
            }

            if (ratesRes) {
                setExchangeRates(ratesRes);
                try {
                    localStorage.setItem(cacheKey, JSON.stringify({
                        rates: ratesRes,
                        timestamp: Date.now()
                    }));
                } catch {}
            } else {
                // Try to use stale cache as absolute last resort
                try {
                    const cached = localStorage.getItem(cacheKey);
                    if (cached) {
                        const { rates } = JSON.parse(cached);
                        setExchangeRates(rates);
                    }
                } catch {}
            }
        };

        fetchRates();
    }, [currency]);

    const refreshPreferences = useCallback(async () => {
        if (userId) {
            await loadPreferences(userId);
        }
    }, [userId, loadPreferences]);

    // Cache Intl.NumberFormat instances to avoid re-creating on every call
    const formatterCache = useRef<Map<string, Intl.NumberFormat>>(new Map());

    const formatCurrency = useCallback((amount: number, currencyOverride?: string) => {
        const targetCurrency = currencyOverride || currency;

        const locales: Record<string, string> = {
            EUR: 'en-IE',
            INR: 'en-IN',
            GBP: 'en-GB',
            SGD: 'en-SG',
            VND: 'vi-VN',
            TWD: 'zh-TW',
            JPY: 'ja-JP',
            KRW: 'ko-KR',
            HKD: 'en-HK',
            MYR: 'ms-MY',
            PHP: 'en-PH',
            THB: 'th-TH',
            CAD: 'en-CA',
            AUD: 'en-AU',
            MXN: 'es-MX',
            BRL: 'pt-BR',
            IDR: 'id-ID'
        };

        const zeroDecimalCurrencies = ['VND', 'IDR', 'JPY', 'KRW', 'INR', 'TWD', 'THB', 'PHP'];
        const symbol = CURRENCY_SYMBOLS[targetCurrency as Currency] || '$';

        let formatter = formatterCache.current.get(targetCurrency);
        if (!formatter) {
            formatter = new Intl.NumberFormat(locales[targetCurrency] || 'en-US', {
                minimumFractionDigits: zeroDecimalCurrencies.includes(targetCurrency) ? 0 : 2,
                maximumFractionDigits: zeroDecimalCurrencies.includes(targetCurrency) ? 0 : 2
            });
            formatterCache.current.set(targetCurrency, formatter);
        }

        return `${symbol}${formatter.format(amount)}`;
    }, [currency]);

    const convertAmount = useCallback((amount: number, fromCurrency: string, toCurrency?: string): number => {
        if (!fromCurrency) return amount;
        const from = fromCurrency.toUpperCase();
        const to = (toCurrency || currency).toUpperCase();
        
        if (from === to) return amount;
        
        const fromRate = exchangeRates[from] || 1;
        const toRate = exchangeRates[to] || 1;
        
        // Convert to base currency (USD internal representation inside exchangeRates usually)
        // Actually, exchangeRates holds how much of `currency` equals 1 `base` or vice versa.
        // Wait, from previous code: `const rate = exchangeRates[from]; if (rate) return amount / rate;`
        // Meaning 1 base_currency = rate * fromCurrency. So baseAmount = amount / fromRate.
        const amountInBase = amount / fromRate;

        if (to === currency.toUpperCase()) {
            return amountInBase;
        }

        return amountInBase * toRate;
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
        isRatesLoading: Object.keys(exchangeRates).length === 0,
        CURRENCY_SYMBOLS,
        CURRENCY_DETAILS
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
        exchangeRates,
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
