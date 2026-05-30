import { useRef, useState } from 'react';
import { format } from 'date-fns';
import { toast } from '@/utils/haptics';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { TransactionService } from '@/lib/services/transaction-service';
import { TripService } from '@/lib/services/trip-service';
import { invalidateTransactionCaches } from '@/lib/sw-cache';
import { validateReceiptFile } from '@/lib/receipt-storage';
import { useActiveTrip } from '@/components/providers/active-trip-provider';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { TransactionRecord, SplitRecord, RecurringRecord } from '@/types/transaction';
import { getErrorMessage, getErrorName } from '@/lib/error-utils';

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
    // Receipt attach (optional). Uploaded after the tx row is created.
    receiptFile?: File | Blob | null;
    // Source account. If unset, the DB BEFORE-INSERT trigger falls back to the
    // user's primary account so we never lose the assignment.
    selectedAccountId?: string | null;
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
    const { activeTrip } = useActiveTrip();
    const { activeWorkspaceId } = useUserPreferences();
    // Synchronous re-entry guard. Set before the first await so a fast double-tap
    // can't slip a second submit through the window before React commits the
    // disabled button. Cleared on every pre-navigation early return; left locked
    // on the success path since the page unmounts on navigation.
    const inFlightRef = useRef(false);

    const handleSubmit = async (params: ExpenseSubmissionParams) => {
        if (inFlightRef.current) return;
        inFlightRef.current = true;
        const {
            userId, isNative, router, currency, resetForm,
            amount, description, date, selectedCategory, txCurrency,
            selectedGroupId, selectedBucketId, excludeFromAllowance,
            placeName, placeAddress, placeLat, placeLng,
            paymentMethod, notes, tags, isSplitEnabled, selectedFriendIds,
            splitMode, customAmounts, isRecurring, frequency,
            isIncome = false, receiptFile, selectedAccountId,
        } = params;

        if (!validateExpenseForm(amount, description, date)) {
            inFlightRef.current = false;
            return;
        }
        if (receiptFile) {
            const v = validateReceiptFile(receiptFile);
            if (!v.valid) {
                toast.error(v.reason);
                inFlightRef.current = false;
                return;
            }
        }

        const idempotencyKey = crypto.randomUUID();
        setLoading(true);
        try {
            if (!userId) {
                toast.error('You must be logged in');
                inFlightRef.current = false;
                router.push('/signin');
                return;
            }

            // Auto-append active-trip tag when the transaction date falls within
            // an active trip. The cached `activeTrip` is scoped to the current
            // workspace, so only trust it when this transaction is being filed
            // there AND the date is today; otherwise re-fetch with the right scope.
            const isToday = date && format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
            const sameWorkspace = (selectedGroupId ?? null) === (activeWorkspaceId ?? null);
            // Trip resolution and exchange-rate lookup are independent — run them
            // in parallel. Both are instant in the common case (same-currency rate
            // is 1, cached rates hit localStorage, today's trip is already cached).
            const tripPromise = isToday && sameWorkspace
                ? Promise.resolve(activeTrip?.auto_tag_enabled ? activeTrip : null)
                : TripService.getActiveTripForDate(userId, date!, selectedGroupId);
            const [exchangeRate, tripForDate] = await Promise.all([
                TransactionService.getExchangeRate(txCurrency, currency, date!),
                tripPromise,
            ]);
            const convertedAmount = parseFloat(amount) * exchangeRate;

            const mergedTags = [...tags];
            if (tripForDate?.auto_tag_enabled && !mergedTags.includes(tripForDate.slug)) {
                mergedTags.push(tripForDate.slug);
            }

            const cleanTags = Array.from(new Set(
                mergedTags.map(t => t.trim()).filter(t => t.length > 0 && t.length <= 32)
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
                account_id: selectedAccountId ?? null,
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
                inFlightRef.current = false;
                setLoading(false);
                return;
            }

            const recurringRecordToInsert = isRecurring
                ? buildRecurringRecord(userId, description, amount, selectedCategory, txCurrency, selectedGroupId, paymentMethod, frequency, date!, excludeFromAllowance, isSplitEnabled, selectedFriendIds, notes, selectedBucketId, placeName, placeAddress, placeLat, placeLng, cleanTags, isIncome)
                : null;

            // Queue the write and navigate immediately. The atomic RPC, receipt
            // upload, and split notifications all run in the background via the
            // sync loop (which starts instantly when online). The dashboard renders
            // the queued row optimistically and reconciles by id once it lands.
            const result = await TransactionService.queueTransaction({
                transaction: transactionRecord,
                splits: splitResult.records,
                recurring: recurringRecordToInsert,
                offlineReceiptFile: receiptFile ?? null,
            });

            if (result.success) {
                if (isNative) {
                    Haptics.notification({ type: result.offline ? NotificationType.Warning : NotificationType.Success }).catch(() => { });
                }
                if (result.offline) {
                    const offlineMsg = receiptFile && !result.receiptDropped
                        ? 'Saved — receipt will upload after sync'
                        : 'Saved — will sync when online';
                    toast(offlineMsg, {
                        icon: '☁️',
                        style: { background: 'rgba(14, 165, 233, 0.1)', border: '1px solid rgba(14, 165, 233, 0.2)', color: '#38BDF8' }
                    });
                } else {
                    toast.success('Expense added');
                    invalidateTransactionCaches();
                }

                // Receipt storage was full — the row queues but the file is dropped.
                // Warn the user so they can re-attach later.
                if (result.receiptDropped && receiptFile) {
                    toast("Receipt storage is full — attach again once synced.", {
                        icon: '⚠️',
                        style: { background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', color: '#FBBF24' }
                    });
                }

                resetForm();
                sessionStorage.setItem('novira_expense_added', 'true');
                window.dispatchEvent(new Event('novira:expense-added'));
                // Leave inFlightRef locked — the page unmounts on navigation.
                setLoading(false);
                router.push('/');
            }
        } catch (error) {
            // Allow the user to retry after a failure.
            inFlightRef.current = false;
            if (isNative) {
                Haptics.notification({ type: NotificationType.Error }).catch(() => { });
            }
            const msg = getErrorMessage(error);
            if (getErrorName(error) === 'QueueFullError') {
                toast.error(msg);
            } else {
                toast.error('Failed to add expense: ' + msg);
            }
        } finally {
            setLoading(false);
        }
    };

    return { handleSubmit, loading };
}
