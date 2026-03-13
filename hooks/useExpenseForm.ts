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
                    const { data: descMatches } = await supabase
                        .from('transactions')
                        .select('place_name, place_address, place_lat, place_lng')
                        .eq('user_id', userId)
                        .ilike('description', description)
                        .not('place_name', 'is', null)
                        .order('created_at', { ascending: false })
                        .limit(1);

                    if (descMatches?.[0]) {
                        const loc = descMatches[0];
                        if (loc.place_name !== placeName) {
                            suggestions.push({ ...loc, name: loc.place_name, address: loc.place_address, lat: loc.place_lat, lng: loc.place_lng, type: 'last' });
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
                    .limit(5);

                if (catMatches) {
                    catMatches.forEach(loc => {
                        if (loc.place_name && !seenNames.has(loc.place_name) && loc.place_name !== placeName) {
                            suggestions.push({ ...loc, name: loc.place_name, address: loc.place_address, lat: loc.place_lat, lng: loc.place_lng, type: 'category' });
                            seenNames.add(loc.place_name);
                        }
                    });
                }

                // 3. Frequent overall (If still space)
                if (suggestions.length < 12) {
                    const { data: frequent } = await supabase
                        .from('transactions')
                        .select('place_name, place_address, place_lat, place_lng')
                        .eq('user_id', userId)
                        .not('place_name', 'is', null)
                        .limit(30); // Get more to find variety

                    if (frequent) {
                        for (const loc of frequent) {
                            if (suggestions.length >= 12) break;
                            if (loc.place_name && !seenNames.has(loc.place_name) && loc.place_name !== placeName) {
                                suggestions.push({ ...loc, name: loc.place_name, address: loc.place_address, lat: loc.place_lat, lng: loc.place_lng, type: 'frequent' });
                                seenNames.add(loc.place_name);
                            }
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
        resetForm
    };
}
