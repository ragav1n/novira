'use client';

import React, { useEffect } from 'react';
import { ChevronLeft, CreditCard, Utensils, Car, Zap, ShoppingBag, HeartPulse, Clapperboard, Wallet, Banknote, HelpCircle, Calendar as CalendarIcon, Home, School, LayoutGrid, Building2, MapPin, Shirt, ShoppingCart, LocateFixed } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useIsNative } from '@/hooks/use-native';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FloatingLabelInput } from '@/components/ui/floating-label';
import { format } from "date-fns";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TimePicker } from "@/components/ui/datetime-picker";
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { useGroups } from '@/components/providers/groups-provider';
import { useBuckets } from '@/components/providers/buckets-provider';
import { Switch } from '@/components/ui/switch';
import { CurrencyDropdown } from '@/components/ui/currency-dropdown';
import dynamic from 'next/dynamic';

const LocationPicker: any = dynamic(() => import('@/components/ui/location-picker').then(mod => mod.LocationPicker as any), { ssr: false });
const SplitExpenseSection: any = dynamic(() => import('./add-expense/split-expense-section').then(mod => mod.SplitExpenseSection as any), { ssr: false });
const RecurringExpenseSection: any = dynamic(() => import('./add-expense/recurring-expense-section').then(mod => mod.RecurringExpenseSection as any), { ssr: false });

import { CategorySelector, BucketSelector } from './add-expense/selectors';
import { useExpenseForm } from '@/hooks/useExpenseForm';
import { useExpenseSubmission } from '@/hooks/useExpenseSubmission';
import { getDistance } from '@/lib/location';

import { CATEGORY_COLORS, getIconForCategory, CATEGORIES as SYSTEM_CATEGORIES } from '@/lib/categories';

const dropdownCategories = SYSTEM_CATEGORIES.map(cat => ({
    id: cat.id,
    label: cat.label,
    icon: (props: any) => getIconForCategory(cat.id, props.className || "w-4 h-4", props),
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
    const { currency, userId, CURRENCY_SYMBOLS, activeWorkspaceId } = useUserPreferences();
    const { groups, friends } = useGroups();
    const { buckets } = useBuckets();
    const [currentPos, setCurrentPos] = React.useState<{ lat: number, lng: number } | null>(null);

    const activeGroup = groups.find(g => g.id === activeWorkspaceId);
    const isSharedWorkspace = activeGroup?.type === 'couple' || activeGroup?.type === 'home';
    const defaultSplitEnabled = activeWorkspaceId ? !isSharedWorkspace : false;

    const formState = useExpenseForm(userId, currency, activeWorkspaceId, defaultSplitEnabled);
    const { handleSubmit, loading } = useExpenseSubmission();

    const onSubmit = () => {
        if (isNative) Haptics.impact({ style: ImpactStyle.Medium }).catch(() => { });
        handleSubmit({
            userId, isNative, router, currency, resetForm: formState.resetForm,
            amount: formState.amount, description: formState.description, date: formState.date,
            selectedCategory: formState.selectedCategory, txCurrency: formState.txCurrency,
            selectedGroupId: formState.selectedGroupId, selectedBucketId: formState.selectedBucketId,
            excludeFromAllowance: formState.excludeFromAllowance, placeName: formState.placeName,
            placeAddress: formState.placeAddress, placeLat: formState.placeLat, placeLng: formState.placeLng,
            paymentMethod: formState.paymentMethod, notes: formState.notes, isSplitEnabled: formState.isSplitEnabled,
            selectedFriendIds: formState.selectedFriendIds, splitMode: formState.splitMode,
            customAmounts: formState.customAmounts, isRecurring: formState.isRecurring, frequency: formState.frequency
        });
    };
    
    // Detect location once for suggestion sorting
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setCurrentPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                null,
                { enableHighAccuracy: false, timeout: 5000 }
            );
        }
    }, []);

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
        <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative"
        >
            <div className={cn(
                "p-5 space-y-6 max-w-md mx-auto pt-4 relative min-h-screen z-10"
            )}>

                {/* Header */}
                <div className="flex items-center justify-between relative min-h-[40px]">
                    <button
                        onClick={() => {
                            if (isNative) Haptics.impact({ style: ImpactStyle.Light }).catch(() => { });
                            router.back();
                        }}
                        className="p-2 rounded-full bg-secondary/30 hover:bg-secondary/50 transition-colors shrink-0 z-10"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <h2 className={cn(
                            "text-lg font-bold truncate px-12 text-center leading-tight transition-colors duration-500",
                            formState.selectedBucketId ? "text-cyan-400" : "text-foreground"
                        )}>
                            {formState.selectedBucketId ? buckets.find(b => b.id === formState.selectedBucketId)?.name : "Add Expense"}
                        </h2>
                    </div>
                    <button
                        onClick={onSubmit}
                        disabled={loading}
                        className="text-sm font-medium text-primary hover:text-primary/80 disabled:opacity-50 shrink-0 z-10"
                    >
                        {loading ? 'Saving...' : 'Save'}
                    </button>
                </div>

                {/* Amount Input */}
                <div className="space-y-2">
                    <label className="text-sm font-medium">Amount *</label>
                    <div className="relative">
                        <Input
                            value={formState.amount}
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            onChange={(e) => formState.setAmount(e.target.value)}
                            className="h-16 text-3xl font-bold pl-12 bg-secondary/10 border-primary/50 focus-visible:ring-primary/50"
                        />
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-primary">
                            {CURRENCY_SYMBOLS[formState.txCurrency as keyof typeof CURRENCY_SYMBOLS] || '$'}
                        </span>
                    </div>
                    <div className="mt-2">
                        <CurrencyDropdown value={formState.txCurrency} onValueChange={(val) => formState.setTxCurrency(val as any)} />
                    </div>
                </div>

                {/* Description */}
                <div className="space-y-4">
                    <FloatingLabelInput
                        id="description"
                        label="Description *"
                        value={formState.description}
                        onChange={(e) => formState.setDescription(e.target.value)}
                        className="bg-secondary/10 border-white/10 h-14"
                    />
                </div>

                <div className="space-y-2 min-h-[96px]"> {/* Stabilized height for Quick Pins */}
                    <div className="flex items-center gap-1.5 ml-1 h-3">
                        {sortedSuggestions.length > 0 && (
                            <label className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest flex items-center gap-1.5 animate-in fade-in duration-500">
                                <LocateFixed className="w-2.5 h-2.5" />
                                Quick Pins
                            </label>
                        )}
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
                                                key={`${loc.name}-${i}-${loc.type}`}
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
                        onChange={(loc: any) => {
                            formState.setPlaceName(loc.place_name);
                            formState.setPlaceAddress(loc.place_address);
                            formState.setPlaceLat(loc.place_lat);
                            formState.setPlaceLng(loc.place_lng);
                        }}
                    />
                </div>

                {/* Category Selection */}
                <CategorySelector
                    categories={dropdownCategories as any}
                    selectedCategory={formState.selectedCategory}
                    onSelect={formState.setSelectedCategory}
                />

                {/* Personal Bucket Selection */}
                <BucketSelector
                    buckets={buckets}
                    selectedBucketId={formState.selectedBucketId}
                    setSelectedBucketId={formState.setSelectedBucketId}
                />

                {/* Date & Payment */}
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Date *</label>
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
                        <label className="text-sm font-medium">Payment Method</label>
                        <div className="grid grid-cols-2 gap-2">
                            {(['Cash', 'UPI', 'Debit Card', 'Credit Card', 'Bank Transfer'] as const).map((method, index) => {
                                const isSelected = formState.paymentMethod === method;
                                const color = PAYMENT_METHOD_COLORS[method];

                                return (
                                    <div
                                        key={method}
                                        onClick={() => formState.setPaymentMethod(method as any)}
                                        className={cn(
                                            "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                                            isSelected
                                                ? "border-white/20 shadow-lg"
                                                : "bg-secondary/10 border-white/5 hover:bg-secondary/20",
                                            index === 4 && "col-span-2"
                                        )}
                                        style={{
                                            backgroundColor: isSelected ? `${color}20` : undefined,
                                            borderColor: isSelected ? color : undefined,
                                        }}
                                    >
                                        <div
                                            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors"
                                            style={{
                                                backgroundColor: isSelected ? `${color}30` : 'rgba(255,255,255,0.05)',
                                                color: isSelected ? color : 'inherit'
                                            }}
                                        >
                                            {method === 'Cash' ? <Banknote className="w-4 h-4" /> :
                                                method === 'UPI' ? <Wallet className="w-4 h-4" /> :
                                                    method === 'Debit Card' ? <CreditCard className="w-4 h-4" /> :
                                                        method === 'Credit Card' ? <Wallet className="w-4 h-4" /> :
                                                            <Building2 className="w-4 h-4" />}
                                        </div>
                                        <span
                                            className="text-sm font-medium transition-colors"
                                            style={{ color: isSelected ? color : undefined }}
                                        >
                                            {method}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Exclude from Allowance Toggle */}
                <div className="space-y-4 p-4 rounded-2xl bg-secondary/10 border border-white/5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center shrink-0">
                                <Wallet className="w-4 h-4 text-cyan-500" />
                            </div>
                            <div>
                                <p className="text-sm font-medium">Exclude from Allowance</p>
                                <p className="text-[11px] text-muted-foreground">Don't count this against your monthly limit</p>
                            </div>
                        </div>
                        <Switch
                            checked={formState.excludeFromAllowance}
                            onCheckedChange={formState.setExcludeFromAllowance}
                            className="data-[state=checked]:bg-cyan-500"
                        />
                    </div>
                </div>

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
                    currency={currency}
                    CURRENCY_SYMBOLS={CURRENCY_SYMBOLS}
                />

                {/* Recurring Expense Section */}
                <RecurringExpenseSection
                    isRecurring={formState.isRecurring}
                    setIsRecurring={formState.setIsRecurring}
                    frequency={formState.frequency}
                    setFrequency={formState.setFrequency}
                    date={formState.date}
                />

                {/* Notes */}
                <div className="space-y-2">
                    <label className="text-sm font-medium">Notes (Optional)</label>
                    <Textarea
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
                    className="w-full h-12 text-base font-semibold shadow-[0_0_20px_rgba(138,43,226,0.3)] hover:shadow-[0_0_30px_rgba(138,43,226,0.5)] transition-all"
                >
                    {loading ? 'Adding Expense...' : 'Add Expense'}
                </Button>
            </div>
        </motion.div>
    );
}
