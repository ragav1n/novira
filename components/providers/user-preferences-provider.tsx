'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/utils/haptics';
import { User, Session } from '@supabase/supabase-js';
import { useExchangeRates } from '@/hooks/useExchangeRates';

export type Currency = 'USD' | 'EUR' | 'INR' | 'GBP' | 'SGD' | 'VND' | 'TWD' | 'JPY' | 'KRW' | 'HKD' | 'MYR' | 'PHP' | 'THB' | 'CAD' | 'AUD' | 'MXN' | 'BRL' | 'IDR' | 'AED';

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
    IDR: 25000000,
    AED: 5500
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
    fullName: string;
    setFullName: (name: string) => void;
    isNavigating: boolean;
    setIsNavigating: (isNavigating: boolean) => void;
    isRatesLoading: boolean;
    CURRENCY_SYMBOLS: Record<Currency, string>;
    CURRENCY_DETAILS: Record<Currency, { name: string; symbol: string }>;
    
    // Joint Workspaces
    activeWorkspaceId: string | null;
    setActiveWorkspaceId: (id: string | null) => void;
    workspaceBudgets: Record<string, { amount: number; currency: string }>; // Maps group_id to {budget, currency}
    convertedWorkspaceBudgets: Record<string, number>; // Converted for UI
    setWorkspaceBudget: (groupId: string, budget: number) => Promise<void>;
}

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
    USD: '$', EUR: '€', INR: '₹', GBP: '£', SGD: 'S$', VND: '₫',
    TWD: 'NT$', JPY: '¥', KRW: '₩', HKD: 'HK$', MYR: 'RM',
    PHP: '₱', THB: '฿', CAD: 'C$', AUD: 'A$', MXN: 'Mex$', BRL: 'R$', IDR: 'Rp', AED: 'AED'
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
    IDR: { name: 'Indonesian Rupiah', symbol: 'Rp' },
    AED: { name: 'UAE Dirham', symbol: 'AED' }
};

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined);

export function UserPreferencesProvider({ children }: { children: React.ReactNode }) {
    // Auth State
    const [user, setUser] = useState<User | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const userIdRef = useRef<string | null>(null);

    // Preferences State
    const [currency, setCurrencyState] = useState<Currency>('INR');
    const [budgetAlertsEnabled, setBudgetAlertsEnabledState] = useState(false);
    const [monthlyBudget, setMonthlyBudgetState] = useState(DEFAULT_BUDGETS.INR);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [fullName, setFullName] = useState<string>('User');
    const [budgets, setBudgets] = useState<Record<string, number>>({});
    const exchangeRates = useExchangeRates(currency);
    const [isNavigating, setIsNavigating] = useState(false);
    
    // Joint Workspaces State
    const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
    const [workspaceBudgets, setWorkspaceBudgets] = useState<Record<string, { amount: number; currency: string }>>({});

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
            // First, hydrate from localStorage for instant UI feedback
            const cacheKey = `novira_profile_${uid}`;
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    if (parsed.currency) setCurrencyState(parsed.currency);
                    if (parsed.budget_alerts !== null) setBudgetAlertsEnabledState(parsed.budget_alerts);
                    if (parsed.monthly_budget != null) setMonthlyBudgetState(parsed.monthly_budget);
                    if (parsed.avatar_url) setAvatarUrl(parsed.avatar_url);
                    if (parsed.budgets) setBudgets(parsed.budgets);
                    if (parsed.active_workspace_id) setActiveWorkspaceId(parsed.active_workspace_id);
                } catch {
                    localStorage.removeItem(cacheKey);
                }
            }

            const { data, error } = await supabase
                .from('profiles')
                .select('currency, budget_alerts, monthly_budget, budgets, avatar_url, full_name')
                .eq('id', uid)
                .single();
 
            if (data) {
                if (data.currency) setCurrencyState(data.currency as Currency);
                if (data.budget_alerts !== null) setBudgetAlertsEnabledState(data.budget_alerts);
                if (data.monthly_budget != null) setMonthlyBudgetState(data.monthly_budget);
                if (data.avatar_url) setAvatarUrl(data.avatar_url);
                if (data.budgets) setBudgets(data.budgets as Record<string, number>);
                if (data.full_name) setFullName(data.full_name);

                // Update cache with fresh data
                localStorage.setItem(cacheKey, JSON.stringify(data));
            }
            if (error && error.code !== 'PGRST116') {
                console.error('Error fetching preferences:', error);
            }

            // Fetch workspace budgets (RLS ensures user only gets their groups)
            const { data: workspaceData, error: workspaceError } = await supabase
                .from('workspace_budgets')
                .select('group_id, monthly_budget, currency');
            
            if (workspaceData && !workspaceError) {
                const wBudgets: Record<string, { amount: number; currency: string }> = {};
                workspaceData.forEach(row => {
                    wBudgets[row.group_id] = {
                        amount: Number(row.monthly_budget),
                        currency: row.currency || 'USD'
                    };
                });
                setWorkspaceBudgets(wBudgets);
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
            // Load preferences immediately (hydrates from cache first)
            loadPreferences(currentUser.id);
            // Process recurring expenses in the background
            setTimeout(() => processRecurringExpenses(currentUser.id), 1000);
        } else {
            // Reset preferences on logout
            setCurrencyState('INR');
            setBudgetAlertsEnabledState(false);
            setMonthlyBudgetState(DEFAULT_BUDGETS.INR);
            setBudgets({});
            setAvatarUrl(null);
            setActiveWorkspaceId(null);
            setWorkspaceBudgets({});
        }
    }, [loadPreferences, processRecurringExpenses]);

    // Keep ref in sync so visibilitychange handler always has latest userId without re-subscribing
    useEffect(() => {
        userIdRef.current = userId;
    }, [userId]);

    // Initialize Auth and Listen for Changes
    useEffect(() => {
        let mounted = true;

        const initializeAuth = async () => {
            try {
                // Use getSession() instead of getUser() to avoid a redundant network call.
                // The server-side middleware already validates the JWT via getUser().
                // getSession() reads from local cookies — no network round-trip.
                const { data: { session } } = await supabase.auth.getSession();
                if (mounted) {
                    handleSession(session);
                }
            } catch (error) {
                console.error('Auth initialization error:', error);
            }
            // Do NOT set isLoading(false) here — onAuthStateChange fires immediately
            // after mount and is the single source of truth for auth state.
            // Setting isLoading(false) here causes a flash of the signin page on OAuth
            // callbacks where getSession() returns null before cookies propagate.
        };

        initializeAuth();

        // Efficient trigger for recurring expenses:
        // Checks when the user returns to the tab or opens it.
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                // Throttle: only run if >5 minutes since last check
                const lastCheck = parseInt(localStorage.getItem('novira_last_visibility_check') || '0', 10);
                if (Date.now() - lastCheck < 5 * 60 * 1000) return;
                localStorage.setItem('novira_last_visibility_check', String(Date.now()));

                // Use ref instead of closure so this handler doesn't force effect to re-run
                if (userIdRef.current) {
                    processRecurringExpenses(userIdRef.current);
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (mounted) {
                handleSession(session);
                setIsLoading(false);
            }
        });

        // Safety net: if onAuthStateChange hasn't fired within 5s (network/SDK issue),
        // unblock the loading screen so the user isn't permanently stuck.
        const loadingTimeout = setTimeout(() => {
            if (mounted) setIsLoading(false);
        }, 5000);

        return () => {
            mounted = false;
            clearTimeout(loadingTimeout);
            subscription.unsubscribe();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [handleSession, processRecurringExpenses]);

    // Realtime subscriptions for profile and workspace budgets
    useEffect(() => {
        if (!userId) return;

        const profileChannel = supabase
            .channel(`profile-changes-${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${userId}`
                },
                () => {
                    loadPreferences(userId);
                }
            )
            .subscribe();

        const workspaceChannel = supabase
            .channel(`workspace-budget-changes-${userId}-${activeWorkspaceId || 'personal'}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'workspace_budgets'
                },
                () => {
                    loadPreferences(userId);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(profileChannel);
            supabase.removeChannel(workspaceChannel);
        };
    }, [userId, loadPreferences]);

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

        // If rates haven't loaded yet, return the amount unconverted rather than silently 1:1
        if (Object.keys(exchangeRates).length === 0) return amount;

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
        const newBudget = budgets[newCurrency] || convertAmount(monthlyBudget, currency, newCurrency);

        setCurrencyState(newCurrency);
        setMonthlyBudgetState(newBudget);

        // Update cache immediately so the realtime-triggered loadPreferences
        // doesn't read stale currency and revert the change
        if (userId) {
            const cacheKey = `novira_profile_${userId}`;
            try {
                const cached = localStorage.getItem(cacheKey);
                const parsed = cached ? JSON.parse(cached) : {};
                localStorage.setItem(cacheKey, JSON.stringify({ ...parsed, currency: newCurrency, monthly_budget: newBudget }));
            } catch { /* ignore */ }
        }

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

    const setActiveWorkspaceIdWithCache = useCallback((id: string | null) => {
        setActiveWorkspaceId(id);
        if (userId) {
            const cacheKey = `novira_profile_${userId}`;
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    localStorage.setItem(cacheKey, JSON.stringify({ ...parsed, active_workspace_id: id }));
                } catch {
                    localStorage.setItem(cacheKey, JSON.stringify({ active_workspace_id: id }));
                }
            }
        }
    }, [userId]);

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

        // Update localStorage cache immediately so any re-hydration uses the new value
        if (userId) {
            const cacheKey = `novira_profile_${userId}`;
            try {
                const cached = localStorage.getItem(cacheKey);
                const parsed = cached ? JSON.parse(cached) : {};
                localStorage.setItem(cacheKey, JSON.stringify({
                    ...parsed,
                    monthly_budget: budget,
                    budgets: updatedBudgets
                }));
            } catch {}
        }

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

    const convertedWorkspaceBudgets = useMemo(() => {
        const converted: Record<string, number> = {};
        Object.entries(workspaceBudgets).forEach(([groupId, data]) => {
            converted[groupId] = convertAmount(data.amount, data.currency, currency);
        });
        return converted;
    }, [workspaceBudgets, currency, convertAmount]);

    const setWorkspaceBudget = useCallback(async (groupId: string, budget: number) => {
        setWorkspaceBudgets(prev => ({ 
            ...prev, 
            [groupId]: { amount: budget, currency } 
        }));

        if (userId) {
            try {
                const { error } = await supabase
                    .from('workspace_budgets')
                    .upsert(
                        { group_id: groupId, monthly_budget: budget, currency },
                        { onConflict: 'group_id' }
                    );

                if (error) throw error;
                toast.success('Household budget updated');
            } catch (error) {
                console.error('Error updating workspace budget:', error);
                toast.error('Failed to update workspace budget');
                refreshPreferences();
            }
        }
    }, [userId, currency, refreshPreferences]);

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
        fullName,
        setFullName,
        isNavigating,
        setIsNavigating,
        isRatesLoading: Object.keys(exchangeRates).length === 0,
        CURRENCY_SYMBOLS,
        CURRENCY_DETAILS,
        activeWorkspaceId,
        setActiveWorkspaceId: setActiveWorkspaceIdWithCache,
        workspaceBudgets,
        convertedWorkspaceBudgets,
        setWorkspaceBudget
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
        fullName,
        isNavigating,
        exchangeRates,
        activeWorkspaceId,
        workspaceBudgets,
        convertedWorkspaceBudgets,
        setWorkspaceBudget
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
