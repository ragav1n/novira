import { useState } from 'react';
import { format } from 'date-fns';
import { toast } from '@/utils/haptics';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { TransactionService } from '@/lib/services/transaction-service';
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

        const idempotencyKey = crypto.randomUUID();
        setLoading(true);
        try {
            if (!userId) {
                toast.error('You must be logged in');
                router.push('/signin');
                return;
            }

            let exchangeRate = await TransactionService.getExchangeRate(txCurrency, currency, date);
            let convertedAmount = parseFloat(amount) * exchangeRate;

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
                idempotency_key: idempotencyKey,
                ...(placeName ? {
                    place_name: placeName,
                    place_address: placeAddress,
                    place_lat: placeLat,
                    place_lng: placeLng,
                } : {})
            };

            let splitRecordsToInsert: any[] | undefined = undefined;

            if (isSplitEnabled) {
                let debtors: string[] = [];
                if (selectedGroupId) {
                    const { data: members } = await TransactionService.getGroupMembers(selectedGroupId);
                    if (!members || members.length === 0) {
                        toast.error('No group members found to split with');
                        setLoading(false);
                        return;
                    }
                    debtors = members.map((m: any) => m.user_id).filter((id: string) => id !== userId);
                } else {
                    debtors = selectedFriendIds;
                }

                if (debtors.length > 0) {
                    if (splitMode === 'custom') {
                        const totalCustom = debtors.reduce((sum, id) => sum + (parseFloat(customAmounts[id] || '0') || 0), 0);
                        if (totalCustom <= 0) {
                            toast.error('Please enter split amounts');
                            setLoading(false);
                            return;
                        }
                        if (totalCustom > parseFloat(amount)) {
                            toast.error('Split amounts exceed the total expense');
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
                        bucket_id: selectedBucketId,
                        ...(placeName ? {
                            place_name: placeName,
                            place_address: placeAddress,
                            place_lat: placeLat,
                            place_lng: placeLng,
                        } : {})
                    }
                };
            }

            const result = await TransactionService.createTransaction({
                transaction: transactionRecord,
                splits: splitRecordsToInsert,
                recurring: recurringRecordToInsert
            });

            if (result.success) {
                if (isNative) {
                    Haptics.notification({ type: result.offline ? NotificationType.Warning : NotificationType.Success }).catch(() => { });
                }
                if (result.offline) {
                    toast('Saved — will sync when online', {
                        icon: '☁️',
                        style: { background: 'rgba(14, 165, 233, 0.1)', border: '1px solid rgba(14, 165, 233, 0.2)', color: '#38BDF8' }
                    });
                } else {
                    toast.success('Expense added successfully!');
                }
                
                resetForm();
                sessionStorage.setItem('novira_expense_added', 'true');
                window.dispatchEvent(new Event('novira:expense-added'));
                router.push('/');
            }

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
