import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useExpenseForm(userId: string | null | undefined, defaultCurrency: string, activeWorkspaceId: string | null = null, defaultSplitEnabled: boolean = !!activeWorkspaceId) {
    const [selectedCategory, setSelectedCategory] = useState('food');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [notes, setNotes] = useState('');
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Debit Card' | 'Credit Card' | 'UPI' | 'Bank Transfer'>('Cash');
    const [txCurrency, setTxCurrency] = useState(defaultCurrency);
    const [selectedBucketId, setSelectedBucketId] = useState<string | null>(null);

    useEffect(() => {
        setTxCurrency(defaultCurrency);
    }, [defaultCurrency]);

    // Splitting State
    const [isSplitEnabled, setIsSplitEnabled] = useState(defaultSplitEnabled);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(activeWorkspaceId);
    const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
    const [splitMode, setSplitMode] = useState<'even' | 'custom'>('even');
    const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

    // Recurring State
    const [isRecurring, setIsRecurring] = useState(false);
    const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');

    // Exclusion State
    const [excludeFromAllowance, setExcludeFromAllowance] = useState(false);

    // Location State
    const [placeName, setPlaceName] = useState<string | null>(null);
    const [placeAddress, setPlaceAddress] = useState<string | null>(null);
    const [placeLat, setPlaceLat] = useState<number | null>(null);
    const [placeLng, setPlaceLng] = useState<number | null>(null);
    const [suggestedLocations, setSuggestedLocations] = useState<{ name: string, address: string, lat: number, lng: number, type: 'last' | 'frequent' | 'category' }[]>([]);

    // Tag State
    const [tags, setTags] = useState<string[]>([]);
    const [knownTags, setKnownTags] = useState<string[]>([]);
    const [suggestedCategory, setSuggestedCategory] = useState<string | null>(null);

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

    // Smart category suggestion: when description matches a past transaction,
    // surface its category as a tap-to-apply chip. Skips when the user has
    // already changed the category from the default.
    useEffect(() => {
        if (!userId) {
            setSuggestedCategory(null);
            return;
        }
        const trimmed = description.trim();
        if (trimmed.length < 3) {
            setSuggestedCategory(null);
            return;
        }
        let cancelled = false;
        const timer = setTimeout(async () => {
            try {
                const escaped = trimmed.replace(/[%_\\]/g, '\\$&');
                const { data } = await supabase
                    .from('transactions')
                    .select('category')
                    .eq('user_id', userId)
                    .ilike('description', `%${escaped}%`)
                    .order('created_at', { ascending: false })
                    .limit(8);
                if (cancelled) return;

                if (!data || data.length === 0) {
                    setSuggestedCategory(null);
                    return;
                }
                // Pick the most common category among recent matches.
                const tally = new Map<string, number>();
                for (const r of data as { category: string }[]) {
                    if (!r.category) continue;
                    tally.set(r.category, (tally.get(r.category) || 0) + 1);
                }
                const top = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
                setSuggestedCategory(top && top[0] !== selectedCategory ? top[0] : null);
            } catch (error) {
                console.error('Error fetching category suggestion:', error);
            }
        }, 350);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [description, userId, selectedCategory]);

    const resetForm = () => {
        setAmount('');
        setDescription('');
        setNotes('');
        setSelectedCategory('food');
        setDate(new Date());
        setPaymentMethod('Cash');
        setTxCurrency(defaultCurrency);
        setSelectedBucketId(null);
        setIsSplitEnabled(defaultSplitEnabled);
        setSelectedGroupId(activeWorkspaceId);
        setSelectedFriendIds([]);
        setSplitMode('even');
        setCustomAmounts({});
        setIsRecurring(false);
        setFrequency('monthly');
        setExcludeFromAllowance(false);
        setPlaceName(null);
        setPlaceAddress(null);
        setPlaceLat(null);
        setPlaceLng(null);
        setTags([]);
        setSuggestedCategory(null);
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
        excludeFromAllowance, setExcludeFromAllowance,
        placeName, setPlaceName,
        placeAddress, setPlaceAddress,
        placeLat, setPlaceLat,
        placeLng, setPlaceLng,
        suggestedLocations, setSuggestedLocations,
        tags, setTags,
        knownTags,
        suggestedCategory, setSuggestedCategory,
        resetForm
    };
}
