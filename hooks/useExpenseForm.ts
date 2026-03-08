import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useExpenseForm(userId: string | null | undefined, defaultCurrency: string, activeWorkspaceId: string | null = null) {
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
    const [isSplitEnabled, setIsSplitEnabled] = useState(!!activeWorkspaceId);
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
    const [suggestedLocation, setSuggestedLocation] = useState<{ name: string, address: string, lat: number, lng: number } | null>(null);

    // Smart Location Memory: Suggest location from previous transactions with same description
    useEffect(() => {
        if (!description || description.length < 3 || !userId) {
            setSuggestedLocation(null);
            return;
        }

        const timer = setTimeout(async () => {
            const { data } = await supabase
                .from('transactions')
                .select('place_name, place_address, place_lat, place_lng')
                .eq('user_id', userId)
                .ilike('description', description)
                .not('place_name', 'is', null)
                .order('created_at', { ascending: false })
                .limit(1);

            if (data && data[0]) {
                const loc = data[0];
                // Only suggest if it's different from the current location
                if (loc.place_name !== placeName) {
                    setSuggestedLocation({
                        name: loc.place_name!,
                        address: loc.place_address!,
                        lat: loc.place_lat!,
                        lng: loc.place_lng!
                    });
                } else {
                    setSuggestedLocation(null);
                }
            } else {
                setSuggestedLocation(null);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [description, userId, placeName]);

    const resetForm = () => {
        setAmount('');
        setDescription('');
        setNotes('');
        setSelectedCategory('food');
        setDate(new Date());
        setPaymentMethod('Cash');
        setTxCurrency(defaultCurrency);
        setSelectedBucketId(null);
        setIsSplitEnabled(!!activeWorkspaceId);
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
        suggestedLocation, setSuggestedLocation,
        resetForm
    };
}
