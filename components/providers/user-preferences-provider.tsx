'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type Currency = 'USD' | 'EUR';

interface UserPreferencesContextType {
    currency: Currency;
    setCurrency: (currency: Currency) => void;
    formatCurrency: (amount: number) => string;
    refreshPreferences: () => Promise<void>;
}

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined);

export function UserPreferencesProvider({ children }: { children: React.ReactNode }) {
    const [currency, setCurrencyState] = useState<Currency>('USD');
    const [loading, setLoading] = useState(true);

    const refreshPreferences = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('profiles')
                .select('currency')
                .eq('id', user.id)
                .single();

            if (data?.currency) {
                setCurrencyState(data.currency as Currency);
            }
        } catch (error) {
            console.error('Error fetching preferences:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshPreferences();

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
                    if (payload.new && (payload.new as any).currency) {
                        setCurrencyState((payload.new as any).currency as Currency);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const setCurrency = async (newCurrency: Currency) => {
        // Optimistic update
        setCurrencyState(newCurrency);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('profiles')
                .update({ currency: newCurrency })
                .eq('id', user.id);

            if (error) throw error;

        } catch (error) {
            console.error('Error updating currency:', error);
            toast.error('Failed to update currency preference');
            // Revert on error
            refreshPreferences();
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat(currency === 'EUR' ? 'de-DE' : 'en-US', {
            style: 'currency',
            currency: currency,
        }).format(amount);
    };

    return (
        <UserPreferencesContext.Provider value={{ currency, setCurrency, formatCurrency, refreshPreferences }}>
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
