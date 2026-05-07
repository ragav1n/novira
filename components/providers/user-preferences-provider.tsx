'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from '@/utils/haptics';
import { User, Session } from '@supabase/supabase-js';
import { useExchangeRates } from '@/hooks/useExchangeRates';
import { useAppBadge } from '@/hooks/useAppBadge';
import { setQueueUser, attemptSync } from '@/lib/sync-manager';

export type Currency = 'USD' | 'EUR' | 'INR' | 'GBP' | 'CHF' | 'SGD' | 'VND' | 'TWD' | 'JPY' | 'KRW' | 'HKD' | 'MYR' | 'PHP' | 'THB' | 'CAD' | 'AUD' | 'MXN' | 'BRL' | 'IDR' | 'AED';

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
    CHF: 1350,
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
    billReminderLeadDays: number | null;
    setBillReminderLeadDays: (days: number | null) => Promise<void>;
    digestFrequency: 'off' | 'daily' | 'weekly';
    setDigestFrequency: (freq: 'off' | 'daily' | 'weekly') => Promise<void>;
    bucketDeadlineAlerts: boolean;
    setBucketDeadlineAlerts: (enabled: boolean) => Promise<void>;
    spendingPaceAlerts: boolean;
    setSpendingPaceAlerts: (enabled: boolean) => Promise<void>;
    quietHoursStart: number | null;
    quietHoursEnd: number | null;
    setQuietHours: (start: number | null, end: number | null) => Promise<void>;
    smartDigestsEnabled: boolean;
    setSmartDigestsEnabled: (enabled: boolean) => Promise<void>;
    firstDayOfWeek: 0 | 1;
    setFirstDayOfWeek: (day: 0 | 1) => Promise<void>;
    dateFormat: 'MDY' | 'DMY' | 'YMD';
    setDateFormat: (fmt: 'MDY' | 'DMY' | 'YMD') => Promise<void>;
    defaultCategory: string | null;
    setDefaultCategory: (cat: string | null) => Promise<void>;
    defaultPaymentMethod: string | null;
    setDefaultPaymentMethod: (pm: string | null) => Promise<void>;
    defaultBucketId: string | null;
    setDefaultBucketId: (id: string | null) => Promise<void>;
    monthlyBudget: number;
    setMonthlyBudget: (budget: number) => Promise<void>;
    avatarUrl: string | null;
    setAvatarUrl: (url: string | null) => void;
    fullName: string;
    setFullName: (name: string) => void;
    isNavigating: boolean;
    setIsNavigating: (isNavigating: boolean) => void;
    isRatesLoading: boolean;
    ratesLastUpdated: number | null;
    CURRENCY_SYMBOLS: Record<Currency, string>;
    CURRENCY_DETAILS: Record<Currency, { name: string; symbol: string }>;

    // Privacy Mode (per-device, not synced)
    privacyMode: boolean;                       // user has opted into masking
    setPrivacyMode: (enabled: boolean) => void;
    isPrivacyHidden: boolean;                   // currently masking (privacyMode && hidden)
    togglePrivacyHidden: () => void;
    
    // Joint Workspaces
    activeWorkspaceId: string | null;
    setActiveWorkspaceId: (id: string | null) => void;
    workspaceBudgets: Record<string, { amount: number; currency: string }>; // Maps group_id to {budget, currency}
    convertedWorkspaceBudgets: Record<string, number>; // Converted for UI
    setWorkspaceBudget: (groupId: string, budget: number) => Promise<void>;
}

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
    USD: '$', EUR: '€', INR: '₹', GBP: '£', CHF: 'Fr', SGD: 'S$', VND: '₫',
    TWD: 'NT$', JPY: '¥', KRW: '₩', HKD: 'HK$', MYR: 'RM',
    PHP: '₱', THB: '฿', CAD: 'C$', AUD: 'A$', MXN: 'Mex$', BRL: 'R$', IDR: 'Rp', AED: 'AED'
};

export const CURRENCY_DETAILS: Record<Currency, { name: string; symbol: string }> = {
    INR: { name: 'Indian Rupee', symbol: '₹' },
    USD: { name: 'US Dollar', symbol: '$' },
    EUR: { name: 'Euro', symbol: '€' },
    GBP: { name: 'British Pound', symbol: '£' },
    CHF: { name: 'Swiss Franc', symbol: 'Fr' },
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
    const [billReminderLeadDays, setBillReminderLeadDaysState] = useState<number | null>(null);
    const [digestFrequency, setDigestFrequencyState] = useState<'off' | 'daily' | 'weekly'>('off');
    const [bucketDeadlineAlerts, setBucketDeadlineAlertsState] = useState(true);
    const [spendingPaceAlerts, setSpendingPaceAlertsState] = useState(true);
    const [quietHoursStart, setQuietHoursStartState] = useState<number | null>(null);
    const [quietHoursEnd, setQuietHoursEndState] = useState<number | null>(null);
    const [smartDigestsEnabled, setSmartDigestsEnabledState] = useState(true);
    const [firstDayOfWeek, setFirstDayOfWeekState] = useState<0 | 1>(0);
    const [dateFormat, setDateFormatState] = useState<'MDY' | 'DMY' | 'YMD'>('MDY');
    const [defaultCategory, setDefaultCategoryState] = useState<string | null>(null);
    const [defaultPaymentMethod, setDefaultPaymentMethodState] = useState<string | null>(null);
    const [defaultBucketId, setDefaultBucketIdState] = useState<string | null>(null);
    const [monthlyBudget, setMonthlyBudgetState] = useState(DEFAULT_BUDGETS.INR);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [fullName, setFullName] = useState<string>('User');
    const [budgets, setBudgets] = useState<Record<string, number>>({});
    const { rates: exchangeRates, lastUpdated: ratesLastUpdated } = useExchangeRates(currency);
    const [isNavigating, setIsNavigating] = useState(false);
    
    // Joint Workspaces State
    const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
    const [workspaceBudgets, setWorkspaceBudgets] = useState<Record<string, { amount: number; currency: string }>>({});

    // Privacy Mode State (per-device localStorage; not in profile so each device is independent)
    const [privacyMode, setPrivacyModeState] = useState(false);
    const [isPrivacyHidden, setIsPrivacyHidden] = useState(false);

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
            // First, hydrate from localStorage for instant UI feedback.
            // Active workspace is stored under its own key so rapid workspace switches
            // can't lose-clobber a currency/budget update happening in parallel.
            const cacheKey = `novira_profile_${uid}`;
            const workspaceKey = `novira_active_workspace_${uid}`;
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                try {
                    const parsed = JSON.parse(cached);
                    if (parsed.currency) setCurrencyState(parsed.currency);
                    if (parsed.budget_alerts !== null) setBudgetAlertsEnabledState(parsed.budget_alerts);
                    if (parsed.bill_reminder_lead_days !== undefined) setBillReminderLeadDaysState(parsed.bill_reminder_lead_days);
                    if (parsed.digest_frequency) setDigestFrequencyState(parsed.digest_frequency);
                    if (parsed.monthly_budget != null) setMonthlyBudgetState(parsed.monthly_budget);
                    if (parsed.avatar_url) setAvatarUrl(parsed.avatar_url);
                    if (parsed.budgets) setBudgets(parsed.budgets);
                    if (parsed.bucket_deadline_alerts != null) setBucketDeadlineAlertsState(parsed.bucket_deadline_alerts);
                    if (parsed.spending_pace_alerts != null) setSpendingPaceAlertsState(parsed.spending_pace_alerts);
                    if (parsed.quiet_hours_start !== undefined) setQuietHoursStartState(parsed.quiet_hours_start);
                    if (parsed.quiet_hours_end !== undefined) setQuietHoursEndState(parsed.quiet_hours_end);
                    if (parsed.smart_digests_enabled != null) setSmartDigestsEnabledState(parsed.smart_digests_enabled);
                    if (parsed.first_day_of_week === 0 || parsed.first_day_of_week === 1) setFirstDayOfWeekState(parsed.first_day_of_week);
                    if (parsed.date_format === 'MDY' || parsed.date_format === 'DMY' || parsed.date_format === 'YMD') setDateFormatState(parsed.date_format);
                    if (parsed.default_category !== undefined) setDefaultCategoryState(parsed.default_category);
                    if (parsed.default_payment_method !== undefined) setDefaultPaymentMethodState(parsed.default_payment_method);
                    if (parsed.default_bucket_id !== undefined) setDefaultBucketIdState(parsed.default_bucket_id);
                    // Migration: if active_workspace_id was previously stored in the
                    // consolidated blob, surface it so the new dedicated key takes over.
                    if (parsed.active_workspace_id && !localStorage.getItem(workspaceKey)) {
                        localStorage.setItem(workspaceKey, parsed.active_workspace_id);
                    }
                } catch {
                    localStorage.removeItem(cacheKey);
                }
            }
            const storedWorkspace = localStorage.getItem(workspaceKey);
            if (storedWorkspace) setActiveWorkspaceId(storedWorkspace);

            // Try the wide select first (includes new columns). If columns don't
            // exist yet on this deployment, fall back to the legacy column set
            // so the rest of the preferences still hydrate.
            const FULL_COLUMNS = 'currency, budget_alerts, bill_reminder_lead_days, digest_frequency, monthly_budget, budgets, avatar_url, full_name, bucket_deadline_alerts, spending_pace_alerts, quiet_hours_start, quiet_hours_end, smart_digests_enabled, first_day_of_week, date_format, default_category, default_payment_method, default_bucket_id';
            const LEGACY_COLUMNS = 'currency, budget_alerts, bill_reminder_lead_days, digest_frequency, monthly_budget, budgets, avatar_url, full_name';

            type ProfileRow = {
                currency?: Currency | null;
                budget_alerts?: boolean | null;
                bill_reminder_lead_days?: number | null;
                digest_frequency?: 'off' | 'daily' | 'weekly' | null;
                monthly_budget?: number | null;
                budgets?: Record<string, number> | null;
                avatar_url?: string | null;
                full_name?: string | null;
                bucket_deadline_alerts?: boolean | null;
                spending_pace_alerts?: boolean | null;
                quiet_hours_start?: number | null;
                quiet_hours_end?: number | null;
                smart_digests_enabled?: boolean | null;
                first_day_of_week?: 0 | 1 | null;
                date_format?: 'MDY' | 'DMY' | 'YMD' | null;
                default_category?: string | null;
                default_payment_method?: string | null;
                default_bucket_id?: string | null;
            };

            let data: ProfileRow | null = null;
            let error: { code?: string; message?: string } | null = null;
            const wide = await supabase
                .from('profiles')
                .select(FULL_COLUMNS)
                .eq('id', uid)
                .single();
            if (wide.error && wide.error.code !== 'PGRST116') {
                const legacy = await supabase
                    .from('profiles')
                    .select(LEGACY_COLUMNS)
                    .eq('id', uid)
                    .single();
                data = (legacy.data as ProfileRow | null) ?? null;
                error = legacy.error;
            } else {
                data = (wide.data as ProfileRow | null) ?? null;
                error = wide.error;
            }

            if (data) {
                if (data.currency) setCurrencyState(data.currency as Currency);
                if (data.budget_alerts !== null && data.budget_alerts !== undefined) setBudgetAlertsEnabledState(data.budget_alerts);
                if (data.bill_reminder_lead_days !== undefined) {
                    setBillReminderLeadDaysState(data.bill_reminder_lead_days ?? null);
                }
                if (data.digest_frequency) setDigestFrequencyState(data.digest_frequency);
                if (data.monthly_budget != null) setMonthlyBudgetState(data.monthly_budget);
                if (data.avatar_url) setAvatarUrl(data.avatar_url);
                if (data.budgets) setBudgets(data.budgets);
                if (data.full_name) setFullName(data.full_name);
                if (data.bucket_deadline_alerts != null) setBucketDeadlineAlertsState(data.bucket_deadline_alerts);
                if (data.spending_pace_alerts != null) setSpendingPaceAlertsState(data.spending_pace_alerts);
                if (data.quiet_hours_start !== undefined) setQuietHoursStartState(data.quiet_hours_start);
                if (data.quiet_hours_end !== undefined) setQuietHoursEndState(data.quiet_hours_end);
                if (data.smart_digests_enabled != null) setSmartDigestsEnabledState(data.smart_digests_enabled);
                if (data.first_day_of_week === 0 || data.first_day_of_week === 1) setFirstDayOfWeekState(data.first_day_of_week);
                if (data.date_format === 'MDY' || data.date_format === 'DMY' || data.date_format === 'YMD') setDateFormatState(data.date_format);
                if (data.default_category !== undefined) setDefaultCategoryState(data.default_category);
                if (data.default_payment_method !== undefined) setDefaultPaymentMethodState(data.default_payment_method);
                if (data.default_bucket_id !== undefined) setDefaultBucketIdState(data.default_bucket_id);

                // Update cache with fresh data (merge to preserve fields like active_workspace_id)
                try {
                    const existing = localStorage.getItem(cacheKey);
                    const parsed = existing ? JSON.parse(existing) : {};
                    localStorage.setItem(cacheKey, JSON.stringify({ ...parsed, ...data }));
                } catch {
                    localStorage.setItem(cacheKey, JSON.stringify(data));
                }
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

        // Bind the offline-sync queue to this user before any mutation. On logout
        // (currentUser=null) this clears the in-memory queue binding and dispatches
        // an empty queue-updated event so the indicator clears. Awaited because
        // setQueueUser may migrate the legacy single-key queue on first sign-in
        // and we want that done before the flush below.
        await setQueueUser(currentUser?.id ?? null);

        if (currentUser) {
            // Load preferences immediately (hydrates from cache first)
            loadPreferences(currentUser.id);
            // Process recurring expenses in the background
            setTimeout(() => processRecurringExpenses(currentUser.id), 1000);
            // Flush any items that were stranded in the queue across a refresh or
            // that had failed transient retries — without this, the queue stays
            // dormant until a new mutation or a fresh `online` event.
            if (typeof navigator !== 'undefined' && navigator.onLine) {
                attemptSync();
            }
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

    useAppBadge(userId);

    // One-shot timezone sync per tab session. Lives outside loadPreferences
    // because the realtime listener on profile UPDATE re-calls loadPreferences,
    // and updating timezone there would re-fire the listener → infinite loop.
    useEffect(() => {
        if (!userId) return;
        if (typeof window === 'undefined') return;
        const flagKey = `novira_tz_synced_${userId}`;
        if (sessionStorage.getItem(flagKey) === '1') return;
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (!tz) return;
        sessionStorage.setItem(flagKey, '1');
        supabase.from('profiles').update({ timezone: tz }).eq('id', userId).then(({ error }) => {
            if (error && process.env.NODE_ENV === 'development') {
                console.warn('[preferences] timezone sync failed:', error.message);
            }
        });
    }, [userId]);

    // Hydrate privacyMode from localStorage on mount; auto-mask when the tab is hidden.
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const stored = localStorage.getItem('novira_privacy_mode') === '1';
        setPrivacyModeState(stored);
        setIsPrivacyHidden(stored);
        const onVisibility = () => {
            if (localStorage.getItem('novira_privacy_mode') !== '1') return;
            if (document.visibilityState === 'hidden') setIsPrivacyHidden(true);
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, []);

    const setPrivacyMode = useCallback((enabled: boolean) => {
        setPrivacyModeState(enabled);
        setIsPrivacyHidden(enabled);
        try {
            if (enabled) localStorage.setItem('novira_privacy_mode', '1');
            else localStorage.removeItem('novira_privacy_mode');
        } catch { /* ignore */ }
    }, []);

    const togglePrivacyHidden = useCallback(() => {
        setIsPrivacyHidden(prev => !prev);
    }, []);

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

    // Realtime subscriptions for profile and workspace budgets.
    // Use a generation counter so callbacks from a stale subscription (rapid workspace
    // switch faster than removeChannel resolves) don't trigger refetches against the
    // wrong userId/workspace.
    const realtimeGenRef = useRef(0);
    useEffect(() => {
        if (!userId) return;
        const myGen = ++realtimeGenRef.current;

        const profileChannel = supabase
            .channel(`profile-changes-${userId}-${myGen}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles',
                    filter: `id=eq.${userId}`
                },
                () => {
                    if (realtimeGenRef.current !== myGen) return;
                    loadPreferences(userId);
                }
            )
            .subscribe();

        const workspaceChannel = supabase
            .channel(`workspace-budget-changes-${userId}-${activeWorkspaceId || 'personal'}-${myGen}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'workspace_budgets'
                },
                () => {
                    if (realtimeGenRef.current !== myGen) return;
                    loadPreferences(userId);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(profileChannel);
            supabase.removeChannel(workspaceChannel);
        };
    }, [userId, activeWorkspaceId, loadPreferences]);

    const refreshPreferences = useCallback(async () => {
        if (userId) {
            await loadPreferences(userId);
        }
    }, [userId, loadPreferences]);

    // Cache Intl.NumberFormat instances to avoid re-creating on every call
    const formatterCache = useRef<Map<string, Intl.NumberFormat>>(new Map());

    const formatCurrency = useCallback((amount: number, currencyOverride?: string) => {
        const targetCurrency = currencyOverride || currency;
        if (isPrivacyHidden) {
            const symbol = CURRENCY_SYMBOLS[targetCurrency as Currency] || '$';
            return `${symbol}••••`;
        }

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
    }, [currency, isPrivacyHidden]);

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
            const workspaceKey = `novira_active_workspace_${userId}`;
            try {
                if (id) localStorage.setItem(workspaceKey, id);
                else localStorage.removeItem(workspaceKey);
            } catch { /* ignore */ }
        }
    }, [userId]);

    const setDigestFrequency = useCallback(async (freq: 'off' | 'daily' | 'weekly') => {
        setDigestFrequencyState(freq);
        if (userId) {
            const cacheKey = `novira_profile_${userId}`;
            try {
                const cached = localStorage.getItem(cacheKey);
                const parsed = cached ? JSON.parse(cached) : {};
                localStorage.setItem(cacheKey, JSON.stringify({ ...parsed, digest_frequency: freq }));
            } catch { /* ignore */ }

            try {
                const { error } = await supabase
                    .from('profiles')
                    .update({ digest_frequency: freq })
                    .eq('id', userId);
                if (error) throw error;
            } catch (error) {
                console.error('Error updating digest frequency:', error);
                toast.error('Failed to update digest preference');
                refreshPreferences();
            }
        }
    }, [userId, refreshPreferences]);

    const setBillReminderLeadDays = useCallback(async (days: number | null) => {
        setBillReminderLeadDaysState(days);

        if (userId) {
            const cacheKey = `novira_profile_${userId}`;
            try {
                const cached = localStorage.getItem(cacheKey);
                const parsed = cached ? JSON.parse(cached) : {};
                localStorage.setItem(cacheKey, JSON.stringify({ ...parsed, bill_reminder_lead_days: days }));
            } catch { /* ignore */ }

            try {
                const { error } = await supabase
                    .from('profiles')
                    .update({ bill_reminder_lead_days: days })
                    .eq('id', userId);
                if (error) throw error;
            } catch (error) {
                console.error('Error updating bill reminder lead days:', error);
                toast.error('Failed to update bill reminder preference');
                refreshPreferences();
            }
        }
    }, [userId, refreshPreferences]);

    const persistProfileField = useCallback(async <K extends string>(
        column: K,
        value: unknown,
        cacheKey: K,
        errorLabel: string,
    ) => {
        if (!userId) return true;
        const profileCacheKey = `novira_profile_${userId}`;
        try {
            const cached = localStorage.getItem(profileCacheKey);
            const parsed = cached ? JSON.parse(cached) : {};
            localStorage.setItem(profileCacheKey, JSON.stringify({ ...parsed, [cacheKey]: value }));
        } catch { /* ignore */ }

        try {
            const { error } = await supabase
                .from('profiles')
                .update({ [column]: value })
                .eq('id', userId);
            if (error) throw error;
            return true;
        } catch (error) {
            console.error(`Error updating ${errorLabel}:`, error);
            toast.error(`Failed to update ${errorLabel}`);
            refreshPreferences();
            return false;
        }
    }, [userId, refreshPreferences]);

    const setBucketDeadlineAlerts = useCallback(async (enabled: boolean) => {
        setBucketDeadlineAlertsState(enabled);
        await persistProfileField('bucket_deadline_alerts', enabled, 'bucket_deadline_alerts', 'bucket deadline alerts');
    }, [persistProfileField]);

    const setSpendingPaceAlerts = useCallback(async (enabled: boolean) => {
        setSpendingPaceAlertsState(enabled);
        await persistProfileField('spending_pace_alerts', enabled, 'spending_pace_alerts', 'spending pace alerts');
    }, [persistProfileField]);

    const setSmartDigestsEnabled = useCallback(async (enabled: boolean) => {
        setSmartDigestsEnabledState(enabled);
        await persistProfileField('smart_digests_enabled', enabled, 'smart_digests_enabled', 'smart digests');
    }, [persistProfileField]);

    const setQuietHours = useCallback(async (start: number | null, end: number | null) => {
        setQuietHoursStartState(start);
        setQuietHoursEndState(end);
        if (!userId) return;
        const profileCacheKey = `novira_profile_${userId}`;
        try {
            const cached = localStorage.getItem(profileCacheKey);
            const parsed = cached ? JSON.parse(cached) : {};
            localStorage.setItem(profileCacheKey, JSON.stringify({ ...parsed, quiet_hours_start: start, quiet_hours_end: end }));
        } catch { /* ignore */ }
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ quiet_hours_start: start, quiet_hours_end: end })
                .eq('id', userId);
            if (error) throw error;
        } catch (error) {
            console.error('Error updating quiet hours:', error);
            toast.error('Failed to update quiet hours');
            refreshPreferences();
        }
    }, [userId, refreshPreferences]);

    const setFirstDayOfWeek = useCallback(async (day: 0 | 1) => {
        setFirstDayOfWeekState(day);
        await persistProfileField('first_day_of_week', day, 'first_day_of_week', 'first day of week');
    }, [persistProfileField]);

    const setDateFormat = useCallback(async (fmt: 'MDY' | 'DMY' | 'YMD') => {
        setDateFormatState(fmt);
        await persistProfileField('date_format', fmt, 'date_format', 'date format');
    }, [persistProfileField]);

    const setDefaultCategory = useCallback(async (cat: string | null) => {
        setDefaultCategoryState(cat);
        await persistProfileField('default_category', cat, 'default_category', 'default category');
    }, [persistProfileField]);

    const setDefaultPaymentMethod = useCallback(async (pm: string | null) => {
        setDefaultPaymentMethodState(pm);
        await persistProfileField('default_payment_method', pm, 'default_payment_method', 'default payment method');
    }, [persistProfileField]);

    const setDefaultBucketId = useCallback(async (id: string | null) => {
        setDefaultBucketIdState(id);
        await persistProfileField('default_bucket_id', id, 'default_bucket_id', 'default bucket');
    }, [persistProfileField]);

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

    // Derived from exchangeRates — stable boolean so context only re-renders when loading state changes
    const isRatesLoading = Object.keys(exchangeRates).length === 0;

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
        billReminderLeadDays,
        setBillReminderLeadDays,
        digestFrequency,
        setDigestFrequency,
        bucketDeadlineAlerts,
        setBucketDeadlineAlerts,
        spendingPaceAlerts,
        setSpendingPaceAlerts,
        quietHoursStart,
        quietHoursEnd,
        setQuietHours,
        smartDigestsEnabled,
        setSmartDigestsEnabled,
        firstDayOfWeek,
        setFirstDayOfWeek,
        dateFormat,
        setDateFormat,
        defaultCategory,
        setDefaultCategory,
        defaultPaymentMethod,
        setDefaultPaymentMethod,
        defaultBucketId,
        setDefaultBucketId,
        monthlyBudget,
        setMonthlyBudget,
        avatarUrl,
        setAvatarUrl,
        fullName,
        setFullName,
        isNavigating,
        setIsNavigating,
        isRatesLoading,
        ratesLastUpdated,
        CURRENCY_SYMBOLS,
        CURRENCY_DETAILS,
        activeWorkspaceId,
        setActiveWorkspaceId: setActiveWorkspaceIdWithCache,
        workspaceBudgets,
        convertedWorkspaceBudgets,
        setWorkspaceBudget,
        privacyMode,
        setPrivacyMode,
        isPrivacyHidden,
        togglePrivacyHidden
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
        billReminderLeadDays,
        setBillReminderLeadDays,
        digestFrequency,
        setDigestFrequency,
        bucketDeadlineAlerts,
        setBucketDeadlineAlerts,
        spendingPaceAlerts,
        setSpendingPaceAlerts,
        quietHoursStart,
        quietHoursEnd,
        setQuietHours,
        smartDigestsEnabled,
        setSmartDigestsEnabled,
        firstDayOfWeek,
        setFirstDayOfWeek,
        dateFormat,
        setDateFormat,
        defaultCategory,
        setDefaultCategory,
        defaultPaymentMethod,
        setDefaultPaymentMethod,
        defaultBucketId,
        setDefaultBucketId,
        monthlyBudget,
        setMonthlyBudget,
        avatarUrl,
        fullName,
        isNavigating,
        isRatesLoading,
        ratesLastUpdated,
        activeWorkspaceId,
        workspaceBudgets,
        convertedWorkspaceBudgets,
        setWorkspaceBudget,
        privacyMode,
        setPrivacyMode,
        isPrivacyHidden,
        togglePrivacyHidden,
        setActiveWorkspaceIdWithCache
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
