'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeft, CreditCard, Utensils, Car, Zap, ShoppingBag, HeartPulse, Clapperboard, Wallet, Banknote, HelpCircle, RefreshCcw, Calendar as CalendarIcon, Users, User, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FloatingLabelInput } from '@/components/ui/floating-label';
import { FluidDropdown, type Category } from '@/components/ui/fluid-dropdown';
import { format } from "date-fns";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TimePicker } from "@/components/ui/datetime-picker";
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { useGroups } from '@/components/providers/groups-provider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';

const dropdownCategories: Category[] = [
    { id: 'food', label: 'Food & Dining', icon: Utensils, color: '#FF6B6B' },
    { id: 'transport', label: 'Transportation', icon: Car, color: '#4ECDC4' },
    { id: 'bills', label: 'Bills & Utilities', icon: Zap, color: '#F9C74F' },
    { id: 'shopping', label: 'Shopping', icon: ShoppingBag, color: '#A06CD5' },
    { id: 'healthcare', label: 'Healthcare', icon: HeartPulse, color: '#FF9F1C' },
    { id: 'entertainment', label: 'Entertainment', icon: Clapperboard, color: '#FF1493' },
    { id: 'others', label: 'Others', icon: HelpCircle, color: '#C7F464' },
    { id: 'uncategorized', label: 'Uncategorized', icon: HelpCircle, color: '#94A3B8' },
];

export function AddExpenseView() {
    const router = useRouter();
    const [selectedCategory, setSelectedCategory] = useState('food');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [notes, setNotes] = useState('');
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Debit Card' | 'Credit Card'>('Cash');
    const [loading, setLoading] = useState(false);
    const { currency, userId, formatCurrency, convertAmount } = useUserPreferences();
    const [txCurrency, setTxCurrency] = useState(currency);
    const { groups, friends } = useGroups();

    useEffect(() => {
        setTxCurrency(currency);
    }, [currency]);

    // Splitting State
    const [isSplitEnabled, setIsSplitEnabled] = useState(false);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);

    // Recurring State
    const [isRecurring, setIsRecurring] = useState(false);
    const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');

    const handleSubmit = async () => {
        if (!amount || parseFloat(amount) <= 0 || !description || !date) {
            if (amount && parseFloat(amount) <= 0) {
                toast.error('Amount must be greater than 0');
                return;
            }
            toast.error('Please fill in all required fields');
            return;
        }

        setLoading(true);
        try {
            if (!userId) {
                toast.error('You must be logged in');
                router.push('/signin');
                return;
            }

            let exchangeRate = 1;
            let convertedAmount = parseFloat(amount);

            if (txCurrency !== currency) {
                try {
                    const dateStr = format(date, 'yyyy-MM-dd');
                    let response = await fetch(`https://api.frankfurter.dev/v1/${dateStr}?from=${txCurrency}&to=${currency}`);

                    if (!response.ok) {
                        console.warn('Failed to fetch specific date rate, falling back to latest');
                        response = await fetch(`https://api.frankfurter.dev/v1/latest?from=${txCurrency}&to=${currency}`);
                    }

                    if (response.ok) {
                        const data = await response.json();
                        exchangeRate = data.rates[currency];
                        convertedAmount = parseFloat(amount) * exchangeRate;
                    }
                } catch (e) {
                    console.error('Error fetching historical rate:', e);
                }
            }

            const { data: transaction, error: txError } = await supabase.from('transactions').insert({
                user_id: userId,
                amount: parseFloat(amount),
                description,
                category: selectedCategory,
                date: format(date, 'yyyy-MM-dd'),
                payment_method: paymentMethod,
                notes,
                currency: txCurrency,
                group_id: selectedGroupId,
                exchange_rate: exchangeRate,
                base_currency: currency,
                converted_amount: convertedAmount
            }).select().single();

            if (txError) throw txError;

            // Handle Splits
            if (isSplitEnabled) {
                let debtors: string[] = [];
                if (selectedGroupId) {
                    const { data: members } = await supabase
                        .from('group_members')
                        .select('user_id')
                        .eq('group_id', selectedGroupId);

                    if (members) {
                        debtors = members.map(m => m.user_id).filter(id => id !== userId);
                    }
                } else {
                    debtors = selectedFriendIds;
                }

                if (debtors.length > 0) {
                    const splitAmount = parseFloat(amount) / (debtors.length + 1);
                    const splitRecords = debtors.map(debtorId => ({
                        transaction_id: transaction.id,
                        user_id: debtorId,
                        amount: splitAmount,
                        is_paid: false
                    }));

                    const { error: splitError } = await supabase.from('splits').insert(splitRecords);
                    if (splitError) throw splitError;
                }
            }

            // Handle Recurring
            if (isRecurring) {
                const nextDate = new Date(date);
                if (frequency === 'daily') nextDate.setDate(nextDate.getDate() + 1);
                else if (frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
                else if (frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
                else if (frequency === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);

                const { error: recurringError } = await supabase.from('recurring_templates').insert({
                    user_id: userId,
                    description,
                    amount: parseFloat(amount),
                    category: selectedCategory,
                    currency: txCurrency,
                    group_id: selectedGroupId,
                    payment_method: paymentMethod,
                    frequency,
                    next_occurrence: format(nextDate, 'yyyy-MM-dd'),
                    metadata: {
                        is_split: isSplitEnabled,
                        friend_ids: selectedFriendIds,
                        notes
                    }
                });

                if (recurringError) throw recurringError;
            }

            toast.success('Expense added successfully!');
            router.push('/');
        } catch (error: any) {
            toast.error('Failed to add expense: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-5 space-y-6 max-w-md mx-auto pt-4 relative min-h-full">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-full bg-secondary/30 hover:bg-secondary/50 transition-colors"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="text-center">
                    <h2 className="text-lg font-semibold">Add Expense</h2>
                </div>
                <button onClick={handleSubmit} disabled={loading} className="text-sm font-medium text-primary hover:text-primary/80 disabled:opacity-50">
                    {loading ? 'Saving...' : 'Save'}
                </button>
            </div>

            {/* Amount Input */}
            <div className="space-y-2">
                <label className="text-sm font-medium">Amount *</label>
                <div className="relative">
                    <Input
                        value={amount}
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        onChange={(e) => setAmount(e.target.value)}
                        className="h-16 text-3xl font-bold pl-12 bg-secondary/10 border-primary/50 focus-visible:ring-primary/50"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-primary">
                        {txCurrency === 'EUR' ? '€' : txCurrency === 'INR' ? '₹' : '$'}
                    </span>
                </div>
                <div className="flex gap-2 mt-2">
                    {['USD', 'EUR', 'INR'].map((curr) => (
                        <button
                            key={curr}
                            onClick={() => setTxCurrency(curr as any)}
                            className={cn(
                                "flex-1 py-1 text-xs rounded-md border transition-all",
                                txCurrency === curr
                                    ? "bg-primary/20 border-primary text-primary font-medium"
                                    : "bg-secondary/10 border-white/5 hover:bg-secondary/20 text-muted-foreground"
                            )}
                        >
                            {curr}
                        </button>
                    ))}
                </div>
            </div>

            {/* Description */}
            <div className="space-y-4">
                <FloatingLabelInput
                    id="description"
                    label="Description *"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="bg-secondary/10 border-white/10 h-14"
                />
            </div>

            {/* Category Selection */}
            <div className="space-y-2">
                <label className="text-sm font-medium">Category *</label>
                <FluidDropdown
                    items={dropdownCategories}
                    onSelect={(cat) => setSelectedCategory(cat.id)}
                    className="w-full max-w-none"
                />
            </div>

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
                                    !date && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {date ? format(date, "PPP p") : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-card border-white/10 text-foreground" align="center">
                            <CalendarComponent
                                mode="single"
                                selected={date}
                                onSelect={setDate}
                                initialFocus
                                className="p-3"
                            />
                            <div className="p-3 border-t border-white/10">
                                <TimePicker setDate={setDate} date={date} />
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium">Payment Method</label>
                    <div className="grid grid-cols-3 gap-2">
                        {(['Cash', 'Debit Card', 'Credit Card'] as const).map((method) => (
                            <div
                                key={method}
                                onClick={() => setPaymentMethod(method)}
                                className={cn(
                                    "flex flex-col items-center justify-center gap-1 p-3 rounded-xl border cursor-pointer transition-all",
                                    paymentMethod === method
                                        ? "bg-primary/20 border-primary text-primary"
                                        : "bg-secondary/10 border-white/10 hover:bg-secondary/20"
                                )}
                            >
                                {method === 'Cash' ? <Banknote className="w-5 h-5" /> : method === 'Debit Card' ? <CreditCard className="w-5 h-5" /> : <Wallet className="w-5 h-5" />}
                                <span className="text-xs">{method.split(' ')[0]}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Split Expense Section */}
            <div className="space-y-4 p-4 rounded-2xl bg-secondary/10 border border-white/5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Users className="w-5 h-5 text-primary" />
                        <div>
                            <p className="text-sm font-medium">Split this expense</p>
                            <p className="text-[10px] text-muted-foreground">Divide cost with others</p>
                        </div>
                    </div>
                    <Switch
                        checked={isSplitEnabled}
                        onCheckedChange={setIsSplitEnabled}
                    />
                </div>

                {isSplitEnabled && (
                    <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="space-y-2">
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Split with Group</p>
                            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
                                {groups.map((group) => (
                                    <div
                                        key={group.id}
                                        onClick={() => {
                                            setSelectedGroupId(selectedGroupId === group.id ? null : group.id);
                                            setSelectedFriendIds([]);
                                        }}
                                        className={cn(
                                            "flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all min-w-[80px] cursor-pointer",
                                            selectedGroupId === group.id
                                                ? "bg-primary/20 border-primary shadow-[0_0_15px_rgba(138,43,226,0.2)]"
                                                : "bg-background/20 border-white/5 hover:border-white/10"
                                        )}
                                    >
                                        <div className="w-10 h-10 rounded-full bg-secondary/30 flex items-center justify-center relative">
                                            <Users className="w-5 h-5" />
                                            {selectedGroupId === group.id && (
                                                <div className="absolute -top-1 -right-1">
                                                    <CheckCircle2 className="w-4 h-4 text-primary fill-background" />
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-[10px] font-medium truncate w-16 text-center">{group.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Or Split with Friends</p>
                            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
                                {friends.map((friend) => (
                                    <div
                                        key={friend.id}
                                        onClick={() => {
                                            if (selectedGroupId) setSelectedGroupId(null);
                                            setSelectedFriendIds(prev =>
                                                prev.includes(friend.id) ? prev.filter(id => id !== friend.id) : [...prev, friend.id]
                                            );
                                        }}
                                        className={cn(
                                            "flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all min-w-[80px] cursor-pointer",
                                            selectedFriendIds.includes(friend.id)
                                                ? "bg-primary/20 border-primary shadow-[0_0_15px_rgba(138,43,226,0.2)]"
                                                : "bg-background/20 border-white/5 hover:border-white/10"
                                        )}
                                    >
                                        <div className="w-10 h-10 rounded-full overflow-hidden border border-white/5 relative">
                                            {friend.avatar_url ? (
                                                <img src={friend.avatar_url} alt={friend.full_name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-secondary/30">
                                                    <User className="w-5 h-5" />
                                                </div>
                                            )}
                                            {selectedFriendIds.includes(friend.id) && (
                                                <div className="absolute -top-1 -right-1">
                                                    <CheckCircle2 className="w-4 h-4 text-primary fill-background" />
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-[10px] font-medium truncate w-16 text-center">{friend.full_name.split(' ')[0]}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Recurring Expense Section */}
            <div className="space-y-4 p-4 rounded-2xl bg-secondary/10 border border-white/5">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <RefreshCcw className="w-5 h-5 text-primary" />
                        <div>
                            <p className="text-sm font-medium">Recurring Expense</p>
                            <p className="text-[10px] text-muted-foreground">Automatically post this expense</p>
                        </div>
                    </div>
                    <Switch
                        checked={isRecurring}
                        onCheckedChange={setIsRecurring}
                    />
                </div>

                {isRecurring && (
                    <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="grid grid-cols-4 gap-2">
                            {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((freq) => (
                                <button
                                    key={freq}
                                    onClick={() => setFrequency(freq)}
                                    className={cn(
                                        "py-2 text-[10px] font-bold uppercase tracking-wider rounded-xl border transition-all",
                                        frequency === freq
                                            ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                                            : "bg-background/20 border-white/5 text-muted-foreground hover:border-white/10"
                                    )}
                                >
                                    {freq}
                                </button>
                            ))}
                        </div>
                        <p className="text-[10px] text-center text-muted-foreground italic">
                            Next bill: {(() => {
                                const next = new Date(date || new Date());
                                if (frequency === 'daily') next.setDate(next.getDate() + 1);
                                else if (frequency === 'weekly') next.setDate(next.getDate() + 7);
                                else if (frequency === 'monthly') next.setMonth(next.getMonth() + 1);
                                else if (frequency === 'yearly') next.setFullYear(next.getFullYear() + 1);
                                return format(next, 'PPPP');
                            })()}
                        </p>
                    </div>
                )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
                <label className="text-sm font-medium">Notes (Optional)</label>
                <Textarea
                    placeholder="Add notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="bg-secondary/10 border-white/10 resize-none min-h-[80px]"
                />
            </div>

            {/* Main Action Button */}
            <Button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full h-12 text-base font-semibold shadow-[0_0_20px_rgba(138,43,226,0.3)] hover:shadow-[0_0_30px_rgba(138,43,226,0.5)] transition-all"
            >
                {loading ? 'Adding Expense...' : 'Add Expense'}
            </Button>
        </div>
    );
}
