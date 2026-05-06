import { useState } from 'react';
import { format } from 'date-fns';
import { toast } from '@/utils/haptics';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { TransactionService } from '@/lib/services/transaction-service';
import { invalidateTransactionCaches } from '@/lib/sw-cache';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { Transaction, TransactionRecord, SplitRecord, RecurringRecord } from '@/types/transaction';

interface ExpenseSubmissionParams {
    userId: string | null | undefined;
    isNative: boolean;
    router: AppRouterInstance;
    currency: string;
    resetForm: () => void;
    userProfile?: { full_name: string; avatar_url?: string };
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
    tags: string[];
    // Split State
    isSplitEnabled: boolean;
    selectedFriendIds: string[];
    splitMode: 'even' | 'custom';
    customAmounts: Record<string, string>;
    // Recurring State
    isRecurring: boolean;
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    isIncome?: boolean;
}

export type ExpenseFormErrors = {
    amount?: string;
    description?: string;
    date?: string;
};

export function getExpenseFormErrors(amount: string, description: string, date: Date | undefined): ExpenseFormErrors | null {
    const errors: ExpenseFormErrors = {};
    const parsed = parseFloat(amount);
    if (!amount) errors.amount = 'Amount is required';
    else if (isNaN(parsed)) errors.amount = 'Amount must be a number';
    else if (parsed <= 0) errors.amount = 'Amount must be greater than 0';
    else if (parsed > 999_999_999) errors.amount = 'Amount is too large';

    const trimmed = description?.trim();
    if (!trimmed) errors.description = 'Description is required';
    else if (trimmed.length > 300) errors.description = 'Description is too long (max 300 chars)';
    if (!date) errors.date = 'Date is required';

    return Object.keys(errors).length > 0 ? errors : null;
}

function validateExpenseForm(amount: string, description: string, date: Date | undefined): boolean {
    const errors = getExpenseFormErrors(amount, description, date);
    if (!errors) return true;
    // Submit-time backstop — surface the first error as a toast for callers that don't
    // render inline messages. Forms with inline feedback should call getExpenseFormErrors
    // directly before invoking handleSubmit.
    toast.error(errors.amount || errors.description || errors.date || 'Please fill in all required fields');
    return false;
}

async function buildSplitRecords(
    amount: string,
    userId: string,
    isSplitEnabled: boolean,
    selectedGroupId: string | null,
    selectedFriendIds: string[],
    splitMode: 'even' | 'custom',
    customAmounts: Record<string, string>
): Promise<{ records: SplitRecord[] | undefined; error?: string }> {
    if (!isSplitEnabled) return { records: undefined };

    let debtors: string[] = [];
    if (selectedGroupId) {
        const { data: members } = await TransactionService.getGroupMembers(selectedGroupId);
        if (!members || members.length === 0) {
            return { records: undefined, error: 'No group members found to split with' };
        }
        debtors = (members as { user_id: string }[]).map(m => m.user_id).filter(id => id !== userId);
    } else {
        debtors = selectedFriendIds;
    }

    if (debtors.length === 0) return { records: undefined };

    if (splitMode === 'custom') {
        const parsedSplits = debtors.map(id => ({ id, amount: parseFloat(customAmounts[id] || '0') }));
        if (parsedSplits.some(s => Number.isNaN(s.amount) || s.amount < 0)) {
            return { records: undefined, error: 'Split amounts must be non-negative numbers' };
        }
        const totalCustom = parsedSplits.reduce((sum, s) => sum + s.amount, 0);
        if (totalCustom <= 0) return { records: undefined, error: 'Please enter split amounts' };
        if (totalCustom > parseFloat(amount)) return { records: undefined, error: 'Split amounts exceed the total expense' };

        return {
            records: parsedSplits
                .filter(s => s.amount > 0)
                .map(s => ({ user_id: s.id, amount: s.amount }))
        };
    } else {
        const splitAmount = parseFloat(amount) / (debtors.length + 1);
        return { records: debtors.map(id => ({ user_id: id, amount: splitAmount })) };
    }
}

function buildRecurringRecord(
    userId: string,
    description: string,
    amount: string,
    selectedCategory: string,
    txCurrency: string,
    selectedGroupId: string | null,
    paymentMethod: string,
    frequency: RecurringRecord['frequency'],
    date: Date,
    excludeFromAllowance: boolean,
    isSplitEnabled: boolean,
    selectedFriendIds: string[],
    notes: string,
    selectedBucketId: string | null,
    placeName: string | null,
    placeAddress: string | null,
    placeLat: number | null,
    placeLng: number | null,
    tags: string[],
    isIncome: boolean,
): RecurringRecord {
    const intendedDay = date.getDate();
    const nextDate = new Date(date);
    if (frequency === 'daily') {
        nextDate.setDate(nextDate.getDate() + 1);
    } else if (frequency === 'weekly') {
        nextDate.setDate(nextDate.getDate() + 7);
    } else if (frequency === 'monthly') {
        // JS setMonth overflows short months (e.g. Jan 31 → Mar 3).
        // Fix: step to the 1st, advance the month, then clamp to intended day.
        nextDate.setDate(1);
        nextDate.setMonth(nextDate.getMonth() + 1);
        const lastDayOfMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
        nextDate.setDate(Math.min(intendedDay, lastDayOfMonth));
    } else if (frequency === 'yearly') {
        nextDate.setFullYear(nextDate.getFullYear() + 1);
    }

    return {
        user_id: userId,
        description,
        amount: parseFloat(amount),
        category: selectedCategory,
        currency: txCurrency,
        group_id: selectedGroupId,
        payment_method: paymentMethod,
        frequency,
        next_occurrence: format(nextDate, 'yyyy-MM-dd'),
        intended_day: intendedDay,
        exclude_from_allowance: excludeFromAllowance,
        is_income: isIncome,
        metadata: {
            is_split: isSplitEnabled && !isIncome,
            friend_ids: isIncome ? [] : selectedFriendIds,
            notes,
            bucket_id: selectedBucketId,
            ...(tags.length ? { tags } : {}),
            ...(placeName ? { place_name: placeName, place_address: placeAddress, place_lat: placeLat, place_lng: placeLng } : {})
        }
    };
}

export function useExpenseSubmission() {
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (params: ExpenseSubmissionParams) => {
        const {
            userId, isNative, router, currency, resetForm, userProfile,
            amount, description, date, selectedCategory, txCurrency,
            selectedGroupId, selectedBucketId, excludeFromAllowance,
            placeName, placeAddress, placeLat, placeLng,
            paymentMethod, notes, tags, isSplitEnabled, selectedFriendIds,
            splitMode, customAmounts, isRecurring, frequency,
            isIncome = false,
        } = params;

        if (!validateExpenseForm(amount, description, date)) return;

        const idempotencyKey = crypto.randomUUID();
        setLoading(true);
        try {
            if (!userId) {
                toast.error('You must be logged in');
                router.push('/signin');
                return;
            }

            const exchangeRate = await TransactionService.getExchangeRate(txCurrency, currency, date!);
            const convertedAmount = parseFloat(amount) * exchangeRate;

            const cleanTags = Array.from(new Set(
                tags.map(t => t.trim()).filter(t => t.length > 0 && t.length <= 32)
            )).slice(0, 12);

            const transactionRecord: TransactionRecord = {
                user_id: userId,
                amount: parseFloat(amount),
                description,
                category: selectedCategory,
                date: format(date!, 'yyyy-MM-dd'),
                payment_method: paymentMethod,
                notes,
                currency: txCurrency,
                group_id: selectedGroupId,
                bucket_id: selectedBucketId,
                exchange_rate: exchangeRate,
                base_currency: currency,
                converted_amount: convertedAmount,
                is_recurring: isRecurring,
                is_income: isIncome,
                exclude_from_allowance: excludeFromAllowance,
                idempotency_key: idempotencyKey,
                tags: cleanTags,
                ...(placeName ? { place_name: placeName, place_address: placeAddress, place_lat: placeLat, place_lng: placeLng } : {})
            };

            // Income can't be split — they're personal earnings, not shared expenses.
            const splitResult: { records?: SplitRecord[]; error?: string } = isIncome
                ? { records: undefined }
                : await buildSplitRecords(amount, userId, isSplitEnabled, selectedGroupId, selectedFriendIds, splitMode, customAmounts);
            if (splitResult.error) {
                toast.error(splitResult.error);
                setLoading(false);
                return;
            }

            const recurringRecordToInsert = isRecurring
                ? buildRecurringRecord(userId, description, amount, selectedCategory, txCurrency, selectedGroupId, paymentMethod, frequency, date!, excludeFromAllowance, isSplitEnabled, selectedFriendIds, notes, selectedBucketId, placeName, placeAddress, placeLat, placeLng, cleanTags, isIncome)
                : null;

            const result = await TransactionService.createTransaction({
                transaction: transactionRecord,
                splits: splitResult.records,
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
                if (!result.offline) {
                    invalidateTransactionCaches();

                    // Stash the just-created row so the dashboard can render it
                    // immediately on mount, before its network fetch returns. Realtime
                    // and the mount-time refetch will reconcile by id.
                    // Skip on idempotent retries — the row is already on the server
                    // and likely already shown elsewhere; re-stashing risks visual churn.
                    const typedResult = result as { data?: { id?: string }; idempotent?: boolean };
                    const createdId = typedResult.data?.id;
                    if (!typedResult.idempotent && createdId && typeof sessionStorage !== 'undefined') {
                        const stashed: Transaction = {
                            id: createdId,
                            description: transactionRecord.description,
                            amount: transactionRecord.amount,
                            category: transactionRecord.category,
                            date: transactionRecord.date,
                            created_at: new Date().toISOString(),
                            user_id: transactionRecord.user_id,
                            currency: transactionRecord.currency,
                            exchange_rate: transactionRecord.exchange_rate,
                            base_currency: transactionRecord.base_currency,
                            converted_amount: transactionRecord.converted_amount,
                            is_recurring: transactionRecord.is_recurring,
                            bucket_id: transactionRecord.bucket_id ?? undefined,
                            exclude_from_allowance: transactionRecord.exclude_from_allowance,
                            payment_method: transactionRecord.payment_method,
                            place_name: transactionRecord.place_name,
                            place_address: transactionRecord.place_address ?? undefined,
                            place_lat: transactionRecord.place_lat ?? undefined,
                            place_lng: transactionRecord.place_lng ?? undefined,
                            tags: transactionRecord.tags,
                            group_id: transactionRecord.group_id,
                            splits: (splitResult.records ?? []).map(s => ({ user_id: s.user_id, amount: s.amount })),
                            profile: userProfile,
                        };
                        try {
                            sessionStorage.setItem('novira_just_created_tx', JSON.stringify(stashed));
                        } catch {
                            // sessionStorage quota or serialization error — non-fatal
                        }
                    }
                }
                sessionStorage.setItem('novira_expense_added', 'true');
                window.dispatchEvent(new Event('novira:expense-added'));
                router.push('/');
            }

        } catch (error: any) {
            if (isNative) {
                Haptics.notification({ type: NotificationType.Error }).catch(() => { });
            }
            if (error?.name === 'QueueFullError') {
                toast.error(error.message);
            } else {
                toast.error('Failed to add expense: ' + error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return { handleSubmit, loading };
}
