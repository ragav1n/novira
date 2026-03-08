'use client';

import React, { useEffect } from 'react';
import { ChevronLeft, CreditCard, Utensils, Car, Zap, ShoppingBag, HeartPulse, Clapperboard, Wallet, Banknote, HelpCircle, Calendar as CalendarIcon, Home, School, LayoutGrid, Building2, MapPin, Shirt, ShoppingCart } from 'lucide-react';
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
import { LocationPicker } from '@/components/ui/location-picker';
import { CategorySelector, BucketSelector } from './add-expense/selectors';
import { SplitExpenseSection } from './add-expense/split-expense-section';
import { RecurringExpenseSection } from './add-expense/recurring-expense-section';
import { useExpenseForm } from '@/hooks/useExpenseForm';
import { useExpenseSubmission } from '@/hooks/useExpenseSubmission';

const dropdownCategories = [
    { id: 'food', label: 'Food & Dining', icon: Utensils, color: '#FF6B6B' },
    { id: 'groceries', label: 'Groceries', icon: ShoppingCart, color: '#10B981' },
    { id: 'fashion', label: 'Fashion', icon: Shirt, color: '#F472B6' },
    { id: 'transport', label: 'Transportation', icon: Car, color: '#4ECDC4' },
    { id: 'bills', label: 'Bills & Utilities', icon: Zap, color: '#F9C74F' },
    { id: 'shopping', label: 'Shopping', icon: ShoppingBag, color: '#A06CD5' },
    { id: 'healthcare', label: 'Healthcare', icon: HeartPulse, color: '#FF9F1C' },
    { id: 'entertainment', label: 'Entertainment', icon: Clapperboard, color: '#FF1493' },
    { id: 'rent', label: 'Rent', icon: Home, color: '#6366F1' },
    { id: 'education', label: 'Education', icon: School, color: '#84CC16' },
    { id: 'others', label: 'Others', icon: LayoutGrid, color: '#2DD4BF' },
    { id: 'uncategorized', label: 'Uncategorized', icon: HelpCircle, color: '#94A3B8' },
];

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

    const formState = useExpenseForm(userId, currency, activeWorkspaceId);
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



    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 0.8 }}
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

                {/* Smart Location Suggestion */}
                <AnimatePresence>
                    {formState.suggestedLocation && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                            className="flex justify-start"
                        >
                            <button
                                type="button"
                                onClick={() => {
                                    formState.setPlaceName(formState.suggestedLocation!.name);
                                    formState.setPlaceAddress(formState.suggestedLocation!.address);
                                    formState.setPlaceLat(formState.suggestedLocation!.lat);
                                    formState.setPlaceLng(formState.suggestedLocation!.lng);
                                    formState.setSuggestedLocation(null);
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all text-[11px] font-bold"
                            >
                                <MapPin className="w-3 h-3" />
                                Use last location: {formState.suggestedLocation.name}
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Location Picker */}
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
                        <Popover>
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
