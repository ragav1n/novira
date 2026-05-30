'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, CreditCard, Utensils, Car, Zap, ShoppingBag, HeartPulse, Clapperboard, Wallet, Banknote, HelpCircle, Calendar as CalendarIcon, Home, School, LayoutGrid, Building2, MapPin, Shirt, ShoppingCart, LocateFixed, ScanSearch, Sparkles, Camera, Image as ImageIcon, Plane, X, FileText, Loader2 } from 'lucide-react';
import UniqueLoading from '@/components/ui/grid-loading';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useIsNative } from '@/hooks/use-native';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FloatingLabelInput } from '@/components/ui/floating-label';
import { format, parseISO } from "date-fns";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TimePicker } from "@/components/ui/datetime-picker";
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { useGroups } from '@/components/providers/groups-provider';
import { useBucketsList } from '@/components/providers/buckets-provider';
import { Switch } from '@/components/ui/switch';
import { CurrencyDropdown } from '@/components/ui/currency-dropdown';
import dynamic from 'next/dynamic';

const LocationPicker = dynamic(
    () => import('@/components/ui/location-picker').then(mod => mod.LocationPicker),
    { ssr: false, loading: () => <div className="h-[72px] rounded-2xl bg-secondary/10 animate-pulse" /> }
);
const SplitExpenseSection = dynamic(
    () => import('./add-expense/split-expense-section').then(mod => mod.SplitExpenseSection),
    { ssr: false, loading: () => <div className="h-16 rounded-2xl bg-secondary/10 animate-pulse" /> }
);
const RecurringExpenseSection = dynamic(
    () => import('./add-expense/recurring-expense-section').then(mod => mod.RecurringExpenseSection),
    { ssr: false, loading: () => <div className="h-16 rounded-2xl bg-secondary/10 animate-pulse" /> }
);

import { CategorySelector, BucketSelector } from './add-expense/selectors';
import { useAccounts } from '@/components/providers/accounts-provider';
import { Landmark, PiggyBank, CreditCard as CardIcon, Smartphone, CircleDollarSign } from 'lucide-react';
import type { AccountType } from '@/types/account';
const ACCOUNT_TYPE_ICONS: Record<AccountType, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
    cash: Wallet,
    checking: Landmark,
    savings: PiggyBank,
    credit_card: CardIcon,
    digital_wallet: Smartphone,
    other: CircleDollarSign,
};
import { TagsSection } from './add-expense/tags-section';
import { useExpenseForm } from '@/hooks/useExpenseForm';
import { useExpenseSubmission, getExpenseFormErrors, type ExpenseFormErrors } from '@/hooks/useExpenseSubmission';
import { TransactionService } from '@/lib/services/transaction-service';
import { getDistance } from '@/lib/location';
import { takePendingSharedFile } from '@/lib/share-target';
import { validateReceiptFile } from '@/lib/receipt-storage';
import { toast } from '@/utils/haptics';

import { CATEGORY_COLORS, getIconForCategory, CATEGORIES as SYSTEM_CATEGORIES } from '@/lib/categories';
import { evaluateExpression } from '@/lib/expression-eval';
import { ExpressionKeypad } from '@/components/ui/expression-keypad';
import { isSpeechSupported, startDictation, type DictationHandle } from '@/lib/speech-to-text';
import { parseVoiceExpense, type ParsedVoiceExpense } from '@/lib/voice-expense-parser';
import type { GeocodedPlace } from '@/lib/geocode-place';
import { VoiceReviewModal } from './add-expense/voice-review-modal';
import { Mic, MicOff, Users } from 'lucide-react';
import { useRecentSplitPartner } from '@/hooks/useRecentSplitPartner';

const dropdownCategories = SYSTEM_CATEGORIES.map(cat => ({
    id: cat.id,
    label: cat.label,
    icon: (props: { className?: string }) => getIconForCategory(cat.id, props.className || "w-4 h-4", props),
    color: CATEGORY_COLORS[cat.id] || '#8A2BE2'
}));

const PAYMENT_METHOD_COLORS: Record<string, string> = {
    'Cash': '#22C55E',
    'UPI': '#F59E0B',
    'Debit Card': '#3B82F6',
    'Credit Card': '#A855F7',
    'Bank Transfer': '#06B6D4',
};

export function AddExpenseView() {
    const router = useRouter();
    const isNative = useIsNative();
    const { currency, userId, CURRENCY_SYMBOLS, activeWorkspaceId, fullName, avatarUrl, defaultCategory, defaultPaymentMethod, defaultBucketId } = useUserPreferences();
    const { groups, friends } = useGroups();
    const { buckets } = useBucketsList();
    const { accounts: allAccounts } = useAccounts();
    const activeAccounts = React.useMemo(() => allAccounts.filter(a => !a.archived_at), [allAccounts]);
    const [currentPos, setCurrentPos] = React.useState<{ lat: number, lng: number } | null>(null);

    const activeGroup = groups.find(g => g.id === activeWorkspaceId);
    const isSharedWorkspace = activeGroup?.type === 'couple' || activeGroup?.type === 'home';
    const defaultSplitEnabled = activeWorkspaceId ? !isSharedWorkspace : false;
    const recentSplitPartner = useRecentSplitPartner(userId);

    const formState = useExpenseForm(userId, currency, activeWorkspaceId, defaultSplitEnabled, {
        category: defaultCategory,
        paymentMethod: defaultPaymentMethod as 'Cash' | 'Debit Card' | 'Credit Card' | 'UPI' | 'Bank Transfer' | null,
        bucketId: defaultBucketId,
    });
    const searchParams = useSearchParams();

    // Calendar deep-link: ?recurring=1&date=YYYY-MM-DD pre-fills the form for
    // scheduling a recurring item on a specific day.
    const appliedDeepLinkRef = useRef(false);
    React.useEffect(() => {
        if (appliedDeepLinkRef.current || !searchParams) return;
        const wantsRecurring = searchParams.get('recurring') === '1';
        const dateParam = searchParams.get('date');
        const groupIdParam = searchParams.get('groupId');
        if (!wantsRecurring && !dateParam && !groupIdParam) return;
        appliedDeepLinkRef.current = true;
        if (wantsRecurring) formState.setIsRecurring(true);
        if (dateParam) {
            const parsed = parseISO(dateParam);
            if (!isNaN(parsed.getTime())) formState.setDate(parsed);
        }
        if (groupIdParam) {
            formState.setIsSplitEnabled(true);
            formState.setSelectedGroupId(groupIdParam);
        }
    }, [searchParams, formState]);
    const { handleSubmit, loading } = useExpenseSubmission();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const amountInputRef = useRef<HTMLInputElement>(null);
    const paymentScrollRef = useRef<HTMLDivElement>(null);
    const scanAbortRef = useRef<AbortController | null>(null);
    const [scanning, setScanning] = React.useState(false);
    const [errors, setErrors] = React.useState<ExpenseFormErrors>({});
    const [isDictating, setIsDictating] = React.useState(false);
    const [interimTranscript, setInterimTranscript] = React.useState('');
    const dictationHandleRef = useRef<DictationHandle | null>(null);
    // Accumulates the final transcript chunks across one dictation session — the
    // whole utterance is parsed into structured fields when recognition ends.
    const fullTranscriptRef = useRef<string>('');
    // Fallback timer: force-finishes dictation if onEnd never fires after a stop.
    const dictationStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Watchdog: if recognition produces no audio within a few seconds, surface a
    // hint — usually a missed mic-permission prompt or an Incognito restriction.
    const dictationWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const dictationGotSpeechRef = useRef(false);
    const [parsedExpense, setParsedExpense] = React.useState<ParsedVoiceExpense | null>(null);
    const speechSupported = React.useMemo(() => isSpeechSupported(), []);
    // Guards state-setters in dictation callbacks against firing after unmount —
    // recognition.stop() during cleanup runs onEnd asynchronously.
    const mountedRef = useRef(true);
    useEffect(() => {
        // Re-arm on (re)mount. React Strict Mode runs the cleanup once during the
        // initial mount in dev — without this the ref stays stuck at false and
        // every dictation callback (onResult/onEnd) silently no-ops.
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (dictationStopTimerRef.current) clearTimeout(dictationStopTimerRef.current);
            if (dictationWatchdogRef.current) clearTimeout(dictationWatchdogRef.current);
            dictationHandleRef.current?.abort();
        };
    }, []);

    // Stops dictation. Closes the listening UI immediately so the user is never
    // stuck, even if the recogniser is wedged — onEnd normally finishes the parse,
    // and a fallback timer covers the case where it never fires.
    const stopDictation = React.useCallback(() => {
        setIsDictating(false);
        setInterimTranscript('');
        if (dictationWatchdogRef.current) {
            clearTimeout(dictationWatchdogRef.current);
            dictationWatchdogRef.current = null;
        }
        const handle = dictationHandleRef.current;
        if (!handle) return;
        handle.stop();
        if (dictationStopTimerRef.current) clearTimeout(dictationStopTimerRef.current);
        dictationStopTimerRef.current = setTimeout(() => {
            dictationStopTimerRef.current = null;
            if (!mountedRef.current) return;
            handle.abort();
            dictationHandleRef.current = null;
            const spoken = fullTranscriptRef.current.trim();
            fullTranscriptRef.current = '';
            if (spoken) setParsedExpense(parseVoiceExpense(spoken));
        }, 1500);
    }, []);

    const stashAsReceipt = React.useCallback((file: File | Blob) => {
        const v = validateReceiptFile(file);
        if (!v.valid) {
            // Scan-source files don't need to be persisted; tell the user but
            // don't block the scan itself.
            toast(v.reason, {
                icon: '⚠️',
                style: { background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', color: '#FBBF24' }
            });
            return;
        }
        formState.setReceiptFile(file);
    }, [formState]);

    const receiptPreviewUrl = React.useMemo(() => {
        if (!formState.receiptFile) return null;
        const blob = formState.receiptFile;
        if (!(blob instanceof Blob)) return null;
        if (blob.type === 'application/pdf') return null;
        return URL.createObjectURL(blob);
    }, [formState.receiptFile]);

    useEffect(() => {
        if (!receiptPreviewUrl) return;
        return () => URL.revokeObjectURL(receiptPreviewUrl);
    }, [receiptPreviewUrl]);

    const scanFile = React.useCallback(async (file: Blob) => {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            toast.error('Receipt scanning needs an internet connection');
            return;
        }
        // Keep the original file as the persisted receipt — scan downsamples to
        // JPEG for the API, but storage gets the user's source image.
        stashAsReceipt(file);
        scanAbortRef.current?.abort();
        const controller = new AbortController();
        scanAbortRef.current = controller;
        setScanning(true);
        let objectUrl: string | null = null;
        try {
            const base64 = await new Promise<string>((resolve, reject) => {
                const img = new Image();
                objectUrl = URL.createObjectURL(file);
                const onAbort = () => {
                    img.src = '';
                    reject(new DOMException('Aborted', 'AbortError'));
                };
                controller.signal.addEventListener('abort', onAbort, { once: true });
                img.onload = () => {
                    if (controller.signal.aborted) return;
                    const MAX = 1600;
                    const scale = Math.min(1, MAX / Math.max(img.width, img.height));
                    const canvas = document.createElement('canvas');
                    canvas.width = Math.round(img.width * scale);
                    canvas.height = Math.round(img.height * scale);
                    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                    resolve(dataUrl.split(',')[1]);
                };
                img.onerror = reject;
                img.src = objectUrl;
            });
            const res = await fetch('/api/scan-receipt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg' }),
                signal: controller.signal,
            });
            if (!res.ok) throw new Error('Scan failed');
            const data = await res.json();
            if (controller.signal.aborted) return;
            if (data.amount) formState.setAmount(String(data.amount));
            if (data.description) formState.setDescription(data.description);
            if (data.category) formState.setSelectedCategory(data.category);
            if (data.currency) formState.setTxCurrency(data.currency);
            if (data.is_online) {
                formState.setPlaceName('');
                formState.setPlaceAddress('');
            } else {
                if (data.place_name) formState.setPlaceName(data.place_name);
                if (data.place_address) formState.setPlaceAddress(data.place_address);
            }
            if (data.date) {
                const d = parseISO(data.date);
                if (data.time) {
                    const [h, m] = data.time.split(':').map(Number);
                    d.setHours(h, m, 0, 0);
                }
                formState.setDate(d);
            }
        } catch (e) {
            if ((e as { name?: string })?.name === 'AbortError') return;
            console.error('[scan-receipt]', e);
            const msg = e instanceof Error ? e.message : 'unknown error';
            toast.error(`Couldn't scan receipt: ${msg}`);
        } finally {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            if (scanAbortRef.current === controller) {
                scanAbortRef.current = null;
                setScanning(false);
            }
        }
    }, [formState, stashAsReceipt]);

    useEffect(() => () => {
        scanAbortRef.current?.abort();
    }, []);

    const handleScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const target = e.currentTarget;
        try {
            await scanFile(file);
        } finally {
            target.value = '';
        }
    };

    // If we arrived here via the OS share sheet, the SW stashed the shared
    // image in IndexedDB and redirected us with ?from-share=1. Pull it out and
    // run the scanner automatically.
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        if (params.get('from-share') !== '1') return;
        // Strip the param so a refresh doesn't re-trigger.
        const url = new URL(window.location.href);
        url.searchParams.delete('from-share');
        window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
        takePendingSharedFile().then(blob => {
            if (blob) scanFile(blob);
        });
    }, [scanFile]);

    const onSubmit = () => {
        // Finalize any unevaluated calculator expression before validating.
        const evaluated = evaluateExpression(formState.amount);
        const finalAmount = evaluated !== null ? String(evaluated) : formState.amount;
        if (evaluated !== null && finalAmount !== formState.amount) {
            formState.setAmount(finalAmount);
        }
        const validationErrors = getExpenseFormErrors(finalAmount, formState.description, formState.date);
        if (validationErrors) {
            setErrors(validationErrors);
            return;
        }
        setErrors({});
        if (isNative) Haptics.impact({ style: ImpactStyle.Medium }).catch(() => { });
        // Also finalize any custom-split expressions before submission.
        const finalCustomAmounts: Record<string, string> = {};
        for (const [k, v] of Object.entries(formState.customAmounts)) {
            const r = evaluateExpression(v);
            finalCustomAmounts[k] = r !== null ? String(r) : v;
        }
        handleSubmit({
            userId, isNative, router, currency, resetForm: formState.resetForm,
            userProfile: { full_name: fullName || 'You', avatar_url: avatarUrl || undefined },
            amount: finalAmount, description: formState.description, date: formState.date,
            selectedCategory: formState.selectedCategory, txCurrency: formState.txCurrency,
            selectedGroupId: formState.selectedGroupId, selectedBucketId: formState.selectedBucketId,
            excludeFromAllowance: formState.excludeFromAllowance, placeName: formState.placeName,
            placeAddress: formState.placeAddress, placeLat: formState.placeLat, placeLng: formState.placeLng,
            paymentMethod: formState.paymentMethod, notes: formState.notes, tags: formState.tags,
            isSplitEnabled: formState.isSplitEnabled,
            selectedFriendIds: formState.selectedFriendIds, splitMode: formState.splitMode,
            customAmounts: finalCustomAmounts, isRecurring: formState.isRecurring, frequency: formState.frequency,
            isIncome: formState.isIncome,
            receiptFile: formState.receiptFile,
            selectedAccountId: formState.selectedAccountId,
        });
    };

    // Route a parsed voice dictation into the form. Amount/currency/category/
    // payment overwrite (the user dictated them deliberately); tags and free text
    // merge with anything already entered so a manual edit isn't clobbered.
    const applyParsedVoice = (parsed: ParsedVoiceExpense, location: GeocodedPlace | null) => {
        if (parsed.amount !== null) formState.setAmount(parsed.amount);
        if (parsed.currency) {
            const code = parsed.currency.toUpperCase();
            if (code in CURRENCY_SYMBOLS) formState.setTxCurrency(code);
        }
        if (parsed.category) formState.setSelectedCategory(parsed.category);
        if (parsed.paymentMethod) formState.setPaymentMethod(parsed.paymentMethod);
        if (parsed.notes) {
            const base = formState.notes.trim();
            formState.setNotes(base ? `${base} ${parsed.notes}` : parsed.notes);
        }
        if (parsed.tags.length) {
            const merged = [...formState.tags];
            for (const t of parsed.tags) {
                if (!merged.includes(t) && merged.length < 12) merged.push(t);
            }
            formState.setTags(merged);
        }
        if (parsed.description) {
            const base = formState.description;
            const joiner = base && !base.endsWith(' ') ? ' ' : '';
            formState.setDescription(`${base}${joiner}${parsed.description}`);
        }
        if (location) {
            formState.setPlaceName(location.place_name);
            formState.setPlaceAddress(location.place_address);
            formState.setPlaceLat(location.place_lat);
            formState.setPlaceLng(location.place_lng);
        }
        setParsedExpense(null);
    };

    // Detect location once for suggestion sorting
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setCurrentPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                () => { /* Location denied or unavailable — suggestions shown unsorted */ },
                { enableHighAccuracy: true, timeout: 8000 }
            );
        }
    }, []);

    // One-shot: center the pre-selected payment method in the scroller so the
    // user can see what's currently picked even if it sits off-screen on first paint.
    useEffect(() => {
        if (!formState.paymentMethod) return;
        const container = paymentScrollRef.current;
        const btn = container?.querySelector<HTMLButtonElement>(
            `button[data-payment-method="${formState.paymentMethod}"]`
        );
        if (!container || !btn) return;
        // Horizontal-only centering — avoid scrollIntoView, which would also scroll
        // the page vertically and push Quick Pins to the top on first paint.
        container.scrollLeft = btn.offsetLeft - (container.clientWidth - btn.clientWidth) / 2;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Prime the exchange rate cache before the user submits. Same-currency
    // entries short-circuit inside the service, so this is a no-op then.
    useEffect(() => {
        if (formState.txCurrency === currency) return;
        TransactionService.getExchangeRate(formState.txCurrency, currency, new Date()).catch(() => { /* best-effort */ });
    }, [formState.txCurrency, currency]);

    // Trip mode: when the user picks a trip-type bucket whose start/end window
    // covers today and whose currency differs from the form's, auto-switch the
    // tx currency to the destination currency. Saves the user from manually
    // changing currency on every transaction during a trip.
    const activeTripBucket = React.useMemo(() => {
        const id = formState.selectedBucketId;
        if (!id) return null;
        const b = buckets.find(x => x.id === id);
        if (!b || b.is_archived || b.type !== 'trip') return null;
        const today = new Date().toISOString().slice(0, 10);
        if (b.start_date && today < b.start_date.slice(0, 10)) return null;
        if (b.end_date && today > b.end_date.slice(0, 10)) return null;
        return b;
    }, [formState.selectedBucketId, buckets]);

    const tripAutoCurrencyAppliedRef = useRef<string | null>(null);
    useEffect(() => {
        if (!activeTripBucket || !activeTripBucket.currency) return;
        if (tripAutoCurrencyAppliedRef.current === activeTripBucket.id) return;
        const target = activeTripBucket.currency.toUpperCase();
        if (target === formState.txCurrency.toUpperCase()) return;
        formState.setTxCurrency(target);
        tripAutoCurrencyAppliedRef.current = activeTripBucket.id;
    }, [activeTripBucket, formState]);

    // Sorted Suggestions
    const sortedSuggestions = React.useMemo(() => {
        if (!currentPos) return formState.suggestedLocations;
        return [...formState.suggestedLocations].sort((a, b) => {
            const distA = getDistance(currentPos.lat, currentPos.lng, a.lat, a.lng);
            const distB = getDistance(currentPos.lat, currentPos.lng, b.lat, b.lng);
            return distA - distB;
        });
    }, [formState.suggestedLocations, currentPos]);



    return (
        <>
        {scanning && createPortal(
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(8px)', backgroundColor: 'rgba(12,8,30,0.85)' }}
            >
                <UniqueLoading variant="squares" size="lg" />
                <p className="mt-6 text-sm font-semibold text-foreground">Scanning receipt...</p>
                <p className="mt-1 text-xs text-muted-foreground">Reading your receipt</p>
            </motion.div>,
            document.body
        )}
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative"
        >
            <div className={cn(
                "p-5 space-y-6 max-w-md lg:max-w-4xl mx-auto pt-4 pb-[calc(8rem+env(safe-area-inset-bottom))] lg:pb-12 relative min-h-screen z-10"
            )}>

                {/* Header */}
                <div className="space-y-2">
                    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 min-h-[40px]">
                        <button
                            onClick={() => {
                                if (isNative) Haptics.impact({ style: ImpactStyle.Light }).catch(() => { });
                                router.back();
                            }}
                            aria-label="Go back"
                            className="p-2 rounded-full bg-secondary/30 hover:bg-secondary/50 transition-colors active:scale-[0.92]"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <h2 className="text-lg font-bold text-center truncate leading-tight">
                            Add Expense
                        </h2>
                        <button
                            onClick={onSubmit}
                            disabled={loading}
                            className="px-3 py-1.5 rounded-full bg-primary/15 border border-primary/30 text-primary text-sm font-semibold disabled:opacity-50 hover:bg-primary/20 transition-colors active:scale-[0.95]"
                        >
                            {loading ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                    {formState.selectedBucketId && (() => {
                        const b = buckets.find(x => x.id === formState.selectedBucketId);
                        if (!b) return null;
                        return (
                            <div className="flex justify-center">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[11px] font-semibold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" aria-hidden="true" />
                                    <span className="truncate max-w-[200px]">{b.name}</span>
                                </span>
                            </div>
                        );
                    })()}
                </div>

                {/* Scan Receipt — primary CTA opens the camera. A separate, clearly
                    secondary "Choose from gallery" row below covers the upload path. */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleScan}
                />
                <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleScan}
                />
                <div className="space-y-2">
                    <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        disabled={scanning}
                        aria-label="Scan receipt — take a photo"
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-primary/30 bg-primary/10 hover:bg-primary/20 transition-all disabled:opacity-50 group active:scale-[0.99]"
                    >
                        <div className="w-9 h-9 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                            <Camera className="w-4 h-4 text-primary" />
                        </div>
                        <div className="text-left min-w-0 flex-1">
                            <p className="text-sm font-semibold text-primary">Scan Receipt</p>
                            <p className="text-[11px] text-primary/60">Take a photo · auto-fills amount, date & more</p>
                        </div>
                    </button>
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={scanning}
                        aria-label="Choose a receipt image from your gallery"
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-[12px] font-semibold text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all disabled:opacity-50 active:scale-[0.99]"
                    >
                        <ImageIcon className="w-3.5 h-3.5" />
                        Or choose from gallery
                    </button>
                    {formState.receiptFile && (
                        <div className="flex items-center gap-3 px-3 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10">
                            {receiptPreviewUrl ? (
                                // Plain <img> is correct here: the URL is a one-off
                                // ObjectURL from a local Blob; next/image can't optimize it.
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={receiptPreviewUrl}
                                    alt="Receipt preview"
                                    className="w-10 h-10 rounded-md object-cover shrink-0 border border-emerald-500/40"
                                />
                            ) : (
                                <div className="w-10 h-10 rounded-md bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                                    <FileText className="w-4 h-4 text-emerald-300" />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-semibold text-emerald-300 truncate">
                                    Receipt attached
                                </p>
                                <p className="text-[10.5px] text-emerald-400/70 truncate">
                                    {(formState.receiptFile as File).name || (formState.receiptFile.type || 'attachment')} · {Math.round(formState.receiptFile.size / 1024)} KB
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => formState.setReceiptFile(null)}
                                aria-label="Remove attached receipt"
                                className="shrink-0 p-1.5 rounded-full text-emerald-300/70 hover:text-emerald-300 hover:bg-emerald-500/20 transition-colors active:scale-[0.92]"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                </div>


                {/* Amount Input */}
                <div className="space-y-2">
                    <label htmlFor="expense-amount" className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest block">Amount *</label>
                    <ExpressionKeypad
                        inputRef={amountInputRef}
                        value={formState.amount}
                        onChange={(next) => {
                            formState.setAmount(next);
                            if (errors.amount) setErrors(prev => ({ ...prev, amount: undefined }));
                        }}
                        size="md"
                    />
                    <div className="relative">
                        <Input
                            id="expense-amount"
                            name="amount"
                            ref={amountInputRef}
                            value={formState.amount}
                            type="text"
                            inputMode="decimal"
                            placeholder="0.00"
                            required
                            aria-required="true"
                            aria-invalid={!!errors.amount}
                            aria-describedby={errors.amount ? 'expense-amount-error' : undefined}
                            onChange={(e) => {
                                formState.setAmount(e.target.value);
                                if (errors.amount) setErrors(prev => ({ ...prev, amount: undefined }));
                            }}
                            onBlur={() => {
                                const result = evaluateExpression(formState.amount);
                                if (result !== null) formState.setAmount(String(result));
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    const result = evaluateExpression(formState.amount);
                                    if (result !== null) {
                                        e.preventDefault();
                                        formState.setAmount(String(result));
                                    }
                                }
                            }}
                            className={cn(
                                "h-16 text-3xl font-bold pl-12 pr-32 bg-secondary/10 tabular-nums tracking-tight",
                                errors.amount
                                    ? "border-destructive focus-visible:ring-destructive/50"
                                    : "border-white/10 focus-visible:border-primary/50 focus-visible:ring-primary/30"
                            )}
                        />
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-primary pointer-events-none">
                            {CURRENCY_SYMBOLS[formState.txCurrency as keyof typeof CURRENCY_SYMBOLS] || '$'}
                        </span>
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 w-[120px]">
                            <CurrencyDropdown
                                value={formState.txCurrency}
                                onValueChange={(val) => formState.setTxCurrency(val)}
                                compact
                            />
                        </div>
                    </div>
                    {(() => {
                        const preview = evaluateExpression(formState.amount);
                        if (preview === null) return null;
                        return (
                            <p className="text-[11px] text-muted-foreground font-medium pl-1">
                                = <span className="font-bold text-primary">{CURRENCY_SYMBOLS[formState.txCurrency as keyof typeof CURRENCY_SYMBOLS] || '$'}{preview.toFixed(2)}</span>
                                <span className="text-muted-foreground/60"> · tap away or press Enter to apply</span>
                            </p>
                        );
                    })()}
                    {errors.amount && (
                        <p id="expense-amount-error" role="alert" aria-live="polite" className="text-xs text-destructive font-medium">{errors.amount}</p>
                    )}
                </div>

                {/* Description */}
                <div className="space-y-2">
                    <div className="flex items-stretch gap-2">
                        <div className="flex-1">
                            <FloatingLabelInput
                                id="description"
                                label="Description *"
                                value={formState.description}
                                required
                                aria-required="true"
                                aria-invalid={!!errors.description}
                                aria-describedby={errors.description ? 'expense-description-error' : undefined}
                                onChange={(e) => {
                                    formState.setDescription(e.target.value);
                                    if (errors.description) setErrors(prev => ({ ...prev, description: undefined }));
                                }}
                                className={cn(
                                    "bg-secondary/10 h-14 transition-colors",
                                    errors.description
                                        ? "border-destructive"
                                        : isDictating
                                        ? "border-rose-500/40"
                                        : "border-white/10"
                                )}
                            />
                        </div>
                        {speechSupported && (
                            <button
                                type="button"
                                onClick={() => {
                                    if (isNative) Haptics.impact({ style: ImpactStyle.Light }).catch(() => { });
                                    if (isDictating) {
                                        stopDictation();
                                        return;
                                    }
                                    setInterimTranscript('');
                                    fullTranscriptRef.current = '';
                                    const handle = startDictation({
                                        onResult: (transcript, isFinal) => {
                                            if (!mountedRef.current) return;
                                            dictationGotSpeechRef.current = true;
                                            if (dictationWatchdogRef.current) {
                                                clearTimeout(dictationWatchdogRef.current);
                                                dictationWatchdogRef.current = null;
                                            }
                                            if (isFinal) {
                                                // Accumulate finals; the full utterance is parsed in onEnd.
                                                const base = fullTranscriptRef.current;
                                                fullTranscriptRef.current = base ? `${base} ${transcript}` : transcript;
                                                setInterimTranscript('');
                                            } else {
                                                setInterimTranscript(transcript);
                                            }
                                        },
                                        onError: (err) => {
                                            if (err === 'aborted') return;
                                            if (err === 'no-speech') {
                                                toast("Didn't catch that — tap the mic and speak", { icon: '🎤' });
                                                return;
                                            }
                                            if (err === 'not-allowed' || err === 'service-not-allowed') {
                                                toast.error('Microphone access denied — enable it for this site in browser settings.');
                                            } else if (err === 'no-microphone' || err === 'audio-capture') {
                                                toast.error('No microphone detected.');
                                            } else if (err === 'network') {
                                                toast.error('Voice input needs an internet connection.');
                                            } else {
                                                console.error('Dictation error:', err);
                                                toast.error('Voice input unavailable');
                                            }
                                        },
                                        onEnd: () => {
                                            if (dictationStopTimerRef.current) {
                                                clearTimeout(dictationStopTimerRef.current);
                                                dictationStopTimerRef.current = null;
                                            }
                                            if (dictationWatchdogRef.current) {
                                                clearTimeout(dictationWatchdogRef.current);
                                                dictationWatchdogRef.current = null;
                                            }
                                            dictationHandleRef.current = null;
                                            if (!mountedRef.current) return;
                                            setIsDictating(false);
                                            setInterimTranscript('');
                                            const spoken = fullTranscriptRef.current.trim();
                                            fullTranscriptRef.current = '';
                                            if (spoken) setParsedExpense(parseVoiceExpense(spoken));
                                        },
                                    });
                                    if (handle) {
                                        dictationHandleRef.current = handle;
                                        setIsDictating(true);
                                        dictationGotSpeechRef.current = false;
                                        if (dictationWatchdogRef.current) clearTimeout(dictationWatchdogRef.current);
                                        dictationWatchdogRef.current = setTimeout(() => {
                                            dictationWatchdogRef.current = null;
                                            if (!mountedRef.current || dictationGotSpeechRef.current) return;
                                            toast('No audio detected — check for a microphone prompt in the address bar. Incognito windows often block voice input; try a normal window.', { icon: '🎤', duration: 7000 });
                                        }, 8000);
                                    } else {
                                        // Browser couldn't start recognition — onError already notified.
                                        setIsDictating(false);
                                    }
                                }}
                                aria-label={isDictating ? 'Stop voice input' : 'Voice input'}
                                aria-pressed={isDictating}
                                className={cn(
                                    "shrink-0 w-14 h-14 rounded-2xl border flex items-center justify-center transition-colors",
                                    isDictating
                                        ? "bg-rose-500/15 border-rose-500/40 text-rose-300"
                                        : "bg-secondary/10 border-white/10 text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {isDictating ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                            </button>
                        )}
                    </div>
                    <AnimatePresence>
                        {isDictating && (
                            <motion.div
                                initial={{ opacity: 0, y: -6, height: 0 }}
                                animate={{ opacity: 1, y: 0, height: 'auto' }}
                                exit={{ opacity: 0, y: -6, height: 0 }}
                                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                className="overflow-hidden"
                            >
                                <div className="flex items-center gap-2.5 px-3 py-2 rounded-2xl border border-rose-500/25 bg-rose-500/[0.06] backdrop-blur-sm">
                                    {/* Soundwave indicator — 4 bars scaling vertically out of phase */}
                                    <div className="flex items-center gap-[2px] shrink-0 h-4" aria-hidden="true">
                                        {[0, 0.12, 0.24, 0.36].map((delay, i) => (
                                            <motion.span
                                                key={i}
                                                className="w-[2px] bg-rose-400 rounded-full origin-center"
                                                style={{ height: 12 }}
                                                animate={{ scaleY: [0.3, 1, 0.3] }}
                                                transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut', delay }}
                                            />
                                        ))}
                                    </div>
                                    <p
                                        className={cn(
                                            "flex-1 min-w-0 text-[12.5px] leading-snug line-clamp-2",
                                            interimTranscript ? "text-rose-100/85 italic" : "text-rose-300/60"
                                        )}
                                    >
                                        {interimTranscript || 'Listening — speak now'}
                                        {interimTranscript && (
                                            <motion.span
                                                className="inline-block ml-0.5 w-[1.5px] h-[10px] bg-rose-300/80 align-middle"
                                                animate={{ opacity: [1, 0.2, 1] }}
                                                transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                                            />
                                        )}
                                    </p>
                                    <button
                                        type="button"
                                        onClick={stopDictation}
                                        className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-rose-300 hover:text-rose-200 px-2 py-0.5 rounded-md border border-rose-500/30 hover:border-rose-500/50 transition-colors"
                                        aria-label="Stop voice input"
                                    >
                                        Stop
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    {errors.description && (
                        <p id="expense-description-error" role="alert" aria-live="polite" className="text-xs text-destructive font-medium">{errors.description}</p>
                    )}
                    {formState.suggestedCategory && (
                        <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-2xl border border-primary/20 bg-primary/10">
                            <div className="flex items-center gap-2 min-w-0">
                                <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />
                                <p className="text-[11px] text-primary/90 font-medium truncate">
                                    Try category <span className="font-bold text-primary capitalize">{formState.suggestedCategory}</span>
                                </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (isNative) Haptics.impact({ style: ImpactStyle.Light }).catch(() => { });
                                        formState.setSelectedCategory(formState.suggestedCategory!);
                                        formState.setSuggestedCategory(null);
                                    }}
                                    aria-label={`Apply suggested category: ${formState.suggestedCategory}`}
                                    className="text-[11px] font-bold text-primary hover:text-primary/80 px-2 py-1 rounded-full bg-primary/15 border border-primary/30 transition-colors active:scale-[0.96]"
                                >
                                    Apply
                                </button>
                                <button
                                    type="button"
                                    onClick={() => formState.setSuggestedCategory(null)}
                                    aria-label="Dismiss category suggestion"
                                    className="text-primary/70 hover:text-primary/90 p-1 rounded-full active:scale-[0.92] transition-transform duration-100"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    )}

                    {formState.descriptionSuggestions.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                            {formState.descriptionSuggestions.map((s, idx) => {
                                const color = CATEGORY_COLORS[s.category] || CATEGORY_COLORS.uncategorized;
                                return (
                                    <button
                                        key={`${s.description}-${idx}`}
                                        type="button"
                                        onClick={() => {
                                            if (isNative) Haptics.impact({ style: ImpactStyle.Light }).catch(() => { });
                                            formState.setDescription(s.description);
                                            if (s.category) formState.setSelectedCategory(s.category);
                                            if (s.payment_method) {
                                                const allowed = ['Cash', 'Debit Card', 'Credit Card', 'UPI', 'Bank Transfer'] as const;
                                                if ((allowed as readonly string[]).includes(s.payment_method)) {
                                                    formState.setPaymentMethod(s.payment_method as typeof allowed[number]);
                                                }
                                            }
                                            if (s.place_name) {
                                                formState.setPlaceName(s.place_name);
                                                formState.setPlaceAddress(s.place_address);
                                                formState.setPlaceLat(s.place_lat);
                                                formState.setPlaceLng(s.place_lng);
                                            }
                                            if (s.bucket_id) formState.setSelectedBucketId(s.bucket_id);
                                            formState.setDescriptionSuggestions([]);
                                            formState.setSuggestedCategory(null);
                                            formState.setSuggestedBucket(null);
                                        }}
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-secondary/20 hover:bg-secondary/40 transition-colors shrink-0"
                                        aria-label={`Use previous: ${s.description}`}
                                    >
                                        <div
                                            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                                            style={{ backgroundColor: `${color}25`, color }}
                                        >
                                            {getIconForCategory(s.category, 'w-3 h-3')}
                                        </div>
                                        <span className="text-[11px] font-medium truncate max-w-[140px]">{s.description}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="space-y-3 min-h-[105px]"> {/* Slightly increased and stabilized height for Quick Pins */}
                    <div className="flex items-center gap-1.5 ml-1 h-4">
                        <AnimatePresence>
                            {sortedSuggestions.length > 0 && (
                                <motion.label 
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest flex items-center gap-1.5"
                                >
                                    <LocateFixed className="w-3 h-3" />
                                    Quick Pins
                                </motion.label>
                            )}
                        </AnimatePresence>
                    </div>
                    <AnimatePresence mode="wait">
                        {sortedSuggestions.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                className="overflow-hidden"
                            >
                                <div 
                                    className="relative -mx-5 px-5"
                                    style={{
                                        maskImage: 'linear-gradient(to right, black calc(100% - 40px), transparent)',
                                        WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 40px), transparent)',
                                    }}
                                >
                                    <div className="flex gap-3 overflow-x-auto pb-3 pt-1 px-2 snap-x snap-mandatory custom-scrollbar">
                                        {sortedSuggestions.map((loc, i) => (
                                            <motion.button
                                                key={`${loc.name}-${loc.type}`}
                                                type="button"
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                transition={{ delay: i * 0.05 }}
                                                onClick={() => {
                                                    formState.setPlaceName(loc.name);
                                                    formState.setPlaceAddress(loc.address);
                                                    formState.setPlaceLat(loc.lat);
                                                    formState.setPlaceLng(loc.lng);
                                                    formState.setSuggestedLocations(prev => prev.filter(l => l.name !== loc.name));
                                                }}
                                                className={cn(
                                                    "flex items-center gap-3 px-4 py-3 rounded-2xl border whitespace-nowrap transition-all relative overflow-hidden group/pin shrink-0 snap-start",
                                                    loc.type === 'last' ? "bg-primary/10 border-primary/20 text-primary shadow-[0_4px_12px_rgba(138,43,226,0.1)]" :
                                                    loc.type === 'category' ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-500 shadow-[0_4px_12px_rgba(6,182,212,0.1)]" :
                                                    "bg-secondary/20 border-white/5 text-muted-foreground hover:bg-secondary/30"
                                                )}
                                                style={{ width: 'auto', minWidth: '160px', maxWidth: '240px' }}
                                            >
                                                <div className={cn(
                                                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border transition-transform group-hover/pin:scale-110 shadow-sm",
                                                    loc.type === 'last' ? "bg-primary/20 border-primary/40 text-primary shadow-primary/20" :
                                                    loc.type === 'category' ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-400 shadow-cyan-500/20" :
                                                    "bg-amber-500/20 border-amber-500/40 text-amber-400 shadow-amber-500/20"
                                                )}>
                                                    <MapPin className="w-4 h-4" />
                                                </div>
                                                <div className="text-left min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        <p className={cn(
                                                            "text-[11px] font-bold leading-tight tracking-tight truncate flex-1",
                                                            loc.type === 'last' ? "text-primary-foreground" :
                                                            loc.type === 'category' ? "text-cyan-50" :
                                                            "text-amber-50"
                                                        )}>{loc.name}</p>
                                                        {currentPos && (
                                                            <span className="text-[8px] font-bold opacity-70 bg-white/10 px-1 rounded-sm shrink-0 border border-white/5">
                                                                {getDistance(currentPos.lat, currentPos.lng, loc.lat, loc.lng) < 1 
                                                                    ? `${Math.round(getDistance(currentPos.lat, currentPos.lng, loc.lat, loc.lng) * 1000)}m` 
                                                                    : `${getDistance(currentPos.lat, currentPos.lng, loc.lat, loc.lng).toFixed(1)}km`}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className={cn(
                                                        "text-[9px] font-bold mt-0.5 truncate max-w-[120px] uppercase tracking-tighter",
                                                        loc.type === 'last' ? "text-primary/70" : 
                                                        loc.type === 'category' ? "text-cyan-500/80" : 
                                                        "text-amber-500/80"
                                                    )}>
                                                        {loc.type === 'last' ? "Last used" : 
                                                         loc.type === 'category' ? `Nearby ${formState.selectedCategory}` : 
                                                         "Frequent Spot"}
                                                    </p>
                                                </div>
                                            </motion.button>
                                        ))}
                                        {/* Spacer for partial peek to work correctly on the last item */}
                                        <div className="w-10 shrink-0" />
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="min-h-[72px]"> {/* Stabilized height for Location Picker */}
                    <LocationPicker
                        placeName={formState.placeName}
                        placeAddress={formState.placeAddress}
                        placeLat={formState.placeLat}
                        placeLng={formState.placeLng}
                        onChange={(loc) => {
                            formState.setPlaceName(loc.place_name);
                            formState.setPlaceAddress(loc.place_address);
                            formState.setPlaceLat(loc.place_lat);
                            formState.setPlaceLng(loc.place_lng);
                        }}
                    />
                </div>

                {formState.smartDefaults && formState.placeName && (() => {
                    const sd = formState.smartDefaults;
                    const bucket = sd.bucket_id ? buckets.find(b => b.id === sd.bucket_id && !b.is_archived) : null;
                    const parts: string[] = [];
                    if (sd.category) parts.push(sd.category);
                    if (sd.payment_method) parts.push(sd.payment_method);
                    if (bucket) parts.push(bucket.name);
                    if (parts.length === 0) return null;
                    return (
                        <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-2xl border border-amber-500/20 bg-amber-500/10">
                            <div className="flex items-center gap-2 min-w-0">
                                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <p className="text-[11px] text-amber-200/90 font-medium truncate">
                                    Usual at <span className="font-bold text-amber-300">{formState.placeName}</span>: {parts.map((p, i) => (
                                        <span key={i} className="font-bold text-amber-300 capitalize">{p}{i < parts.length - 1 ? ' · ' : ''}</span>
                                    ))}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (isNative) Haptics.impact({ style: ImpactStyle.Light }).catch(() => { });
                                        if (sd.category) formState.setSelectedCategory(sd.category);
                                        if (sd.payment_method) formState.setPaymentMethod(sd.payment_method);
                                        if (sd.bucket_id) formState.setSelectedBucketId(sd.bucket_id);
                                        formState.setSmartDefaults(null);
                                    }}
                                    className="text-[11px] font-bold text-amber-300 hover:text-amber-200 px-2 py-1 rounded-full bg-amber-400/15 border border-amber-400/30 transition-colors active:scale-[0.96]"
                                >
                                    Apply
                                </button>
                                <button
                                    type="button"
                                    onClick={() => formState.setSmartDefaults(null)}
                                    aria-label="Dismiss suggestion"
                                    className="text-amber-300/70 hover:text-amber-200 p-1 rounded-full active:scale-[0.92] transition-transform duration-100"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    );
                })()}

                {/* Category Selection */}
                <CategorySelector
                    categories={dropdownCategories}
                    selectedCategory={formState.selectedCategory}
                    onSelect={formState.setSelectedCategory}
                    suggestedCategoryId={formState.suggestedCategory}
                    onApplySuggestion={() => {
                        if (formState.suggestedCategory) {
                            formState.setSelectedCategory(formState.suggestedCategory);
                            formState.setSuggestedCategory(null);
                        }
                    }}
                />

                {/* Personal Bucket Selection */}
                {formState.suggestedBucket && (() => {
                    const sb = buckets.find(b => b.id === formState.suggestedBucket && !b.is_archived);
                    if (!sb) return null;
                    return (
                        <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/10">
                            <div className="flex items-center gap-2 min-w-0">
                                <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" aria-hidden="true" />
                                <p className="text-[11px] text-cyan-200/90 font-medium truncate">
                                    Try bucket <span className="font-bold text-cyan-300">{sb.name}</span>
                                </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (isNative) Haptics.impact({ style: ImpactStyle.Light }).catch(() => { });
                                        formState.setSelectedBucketId(sb.id);
                                        formState.setSuggestedBucket(null);
                                    }}
                                    aria-label={`Apply suggested bucket: ${sb.name}`}
                                    className="text-[11px] font-bold text-cyan-300 hover:text-cyan-200 px-2 py-1 rounded-full bg-cyan-400/15 border border-cyan-400/30 transition-colors active:scale-[0.96]"
                                >
                                    Apply
                                </button>
                                <button
                                    type="button"
                                    onClick={() => formState.setSuggestedBucket(null)}
                                    aria-label="Dismiss bucket suggestion"
                                    className="text-cyan-300/70 hover:text-cyan-200 p-1 rounded-full active:scale-[0.92] transition-transform duration-100"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    );
                })()}
                <BucketSelector
                    buckets={buckets}
                    selectedBucketId={formState.selectedBucketId}
                    setSelectedBucketId={formState.setSelectedBucketId}
                />

                {activeAccounts.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Account</p>
                        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 custom-scrollbar">
                            {activeAccounts.map(a => {
                                const TypeIcon = ACCOUNT_TYPE_ICONS[a.type] || CircleDollarSign;
                                const selected = formState.selectedAccountId === a.id;
                                return (
                                    <button
                                        key={a.id}
                                        type="button"
                                        onClick={() => {
                                            if (isNative) Haptics.impact({ style: ImpactStyle.Light }).catch(() => { });
                                            formState.setSelectedAccountId(a.id);
                                        }}
                                        aria-pressed={selected}
                                        className={cn(
                                            'flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all min-w-[80px] cursor-pointer text-center active:scale-[0.98]',
                                            selected
                                                ? 'ring-1 ring-primary/20'
                                                : 'bg-background/20 border-white/5 hover:border-white/10',
                                        )}
                                        style={selected ? {
                                            backgroundColor: `${a.color}1F`,
                                            borderColor: `${a.color}80`,
                                        } : undefined}
                                    >
                                        <div
                                            className="w-10 h-10 rounded-full flex items-center justify-center"
                                            style={{
                                                backgroundColor: `${a.color}22`,
                                                border: `1px solid ${a.color}50`,
                                            }}
                                        >
                                            <TypeIcon className="w-4 h-4" style={{ color: a.color }} />
                                        </div>
                                        <span className="text-[11px] font-medium truncate w-16">{a.name}</span>
                                        <span className="text-[9.5px] uppercase tracking-wider text-muted-foreground/60 leading-none">{a.currency}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
                {activeTripBucket && (
                    <div className="flex items-center gap-2 text-[11px] font-bold px-3 py-1.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 self-start">
                        <Plane className="w-3 h-3" aria-hidden="true" />
                        <span>Trip mode: {activeTripBucket.name}</span>
                        {activeTripBucket.currency && (
                            <span className="text-cyan-400/70">
                                · {activeTripBucket.currency.toUpperCase()}
                            </span>
                        )}
                    </div>
                )}

                {/* Date & Payment */}
                <div className="space-y-4">
                    <div className="space-y-2">
                        <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Date *</p>
                        <Popover modal={true}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-full justify-start text-left font-normal h-12 rounded-xl bg-secondary/10 border-white/10 hover:bg-secondary/20",
                                        !formState.date && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {formState.date ? format(formState.date, "PPP p") : <span>Pick a date</span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 bg-card border-white/10 text-foreground" align="center">
                                <CalendarComponent
                                    mode="single"
                                    selected={formState.date}
                                    onSelect={formState.setDate}
                                    initialFocus
                                    className="p-3"
                                    fromDate={new Date(2020, 0, 1)}
                                    toDate={new Date()}
                                />
                                <div className="p-3 border-t border-white/10">
                                    <TimePicker setDate={formState.setDate} date={formState.date} />
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div className="space-y-2">
                        <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Payment Method</p>
                        <div
                            className="relative -mx-5"
                            style={{
                                maskImage: 'linear-gradient(to right, transparent, black 20px, black calc(100% - 28px), transparent)',
                                WebkitMaskImage: 'linear-gradient(to right, transparent, black 20px, black calc(100% - 28px), transparent)',
                            }}
                        >
                            <div
                                ref={paymentScrollRef}
                                className="flex gap-2 overflow-x-auto px-5 pb-2 snap-x snap-mandatory custom-scrollbar"
                            >
                                {(['Cash', 'UPI', 'Debit Card', 'Credit Card', 'Bank Transfer'] as const).map((method) => {
                                    const isSelected = formState.paymentMethod === method;
                                    const color = PAYMENT_METHOD_COLORS[method];
                                    const Icon = method === 'Cash' ? Banknote
                                        : method === 'UPI' ? Wallet
                                            : method === 'Bank Transfer' ? Building2
                                                : CreditCard;
                                    return (
                                        <button
                                            key={method}
                                            type="button"
                                            data-payment-method={method}
                                            aria-pressed={isSelected}
                                            onClick={() => {
                                                if (isNative) Haptics.impact({ style: ImpactStyle.Light }).catch(() => { });
                                                formState.setPaymentMethod(method);
                                            }}
                                            className={cn(
                                                "flex items-center gap-2 px-3.5 py-2.5 rounded-full border whitespace-nowrap shrink-0 snap-start transition-colors active:scale-[0.96]",
                                                !isSelected && "bg-secondary/10 border-white/5 text-muted-foreground hover:bg-secondary/20 hover:text-foreground"
                                            )}
                                            style={isSelected ? {
                                                backgroundColor: `${color}20`,
                                                borderColor: color,
                                                color,
                                            } : undefined}
                                        >
                                            <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                            <span className="text-sm font-medium">{method}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Exclude from Allowance Toggle */}
                <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                        <p className="text-sm font-medium">Exclude from Allowance</p>
                        <p className="text-[11px] text-muted-foreground">Don't count against your monthly limit</p>
                    </div>
                    <Switch
                        checked={formState.excludeFromAllowance}
                        onCheckedChange={formState.setExcludeFromAllowance}
                        className="data-[state=checked]:bg-cyan-500 shrink-0"
                    />
                </div>

                {/* Quick split with most recent partner — only when not already splitting and a partner is known */}
                {!activeWorkspaceId && !formState.isSplitEnabled && recentSplitPartner && (() => {
                    const partner = friends.find(f => f.id === recentSplitPartner.userId);
                    if (!partner) return null;
                    const firstName = (partner.full_name || 'them').split(' ')[0];
                    return (
                        <button
                            type="button"
                            onClick={() => {
                                if (isNative) Haptics.impact({ style: ImpactStyle.Light }).catch(() => { });
                                formState.setIsSplitEnabled(true);
                                formState.setSplitMode('even');
                                formState.setSelectedGroupId(null);
                                formState.setSelectedFriendIds([partner.id]);
                            }}
                            className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-primary/10 border border-primary/25 hover:bg-primary/15 transition-colors text-left active:scale-[0.99]"
                            aria-label={`Quick split 50/50 with ${partner.full_name}`}
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                                    <Users className="w-4 h-4 text-primary" aria-hidden="true" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-primary">Quick split 50/50 with {firstName}</p>
                                    <p className="text-[11px] text-primary/70">Tap to split this evenly</p>
                                </div>
                            </div>
                            <Sparkles className="w-4 h-4 text-primary/70 shrink-0" aria-hidden="true" />
                        </button>
                    );
                })()}

                {/* Split Expense Section */}
                <SplitExpenseSection
                    isSplitEnabled={formState.isSplitEnabled}
                    setIsSplitEnabled={formState.setIsSplitEnabled}
                    splitMode={formState.splitMode}
                    setSplitMode={formState.setSplitMode}
                    groups={groups}
                    friends={friends}
                    selectedGroupId={formState.selectedGroupId}
                    setSelectedGroupId={formState.setSelectedGroupId}
                    selectedFriendIds={formState.selectedFriendIds}
                    setSelectedFriendIds={formState.setSelectedFriendIds}
                    customAmounts={formState.customAmounts}
                    setCustomAmounts={formState.setCustomAmounts}
                    amount={formState.amount}
                    currency={formState.txCurrency}
                    CURRENCY_SYMBOLS={CURRENCY_SYMBOLS}
                />

                {/* Recurring Expense Section */}
                <RecurringExpenseSection
                    isRecurring={formState.isRecurring}
                    setIsRecurring={formState.setIsRecurring}
                    frequency={formState.frequency}
                    setFrequency={formState.setFrequency}
                    date={formState.date}
                    isIncome={formState.isIncome}
                    setIsIncome={formState.setIsIncome}
                />

                {/* Tags */}
                <TagsSection
                    tags={formState.tags}
                    setTags={formState.setTags}
                    knownTags={formState.knownTags}
                />

                {/* Notes */}
                <div className="space-y-2">
                    <label htmlFor="expense-notes" className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest block">Notes (Optional)</label>
                    <Textarea
                        id="expense-notes"
                        name="notes"
                        placeholder="Add notes..."
                        value={formState.notes}
                        onChange={(e) => formState.setNotes(e.target.value)}
                        className="bg-secondary/10 border-white/10 resize-none min-h-[80px]"
                    />
                </div>

                {/* Main Action Button */}
                <Button
                    onClick={onSubmit}
                    disabled={loading}
                    className="w-full h-12 text-base font-semibold active:scale-[0.98] transition-transform duration-100"
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                            Adding Expense...
                        </>
                    ) : 'Add Expense'}
                </Button>
            </div>
        </motion.div>
        <VoiceReviewModal
            parsed={parsedExpense}
            currentCurrency={formState.txCurrency}
            proximity={currentPos}
            onApply={applyParsedVoice}
            onDiscard={() => setParsedExpense(null)}
        />
        </>
    );
}
