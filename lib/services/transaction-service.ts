import { supabase } from '../supabase';
import { Transaction } from '@/types/transaction';
import { enqueueMutation } from '../sync-manager';
import { toast } from '@/utils/haptics';
import { format } from 'date-fns';

const FRANKFURTER_SUPPORTED = [
    'AUD', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK', 'EUR', 'GBP', 'HKD',
    'HUF', 'IDR', 'ILS', 'INR', 'ISK', 'JPY', 'KRW', 'MXN', 'MYR', 'NOK',
    'NZD', 'PHP', 'PLN', 'RON', 'SEK', 'SGD', 'THB', 'TRY', 'USD', 'ZAR'
];

export const TransactionService = {
    /**
     * Fetch transactions for the current user or workspace.
     */
    async getTransactions(options: { 
        userId: string; 
        workspaceId?: string | null;
        limit?: number;
        startDate?: string;
        endDate?: string;
        bucketId?: string;
    }) {
        let query = supabase
            .from('transactions')
            .select(`
                *,
                splits (*),
                profile:profiles(full_name, avatar_url)
            `)
            .order('date', { ascending: false })
            .order('created_at', { ascending: false });

        if (options.workspaceId && options.workspaceId !== 'personal') {
            query = query.eq('group_id', options.workspaceId);
        } else if (options.workspaceId === 'personal') {
            query = query.is('group_id', null).eq('user_id', options.userId);
        } else {
            query = query.eq('user_id', options.userId);
        }

        if (options.bucketId) {
            query = query.eq('bucket_id', options.bucketId);
        }

        if (options.startDate) {
            query = query.gte('date', options.startDate);
        }

        if (options.endDate) {
            query = query.lt('date', options.endDate);
        }

        if (options.limit) {
            query = query.limit(options.limit);
        }

        const { data, error } = await query;
        if (error) {
            console.error('Error fetching transactions:', error);
            toast.error('Failed to load transactions');
            throw error;
        }

        return data as Transaction[];
    },

    async getExchangeRate(from: string, to: string, date: Date = new Date()): Promise<number> {
        if (from === to) return 1;

        const dateStr = format(date, 'yyyy-MM-dd');
        let rate: number | null = null;

        try {
            // Step 1: Try Frankfurter for historical records (if supported)
            if (FRANKFURTER_SUPPORTED.includes(from) && FRANKFURTER_SUPPORTED.includes(to)) {
                const response = await fetch(`https://api.frankfurter.dev/v1/${dateStr}?from=${from}&to=${to}`);
                if (response.ok) {
                    const data = await response.json();
                    rate = data.rates[to];
                }
            }

            // Step 2: Fallback to ExchangeRate-API
            if (!rate) {
                const API_KEY = process.env.NEXT_PUBLIC_EXCHANGERATE_API_KEY;
                if (API_KEY) {
                    const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr;
                    const url = isToday
                        ? `https://v6.exchangerate-api.com/v6/${API_KEY}/latest/${from}`
                        : `https://v6.exchangerate-api.com/v6/${API_KEY}/history/${from}/${format(date, 'yyyy/MM/dd')}`;

                    const response = await fetch(url);
                    if (response.ok) {
                        const data = await response.json();
                        rate = isToday ? data.conversion_rates[to] : data.conversion_rate;
                    }
                }
            }
        } catch (e) {
            console.error('Error fetching exchange rate:', e);
        }

        return rate || 1;
    },

    async createTransaction(params: {
        transaction: any;
        splits?: any[];
        recurring?: any;
    }) {
        const { transaction, splits, recurring } = params;

        // OFFLINE GUARD
        if (!navigator.onLine) {
            await enqueueMutation('ADD_FULL_TRANSACTION', {
                transaction,
                splitRecords: splits,
                recurringRecord: recurring
            });
            return { success: true, offline: true };
        }

        try {
            // Start transaction-like flow (manual sequence)
            const { data: tx, error: txError } = await supabase
                .from('transactions')
                .insert(transaction)
                .select()
                .single();

            if (txError) throw txError;

            if (splits && splits.length > 0) {
                const finalSplits = splits.map(s => ({ ...s, transaction_id: tx.id }));
                const { error: splitError } = await supabase
                    .from('splits')
                    .insert(finalSplits);
                if (splitError) throw splitError;
            }

            if (recurring) {
                const { error: recError } = await supabase
                    .from('recurring_templates')
                    .insert(recurring);
                if (recError) throw recError;
            }

            return { success: true, data: tx };
        } catch (error: any) {
            console.error('Error in createTransaction:', error);
            throw error;
        }
    },

    async getGroupMembers(groupId: string) {
        return supabase
            .from('group_members')
            .select('user_id')
            .eq('group_id', groupId);
    },

    /**
     * Delete a transaction with offline support.
     */
    async deleteTransaction(id: string) {
        try {
            await enqueueMutation('DELETE_TRANSACTION', { id });
            toast.success('Transaction deleted');
            return { success: true };
        } catch (error) {
            toast.error('Failed to delete transaction');
            throw error;
        }
    }
};
