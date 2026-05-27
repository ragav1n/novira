import { useRef, useState } from 'react';
import { format } from 'date-fns';
import { toast } from '@/utils/haptics';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { TransactionService } from '@/lib/services/transaction-service';
import { TripService } from '@/lib/services/trip-service';
import { invalidateTransactionCaches } from '@/lib/sw-cache';
import { uploadReceipt, validateReceiptFile } from '@/lib/receipt-storage';
import { supabase } from '@/lib/supabase';
import { useActiveTrip } from '@/components/providers/active-trip-provider';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import type { Transaction, TransactionRecord, SplitRecord, RecurringRecord } from '@/types/transaction';
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

// Network blips, cold sessions, and load-balancer hiccups are the most common
// reasons a first submit fails. The atomic RPC dedupes by `idempotency_key`,
// so a single retry on transport-layer errors is safe — Postgres constraint
// failures, RLS denials, and explicit RAISEs surface user-meaningful errors
// and must NOT be retried (the user needs to see them).
function isTransientError(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const e = err as { message?: string; code?: string; details?: string; name?: string };
    if (e.name === 'QueueFullError') return false;
    if (e.code) {
        const c = String(e.code);
        if (c.startsWith('23') || c.startsWith('42') || c.startsWith('P0')) return false;
        if (c.startsWith('PGRST') && !e.details) return true;
    }
    const msg = String(e.message || '').toLowerCase();
    if (e.name === 'TypeError' && /fetch|network|load failed/.test(msg)) return true;
    if (/timeout|abort/.test(msg)) return true;
    return false;
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
    // Locked once a submission has reached the navigation step. Guards the brief
    // window between clearing the loading spinner and the page actually unmounting
    // — without it a determined double-tap could re-enter handleSubmit.
    const submittedRef = useRef(false);

    const handleSubmit = async (params: ExpenseSubmissionParams) => {
        if (submittedRef.current) return;
        const {
            userId, isNative, router, currency, resetForm, userProfile,
            amount, description, date, selectedCategory, txCurrency,
            selectedGroupId, selectedBucketId, excludeFromAllowance,
            placeName, placeAddress, placeLat, placeLng,
            paymentMethod, notes, tags, isSplitEnabled, selectedFriendIds,
            splitMode, customAmounts, isRecurring, frequency,
            isIncome = false, receiptFile, selectedAccountId,
        } = params;

        if (!validateExpenseForm(amount, description, date)) return;
        if (receiptFile) {
            const v = validateReceiptFile(receiptFile);
            if (!v.valid) {
                toast.error(v.reason);
                return;
            }
        }

        const idempotencyKey = crypto.randomUUID();
        setLoading(true);
        try {
            // Warm the auth session before the RPC fires. On a freshly opened app
            // the token can still be mid-refresh; calling getSession() forces the
            // SDK to resolve that race before create_transaction_atomic. Cheap when
            // already warm (~10ms), pays off on the cold "first submit fails" case.
            // Inside the try so the spinner is already visible during the warm-up.
            try {
                await supabase.auth.getSession();
            } catch {
                // Non-fatal — downstream errors will surface real auth problems.
            }

            if (!userId) {
                toast.error('You must be logged in');
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
            // in parallel so a cold network only hits one wall-clock wait.
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
                setLoading(false);
                return;
            }

            const recurringRecordToInsert = isRecurring
                ? buildRecurringRecord(userId, description, amount, selectedCategory, txCurrency, selectedGroupId, paymentMethod, frequency, date!, excludeFromAllowance, isSplitEnabled, selectedFriendIds, notes, selectedBucketId, placeName, placeAddress, placeLat, placeLng, cleanTags, isIncome)
                : null;

            const createPayload = {
                transaction: transactionRecord,
                splits: splitResult.records,
                recurring: recurringRecordToInsert,
                offlineReceiptFile: receiptFile ?? null,
            };
            let result;
            try {
                result = await TransactionService.createTransaction(createPayload);
            } catch (firstErr) {
                if (!isTransientError(firstErr)) throw firstErr;
                await new Promise(r => setTimeout(r, 600));
                result = await TransactionService.createTransaction(createPayload);
            }

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
                    toast.success('Expense added successfully!');
                }

                // Receipt storage was full while offline — the row queues but the
                // file is dropped. Warn the user so they can re-attach later.
                if (result.offline && receiptFile && result.receiptDropped) {
                    toast("Receipt storage is full — attach again once synced.", {
                        icon: '⚠️',
                        style: { background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', color: '#FBBF24' }
                    });
                }

                const typedResult = result as { data?: { id?: string }; idempotent?: boolean };
                const createdId = typedResult.data?.id;

                resetForm();
                if (!result.offline) {
                    invalidateTransactionCaches();

                    // Stash the just-created row so the dashboard can render it
                    // immediately on mount, before its network fetch returns. Realtime
                    // and the mount-time refetch will reconcile by id. Receipt path is
                    // intentionally undefined here — the background upload below will
                    // patch it and the Realtime UPDATE listener will swap the row in.
                    // Skip on idempotent retries — the row is already on the server
                    // and likely already shown elsewhere; re-stashing risks visual churn.
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
                            account_id: transactionRecord.account_id ?? undefined,
                            receipt_path: undefined,
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

                // Navigate immediately. Receipt upload, split broadcasts, and Web
                // Push fan-out happen in the background — the user sees the
                // dashboard with the optimistic row right away. submittedRef locks
                // re-entry during the brief gap between clearing the spinner and
                // the page actually unmounting.
                submittedRef.current = true;
                setLoading(false);
                router.push('/');

                if (!result.offline) {
                    void (async () => {
                        // Receipt upload — the row already exists on the server,
                        // so we patch receipt_path after the file lands. Realtime
                        // UPDATE on the dashboard picks up the change automatically.
                        if (receiptFile && createdId && !typedResult.idempotent) {
                            try {
                                const { path } = await uploadReceipt(userId, createdId, receiptFile);
                                const { error: updErr } = await supabase
                                    .from('transactions')
                                    .update({ receipt_path: path })
                                    .eq('id', createdId);
                                if (updErr) throw updErr;
                            } catch (uploadErr) {
                                console.error('[useExpenseSubmission] receipt upload failed', uploadErr);
                                toast('Expense saved, but receipt upload failed. Re-attach from the transaction details.', {
                                    icon: '⚠️',
                                    style: { background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', color: '#FBBF24' }
                                });
                            }
                        }

                        // Notify each split participant in real time. Postgres-changes on
                        // `splits` isn't reliable for the receiving user (publication / RLS
                        // quirks), so a broadcast guarantees their "You owe / owed" tiles
                        // update without a refresh.
                        if (splitResult.records && splitResult.records.length > 0) {
                            for (const split of splitResult.records) {
                                if (!split.user_id || split.user_id === userId) continue;
                                const ch = supabase.channel(`split-notify-${split.user_id}`);
                                // Track terminal-state cleanup. SUBSCRIBED fires the broadcast and
                                // disposes after `.send` settles; CHANNEL_ERROR / TIMED_OUT / CLOSED
                                // dispose immediately. A 5s safety timer guarantees the channel is
                                // freed even if no status callback fires (rare socket quirks).
                                let disposed = false;
                                const dispose = () => {
                                    if (disposed) return;
                                    disposed = true;
                                    clearTimeout(safety);
                                    supabase.removeChannel(ch);
                                };
                                const safety = setTimeout(dispose, 5000);
                                ch.subscribe((status) => {
                                    if (status === 'SUBSCRIBED') {
                                        ch.send({
                                            type: 'broadcast',
                                            event: 'split-added',
                                            payload: { fromUserId: userId },
                                        }).finally(dispose);
                                    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
                                        dispose();
                                    }
                                });
                            }

                            // The broadcast above only reaches debtors whose app is open.
                            // Fire a Web Push fan-out so closed apps still get a notification.
                            if (createdId) {
                                fetch('/api/push/notify-split', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ transaction_id: createdId }),
                                    credentials: 'same-origin',
                                }).catch(() => { /* best-effort */ });
                            }
                        }
                    })();
                }
            }

        } catch (error) {
            // Allow the user to retry after a failure — the submission lock only
            // applies when we've successfully navigated.
            submittedRef.current = false;
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
