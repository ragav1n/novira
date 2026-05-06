import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

// Persist a subset of the form to sessionStorage so an accidental refresh or
// background-tab eviction doesn't lose what the user typed. Workspace + user
// scoping keeps drafts from one context bleeding into another.
const DRAFT_KEY_PREFIX = 'novira_expense_draft';

type DraftShape = {
    amount: string;
    description: string;
    notes: string;
    selectedCategory: string;
    paymentMethod: 'Cash' | 'Debit Card' | 'Credit Card' | 'UPI' | 'Bank Transfer';
    txCurrency: string;
    selectedBucketId: string | null;
    placeName: string | null;
    placeAddress: string | null;
    placeLat: number | null;
    placeLng: number | null;
    tags: string[];
    excludeFromAllowance: boolean;
    isRecurring: boolean;
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    isIncome: boolean;
    date: string | null;
};

function readDraft(key: string): Partial<DraftShape> | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = sessionStorage.getItem(key);
        if (!raw) return null;
        return JSON.parse(raw) as Partial<DraftShape>;
    } catch {
        return null;
    }
}

type QuickAddDefaults = {
    category?: string | null;
    paymentMethod?: 'Cash' | 'Debit Card' | 'Credit Card' | 'UPI' | 'Bank Transfer' | null;
    bucketId?: string | null;
};

export function useExpenseForm(
    userId: string | null | undefined,
    defaultCurrency: string,
    activeWorkspaceId: string | null = null,
    defaultSplitEnabled: boolean = !!activeWorkspaceId,
    quickAddDefaults: QuickAddDefaults = {},
) {
    const draftKey = `${DRAFT_KEY_PREFIX}_${userId ?? 'anon'}_${activeWorkspaceId ?? 'personal'}`;
    // Lazy-init: only read sessionStorage once on mount, not on every render.
    const initialDraftRef = useRef<Partial<DraftShape> | null>(null);
    if (initialDraftRef.current === null) {
        initialDraftRef.current = readDraft(draftKey) ?? {};
    }
    const initialDraft = initialDraftRef.current;
    const hadDraftCurrencyRef = useRef(!!initialDraft.txCurrency);

    const [selectedCategory, setSelectedCategory] = useState(
        initialDraft.selectedCategory ?? quickAddDefaults.category ?? 'food'
    );
    const [amount, setAmount] = useState(initialDraft.amount ?? '');
    const [description, setDescription] = useState(initialDraft.description ?? '');
    const [notes, setNotes] = useState(initialDraft.notes ?? '');
    const [date, setDate] = useState<Date | undefined>(
        initialDraft.date ? new Date(initialDraft.date) : new Date()
    );
    const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Debit Card' | 'Credit Card' | 'UPI' | 'Bank Transfer'>(
        initialDraft.paymentMethod ?? quickAddDefaults.paymentMethod ?? 'Cash'
    );
    const [txCurrency, setTxCurrency] = useState(initialDraft.txCurrency ?? defaultCurrency);
    const [selectedBucketId, setSelectedBucketId] = useState<string | null>(
        initialDraft.selectedBucketId ?? quickAddDefaults.bucketId ?? null
    );

    useEffect(() => {
        // Only force-reset to the user's preferred currency if the draft on mount
        // didn't carry one — otherwise we'd overwrite the user's in-progress choice.
        if (!hadDraftCurrencyRef.current) {
            setTxCurrency(defaultCurrency);
        }
    }, [defaultCurrency]);

    // Splitting State
    const [isSplitEnabled, setIsSplitEnabled] = useState(defaultSplitEnabled);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(activeWorkspaceId);
    const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
    const [splitMode, setSplitMode] = useState<'even' | 'custom'>('even');
    const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

    // Recurring State
    const [isRecurring, setIsRecurring] = useState(initialDraft?.isRecurring ?? false);
    const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>(initialDraft?.frequency ?? 'monthly');
    const [isIncome, setIsIncome] = useState<boolean>(initialDraft?.isIncome ?? false);

    // Exclusion State
    const [excludeFromAllowance, setExcludeFromAllowance] = useState(initialDraft?.excludeFromAllowance ?? false);

    // Location State
    const [placeName, setPlaceName] = useState<string | null>(initialDraft?.placeName ?? null);
    const [placeAddress, setPlaceAddress] = useState<string | null>(initialDraft?.placeAddress ?? null);
    const [placeLat, setPlaceLat] = useState<number | null>(initialDraft?.placeLat ?? null);
    const [placeLng, setPlaceLng] = useState<number | null>(initialDraft?.placeLng ?? null);
    const [suggestedLocations, setSuggestedLocations] = useState<{ name: string, address: string, lat: number, lng: number, type: 'last' | 'frequent' | 'category' }[]>([]);

    // Tag State
    const [tags, setTags] = useState<string[]>(initialDraft?.tags ?? []);
    const [knownTags, setKnownTags] = useState<string[]>([]);
    const [suggestedCategory, setSuggestedCategory] = useState<string | null>(null);
    const [suggestedBucket, setSuggestedBucket] = useState<string | null>(null);

    // Description autocomplete: top 3 distinct past descriptions matching the prefix,
    // each carrying its full prior context for one-tap prefill.
    type DescriptionSuggestion = {
        description: string;
        category: string;
        payment_method: string | null;
        place_name: string | null;
        place_address: string | null;
        place_lat: number | null;
        place_lng: number | null;
        bucket_id: string | null;
        amount: number | null;
        currency: string | null;
    };
    const [descriptionSuggestions, setDescriptionSuggestions] = useState<DescriptionSuggestion[]>([]);

    // Smart defaults derived from a picked place — most common (category, payment, bucket) at this exact place.
    type SmartDefaults = {
        category: string | null;
        payment_method: 'Cash' | 'Debit Card' | 'Credit Card' | 'UPI' | 'Bank Transfer' | null;
        bucket_id: string | null;
    };
    const [smartDefaults, setSmartDefaults] = useState<SmartDefaults | null>(null);

    // Persist the current draft. Debounced so rapid typing doesn't thrash storage.
    const draftWriteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (draftWriteTimerRef.current) clearTimeout(draftWriteTimerRef.current);
        draftWriteTimerRef.current = setTimeout(() => {
            // Only persist if the user has typed something meaningful — empty drafts
            // shouldn't pollute storage when the user just opens the screen.
            const hasContent = !!amount || !!description || !!notes || !!placeName || tags.length > 0;
            if (!hasContent) {
                sessionStorage.removeItem(draftKey);
                return;
            }
            try {
                const draft: DraftShape = {
                    amount, description, notes, selectedCategory, paymentMethod,
                    txCurrency, selectedBucketId, placeName, placeAddress,
                    placeLat, placeLng, tags, excludeFromAllowance, isRecurring,
                    frequency, isIncome,
                    date: date ? date.toISOString() : null,
                };
                sessionStorage.setItem(draftKey, JSON.stringify(draft));
            } catch {
                // sessionStorage may be full or disabled — silently no-op
            }
        }, 300);
        return () => {
            if (draftWriteTimerRef.current) clearTimeout(draftWriteTimerRef.current);
        };
    }, [
        draftKey, amount, description, notes, selectedCategory, paymentMethod,
        txCurrency, selectedBucketId, placeName, placeAddress, placeLat, placeLng,
        tags, excludeFromAllowance, isRecurring, frequency, isIncome, date,
    ]);

    // Smart Location Memory: Suggest locations from previous transactions
    useEffect(() => {
        if (!userId) {
            setSuggestedLocations([]);
            return;
        }

        const fetchSuggestions = async () => {
            try {
                const suggestions: any[] = [];
                const seenNames = new Set<string>();

                // 1. Description Match (Highest relevance)
                if (description && description.length >= 3) {
                    const escapedDesc = description.replace(/[%_\\]/g, '\\$&');
                    const { data: descMatches } = await supabase
                        .from('transactions')
                        .select('place_name, place_address, place_lat, place_lng')
                        .eq('user_id', userId)
                        .ilike('description', `%${escapedDesc}%`)
                        .not('place_name', 'is', null)
                        .order('created_at', { ascending: false })
                        .limit(1);

                    if (descMatches?.[0]) {
                        const loc = descMatches[0];
                        if (loc.place_name !== placeName && loc.place_lat && loc.place_lng) {
                            suggestions.push({ name: loc.place_name!, address: loc.place_address!, lat: loc.place_lat, lng: loc.place_lng, type: 'last' });
                            seenNames.add(loc.place_name!);
                        }
                    }
                }

                // 2. Category Match (Frequent for this category)
                const { data: catMatches } = await supabase
                    .from('transactions')
                    .select('place_name, place_address, place_lat, place_lng')
                    .eq('user_id', userId)
                    .eq('category', selectedCategory)
                    .not('place_name', 'is', null)
                    .order('created_at', { ascending: false })
                    .limit(20);

                if (catMatches) {
                    catMatches.forEach(loc => {
                        if (loc.place_name && !seenNames.has(loc.place_name) && loc.place_name !== placeName && loc.place_lat && loc.place_lng) {
                            suggestions.push({ name: loc.place_name, address: loc.place_address!, lat: loc.place_lat, lng: loc.place_lng, type: 'category' });
                            seenNames.add(loc.place_name);
                        }
                    });
                }

                // 3. Frequent overall ranked by visit count (If still space)
                if (suggestions.length < 12) {
                    const { data: frequent } = await supabase
                        .from('transactions')
                        .select('place_name, place_address, place_lat, place_lng')
                        .eq('user_id', userId)
                        .not('place_name', 'is', null)
                        .limit(60);

                    if (frequent) {
                        // Count how often each place appears to rank by true frequency
                        const placeCounts = new Map<string, { name: string; address: string; lat: number; lng: number; count: number }>();
                        for (const loc of frequent) {
                            if (!loc.place_name || seenNames.has(loc.place_name) || loc.place_name === placeName || !loc.place_lat || !loc.place_lng) continue;
                            const existing = placeCounts.get(loc.place_name);
                            if (existing) {
                                existing.count++;
                            } else {
                                placeCounts.set(loc.place_name, { name: loc.place_name, address: loc.place_address!, lat: loc.place_lat, lng: loc.place_lng, count: 1 });
                            }
                        }
                        const sortedByFrequency = [...placeCounts.values()].sort((a, b) => b.count - a.count);
                        for (const place of sortedByFrequency) {
                            if (suggestions.length >= 12) break;
                            suggestions.push({ name: place.name, address: place.address, lat: place.lat, lng: place.lng, type: 'frequent' });
                            seenNames.add(place.name);
                        }
                    }
                }

                setSuggestedLocations(suggestions);
            } catch (error) {
                console.error('Error fetching location suggestions:', error);
            }
        };

        const timer = setTimeout(fetchSuggestions, 400);
        return () => clearTimeout(timer);
    }, [description, selectedCategory, userId, placeName]);

    // Load the user's existing tag vocabulary once per session for autocomplete.
    useEffect(() => {
        if (!userId) {
            setKnownTags([]);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const { data } = await supabase
                    .from('transactions')
                    .select('tags')
                    .eq('user_id', userId)
                    .not('tags', 'is', null)
                    .order('created_at', { ascending: false })
                    .limit(200);
                if (cancelled || !data) return;
                const counts = new Map<string, number>();
                for (const row of data as { tags: string[] | null }[]) {
                    for (const t of row.tags || []) {
                        if (!t) continue;
                        counts.set(t, (counts.get(t) || 0) + 1);
                    }
                }
                setKnownTags(
                    [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)
                );
            } catch (error) {
                console.error('Error fetching known tags:', error);
            }
        })();
        return () => { cancelled = true; };
    }, [userId]);

    // Description-driven suggestions: pulls past transactions whose description matches
    // the current input, then derives (a) the suggestedCategory chip, (b) the suggestedBucket
    // chip, and (c) up to 3 distinct prior descriptions for the autocomplete pills row.
    useEffect(() => {
        if (!userId) {
            setSuggestedCategory(null);
            setSuggestedBucket(null);
            setDescriptionSuggestions([]);
            return;
        }
        const trimmed = description.trim();
        if (trimmed.length < 2) {
            setSuggestedCategory(null);
            setSuggestedBucket(null);
            setDescriptionSuggestions([]);
            return;
        }
        let cancelled = false;
        const timer = setTimeout(async () => {
            try {
                const escaped = trimmed.replace(/[%_\\]/g, '\\$&');
                const { data } = await supabase
                    .from('transactions')
                    .select('description, category, payment_method, place_name, place_address, place_lat, place_lng, bucket_id, amount, currency')
                    .eq('user_id', userId)
                    .ilike('description', `%${escaped}%`)
                    .order('created_at', { ascending: false })
                    .limit(20);
                if (cancelled) return;

                if (!data || data.length === 0) {
                    setSuggestedCategory(null);
                    setSuggestedBucket(null);
                    setDescriptionSuggestions([]);
                    return;
                }

                const catTally = new Map<string, number>();
                const bucketTally = new Map<string, number>();
                for (const r of data as { category: string; bucket_id: string | null }[]) {
                    if (r.category) catTally.set(r.category, (catTally.get(r.category) || 0) + 1);
                    if (r.bucket_id) bucketTally.set(r.bucket_id, (bucketTally.get(r.bucket_id) || 0) + 1);
                }
                const topCat = [...catTally.entries()].sort((a, b) => b[1] - a[1])[0];
                setSuggestedCategory(topCat && topCat[0] !== selectedCategory ? topCat[0] : null);
                const topBucket = [...bucketTally.entries()].sort((a, b) => b[1] - a[1])[0];
                setSuggestedBucket(topBucket && topBucket[0] !== selectedBucketId ? topBucket[0] : null);

                // Top 3 distinct descriptions (case-insensitive)
                const seen = new Set<string>();
                const distinct: DescriptionSuggestion[] = [];
                for (const r of data as DescriptionSuggestion[]) {
                    const key = (r.description || '').trim().toLowerCase();
                    if (!key) continue;
                    if (seen.has(key)) continue;
                    if (key === trimmed.toLowerCase()) continue;
                    seen.add(key);
                    distinct.push(r);
                    if (distinct.length >= 3) break;
                }
                setDescriptionSuggestions(distinct);
            } catch (error) {
                console.error('Error fetching description suggestions:', error);
            }
        }, 300);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [description, userId, selectedCategory, selectedBucketId]);

    // Place-based smart defaults: when user picks a place (or it's auto-set by scan/Quick Pin),
    // fetch the most common category/payment/bucket for that exact place_name and surface
    // a single "Apply suggestions" chip the user can tap to fill all three at once.
    useEffect(() => {
        if (!userId || !placeName) {
            setSmartDefaults(null);
            return;
        }
        let cancelled = false;
        const timer = setTimeout(async () => {
            try {
                const { data } = await supabase
                    .from('transactions')
                    .select('category, payment_method, bucket_id')
                    .eq('user_id', userId)
                    .eq('place_name', placeName)
                    .order('created_at', { ascending: false })
                    .limit(20);
                if (cancelled) return;
                if (!data || data.length < 2) {
                    setSmartDefaults(null);
                    return;
                }
                const tallyOf = <T extends string | null>(rows: { v: T }[]) => {
                    const m = new Map<T, number>();
                    for (const r of rows) {
                        if (r.v == null) continue;
                        m.set(r.v, (m.get(r.v) || 0) + 1);
                    }
                    return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
                };
                const cat = tallyOf(data.map(r => ({ v: r.category as string | null })));
                const pay = tallyOf(data.map(r => ({ v: r.payment_method as SmartDefaults['payment_method'] })));
                const buck = tallyOf(data.map(r => ({ v: r.bucket_id as string | null })));

                // Only surface fields that differ from current form state.
                const next: SmartDefaults = {
                    category: cat && cat !== selectedCategory ? cat : null,
                    payment_method: pay && pay !== paymentMethod ? pay : null,
                    bucket_id: buck && buck !== selectedBucketId ? buck : null,
                };
                if (!next.category && !next.payment_method && !next.bucket_id) {
                    setSmartDefaults(null);
                } else {
                    setSmartDefaults(next);
                }
            } catch (error) {
                console.error('Error fetching place smart defaults:', error);
            }
        }, 250);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [userId, placeName, selectedCategory, paymentMethod, selectedBucketId]);

    const resetForm = () => {
        setAmount('');
        setDescription('');
        setNotes('');
        setSelectedCategory(quickAddDefaults.category ?? 'food');
        setDate(new Date());
        setPaymentMethod(quickAddDefaults.paymentMethod ?? 'Cash');
        setTxCurrency(defaultCurrency);
        setSelectedBucketId(quickAddDefaults.bucketId ?? null);
        setIsSplitEnabled(defaultSplitEnabled);
        setSelectedGroupId(activeWorkspaceId);
        setSelectedFriendIds([]);
        setSplitMode('even');
        setCustomAmounts({});
        setIsRecurring(false);
        setFrequency('monthly');
        setIsIncome(false);
        setExcludeFromAllowance(false);
        setPlaceName(null);
        setPlaceAddress(null);
        setPlaceLat(null);
        setPlaceLng(null);
        setTags([]);
        setSuggestedCategory(null);
        setSuggestedBucket(null);
        setDescriptionSuggestions([]);
        setSmartDefaults(null);
        if (typeof window !== 'undefined') {
            try { sessionStorage.removeItem(draftKey); } catch { /* noop */ }
        }
    };

    return {
        selectedCategory, setSelectedCategory,
        amount, setAmount,
        description, setDescription,
        notes, setNotes,
        date, setDate,
        paymentMethod, setPaymentMethod,
        txCurrency, setTxCurrency,
        selectedBucketId, setSelectedBucketId,
        isSplitEnabled, setIsSplitEnabled,
        selectedGroupId, setSelectedGroupId,
        selectedFriendIds, setSelectedFriendIds,
        splitMode, setSplitMode,
        customAmounts, setCustomAmounts,
        isRecurring, setIsRecurring,
        frequency, setFrequency,
        isIncome, setIsIncome,
        excludeFromAllowance, setExcludeFromAllowance,
        placeName, setPlaceName,
        placeAddress, setPlaceAddress,
        placeLat, setPlaceLat,
        placeLng, setPlaceLng,
        suggestedLocations, setSuggestedLocations,
        tags, setTags,
        knownTags,
        suggestedCategory, setSuggestedCategory,
        suggestedBucket, setSuggestedBucket,
        descriptionSuggestions, setDescriptionSuggestions,
        smartDefaults, setSmartDefaults,
        resetForm
    };
}
