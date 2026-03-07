import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { toast } from '@/utils/haptics';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { enqueueMutation } from '@/lib/sync-manager';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

interface ExpenseSubmissionParams {
    userId: string | null | undefined;
    isNative: boolean;
    router: AppRouterInstance;
    currency: string;
    resetForm: () => void;
    // Form State
    amount: string;
    description: string;
    date: Date | undefined;
    selectedCategory: string;
    txCurrency: string;
    selectedGroupId: string | null;
    selectedBucketId: string | null;
    excludeFromAllowance: boolean;
    placeName: string | null;
    placeAddress: string | null;
    placeLat: number | null;
    placeLng: number | null;
    paymentMethod: string;
    notes: string;
    // Split State
    isSplitEnabled: boolean;
    selectedFriendIds: string[];
    splitMode: 'even' | 'custom';
    customAmounts: Record<string, string>;
    // Recurring State
    isRecurring: boolean;
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
}

export function useExpenseSubmission() {
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (params: ExpenseSubmissionParams) => {
        const {
            userId, isNative, router, currency, resetForm,
            amount, description, date, selectedCategory, txCurrency,
            selectedGroupId, selectedBucketId, excludeFromAllowance,
            placeName, placeAddress, placeLat, placeLng,
            paymentMethod, notes, isSplitEnabled, selectedFriendIds,
            splitMode, customAmounts, isRecurring, frequency
        } = params;

        if (!amount || parseFloat(amount) <= 0 || !description || !date) {
            if (amount && parseFloat(amount) <= 0) {
                toast.error('Amount must be greater than 0');
                return;
            }
            toast.error('Please fill in all required fields');
            return;
        }

        setLoading(true);
        try {
            if (!userId) {
                toast.error('You must be logged in');
                router.push('/signin');
                return;
            }

            let exchangeRate = 1;
            let convertedAmount = parseFloat(amount);

            if (txCurrency !== currency) {
                const FRANKFURTER_SUPPORTED = [
                    'AUD', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK', 'EUR', 'GBP', 'HKD',
                    'HUF', 'IDR', 'ILS', 'INR', 'ISK', 'JPY', 'KRW', 'MXN', 'MYR', 'NOK',
                    'NZD', 'PHP', 'PLN', 'RON', 'SEK', 'SGD', 'THB', 'TRY', 'USD', 'ZAR'
                ];

                try {
                    const dateStr = format(date, 'yyyy-MM-dd');
                    let rate: number | null = null;

                    // Step 1: Try Frankfurter for historical records (if supported)
                    if (FRANKFURTER_SUPPORTED.includes(txCurrency) && FRANKFURTER_SUPPORTED.includes(currency)) {
                        const response = await fetch(`https://api.frankfurter.dev/v1/${dateStr}?from=${txCurrency}&to=${currency}`);
                        if (response.ok) {
                            const data = await response.json();
                            rate = data.rates[currency];
                        }
                    }

                    // Step 2: Fallback to ExchangeRate-API (for TWD, VND or if Frankfurter fails)
                    if (!rate) {
                        const API_KEY = process.env.NEXT_PUBLIC_EXCHANGERATE_API_KEY;
                        if (API_KEY) {
                            const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr;
                            const url = isToday
                                ? `https://v6.exchangerate-api.com/v6/${API_KEY}/latest/${txCurrency}`
                                : `https://v6.exchangerate-api.com/v6/${API_KEY}/history/${txCurrency}/${format(date, 'yyyy/MM/dd')}`;

                            const response = await fetch(url);
                            if (response.ok) {
                                const data = await response.json();
                                rate = isToday ? data.conversion_rates[currency] : data.conversion_rate;
                            }
                        }
                    }

                    if (rate) {
                        exchangeRate = rate;
                        convertedAmount = parseFloat(amount) * exchangeRate;
                    }
                } catch (e) {
                    console.error('Error fetching historical rate:', e);
                }
            }

            const transactionRecord = {
                user_id: userId,
                amount: parseFloat(amount),
                description,
                category: selectedCategory,
                date: format(date, 'yyyy-MM-dd'),
                payment_method: paymentMethod,
                notes,
                currency: txCurrency,
                group_id: selectedGroupId,
                bucket_id: selectedBucketId,
                exchange_rate: exchangeRate,
                base_currency: currency,
                converted_amount: convertedAmount,
                is_recurring: isRecurring,
                exclude_from_allowance: excludeFromAllowance,
                ...(placeName ? {
                    place_name: placeName,
                    place_address: placeAddress,
                    place_lat: placeLat,
                    place_lng: placeLng,
                } : {})
            };

            let splitRecordsToInsert = null;

            if (isSplitEnabled) {
                let debtors: string[] = [];
                if (selectedGroupId) {
                    const { data: members } = await supabase
                        .from('group_members')
                        .select('user_id')
                        .eq('group_id', selectedGroupId);

                    if (members) {
                        debtors = members.map(m => m.user_id).filter(id => id !== userId);
                    }
                } else {
                    debtors = selectedFriendIds;
                }

                if (debtors.length > 0) {
                    if (splitMode === 'custom') {
                        const totalCustom = debtors.reduce((sum, id) => sum + (parseFloat(customAmounts[id] || '0') || 0), 0);
                        if (totalCustom <= 0 || totalCustom > parseFloat(amount)) {
                            toast.error(totalCustom <= 0 ? 'Please enter split amounts' : 'Split amounts exceed total expense');
                            setLoading(false);
                            return;
                        }
                        splitRecordsToInsert = debtors
                            .filter(debtorId => parseFloat(customAmounts[debtorId] || '0') > 0)
                            .map(debtorId => ({
                                user_id: debtorId,
                                amount: parseFloat(customAmounts[debtorId]),
                                is_paid: false
                            }));
                    } else {
                        const splitAmount = parseFloat(amount) / (debtors.length + 1);
                        splitRecordsToInsert = debtors.map(debtorId => ({
                            user_id: debtorId,
                            amount: splitAmount,
                            is_paid: false
                        }));
                    }
                }
            }

            let recurringRecordToInsert = null;
            if (isRecurring) {
                const nextDate = new Date(date);
                if (frequency === 'daily') nextDate.setDate(nextDate.getDate() + 1);
                else if (frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
                else if (frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
                else if (frequency === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);

                recurringRecordToInsert = {
                    user_id: userId,
                    description,
                    amount: parseFloat(amount),
                    category: selectedCategory,
                    currency: txCurrency,
                    group_id: selectedGroupId,
                    payment_method: paymentMethod,
                    frequency,
                    next_occurrence: format(nextDate, 'yyyy-MM-dd'),
                    exclude_from_allowance: excludeFromAllowance,
                    metadata: {
                        is_split: isSplitEnabled,
                        friend_ids: selectedFriendIds,
                        notes,
                        bucket_id: selectedBucketId
                    }
                };
            }

            const resetFormAndNavigate = () => {
                resetForm();
                sessionStorage.setItem('novira_expense_added', 'true');
                window.dispatchEvent(new Event('novira:expense-added'));
                router.push('/');
            };

            // OFFLINE GUARD
            if (!navigator.onLine) {
                await enqueueMutation('ADD_FULL_TRANSACTION', {
                    transaction: transactionRecord,
                    splitRecords: splitRecordsToInsert,
                    recurringRecord: recurringRecordToInsert
                });
                if (isNative) {
                    Haptics.notification({ type: NotificationType.Warning }).catch(() => { });
                }
                toast('Saved — will sync when online', {
                    icon: '☁️',
                    style: { background: 'rgba(14, 165, 233, 0.1)', border: '1px solid rgba(14, 165, 233, 0.2)', color: '#38BDF8' }
                });
                resetFormAndNavigate();
                return;
            }

            // ONLINE FLOW
            const { data: transaction, error: txError } = await supabase.from('transactions').insert(transactionRecord).select().single();
            if (txError) throw txError;

            if (splitRecordsToInsert && splitRecordsToInsert.length > 0) {
                const finalSplits = splitRecordsToInsert.map(s => ({ ...s, transaction_id: transaction.id }));
                const { error: splitError } = await supabase.from('splits').insert(finalSplits);
                if (splitError) throw splitError;
            }

            if (recurringRecordToInsert) {
                const { error: recurringError } = await supabase.from('recurring_templates').insert(recurringRecordToInsert);
                if (recurringError) throw recurringError;
            }

            if (isNative) {
                Haptics.notification({ type: NotificationType.Success }).catch(() => { });
            }
            toast.success('Expense added successfully!');
            resetFormAndNavigate();

        } catch (error: any) {
            if (isNative) {
                Haptics.notification({ type: NotificationType.Error }).catch(() => { });
            }
            toast.error('Failed to add expense: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return { handleSubmit, loading };
}
