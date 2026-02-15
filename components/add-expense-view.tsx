'use client';

import React, { useState } from 'react';
import { ChevronLeft, CreditCard, Utensils, Car, Zap, ShoppingBag, HeartPulse, Clapperboard, Wallet, Banknote } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FloatingLabelInput } from '@/components/ui/floating-label';
import { FluidDropdown, type Category } from '@/components/ui/fluid-dropdown';
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TimePicker } from "@/components/ui/datetime-picker";
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { useGroups } from '@/components/providers/groups-provider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Users, User, CheckCircle2 } from 'lucide-react';

const dropdownCategories: Category[] = [
    { id: 'food', label: 'Food & Dining', icon: Utensils, color: '#FF6B6B' },
    { id: 'transport', label: 'Transportation', icon: Car, color: '#4ECDC4' },
    { id: 'bills', label: 'Bills & Utilities', icon: Zap, color: '#F9C74F' },
    { id: 'shopping', label: 'Shopping', icon: ShoppingBag, color: '#A06CD5' },
    { id: 'healthcare', label: 'Healthcare', icon: HeartPulse, color: '#FF9F1C' },
    { id: 'entertainment', label: 'Entertainment', icon: Clapperboard, color: '#2EC4B6' },
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
    const { currency } = useUserPreferences();
    const [txCurrency, setTxCurrency] = useState(currency);
    const { groups, friends } = useGroups();

    // Update txCurrency when profile currency changes (only if user hasn't manually changed it yet, or just default to it)
    // Actually better to just default it on mount, or let it stay if user selected something else.
    // For simplicity, let's just initialize it with currency. 
    React.useEffect(() => {
        setTxCurrency(currency);
    }, [currency]);

    // Splitting State
    const [isSplitEnabled, setIsSplitEnabled] = useState(false);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);

    const handleSubmit = async () => {
        if (!amount || !description || !date) {
            toast.error('Please fill in all required fields');
            return;
        }

        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;
            if (!user) {
                toast.error('You must be logged in');
                router.push('/signin');
                return;
            }

            // Fetch historical rate if needed
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
                    } else {
                        console.error('Failed to fetch exchange rate, using 1:1');
                    }
                } catch (e) {
                    console.error('Error fetching historical rate:', e);
                }
            }

            const { data: transaction, error: txError } = await supabase.from('transactions').insert({
                user_id: user.id,
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
                    // Fetch group members
                    const { data: members } = await supabase
                        .from('group_members')
                        .select('user_id')
                        .eq('group_id', selectedGroupId);

                    if (members) {
                        debtors = members.map(m => m.user_id).filter(id => id !== user.id);
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

            toast.success('Expense added successfully!');
            router.push('/');
        } catch (error: any) {
            toast.error('Failed to add expense: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-5 space-y-6 max-w-md mx-auto pt-4 relative pb-24">
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
                        placeholder="0.00"
                        onChange={(e) => setAmount(e.target.value)}
                        className="h-16 text-3xl font-bold pl-12 bg-secondary/10 border-primary/50 focus-visible:ring-primary/50"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-primary">
                        {txCurrency === 'EUR' ? '€' : txCurrency === 'INR' ? '₹' : '$'}
                    </span>
                </div>
                {/* Currency Selection */}
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
                        <div
                            onClick={() => setPaymentMethod('Cash')}
                            className={cn(
                                "flex flex-col items-center justify-center gap-1 p-3 rounded-xl border cursor-pointer transition-all",
                                paymentMethod === 'Cash'
                                    ? "bg-primary/20 border-primary text-primary"
                                    : "bg-secondary/10 border-white/10 hover:bg-secondary/20"
                            )}
                        >
                            <Banknote className="w-5 h-5" />
                            <span className="text-xs">Cash</span>
                        </div>
                        <div
                            onClick={() => setPaymentMethod('Debit Card')}
                            className={cn(
                                "flex flex-col items-center justify-center gap-1 p-3 rounded-xl border cursor-pointer transition-all",
                                paymentMethod === 'Debit Card'
                                    ? "bg-primary/20 border-primary text-primary"
                                    : "bg-secondary/10 border-white/10 hover:bg-secondary/20"
                            )}
                        >
                            <CreditCard className="w-5 h-5" />
                            <span className="text-xs">Debit</span>
                        </div>
                        <div
                            onClick={() => setPaymentMethod('Credit Card')}
                            className={cn(
                                "flex flex-col items-center justify-center gap-1 p-3 rounded-xl border cursor-pointer transition-all",
                                paymentMethod === 'Credit Card'
                                    ? "bg-primary/20 border-primary text-primary"
                                    : "bg-secondary/10 border-white/10 hover:bg-secondary/20"
                            )}
                        >
                            <Wallet className="w-5 h-5" />
                            <span className="text-xs">Credit</span>
                        </div>
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
                        {/* Group Selection */}
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
                                {groups.length === 0 && (
                                    <p className="text-[11px] text-muted-foreground py-2">No groups found. Create one in Settings.</p>
                                )}
                            </div>
                        </div>

                        {/* Individual Friend Selection */}
                        <div className="space-y-2">
                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Or Split with Friends</p>
                            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
                                {friends.map((friend) => (
                                    <div
                                        key={friend.id}
                                        onClick={() => {
                                            if (selectedGroupId) setSelectedGroupId(null);
                                            setSelectedFriendIds(prev =>
                                                prev.includes(friend.id)
                                                    ? prev.filter(id => id !== friend.id)
                                                    : [...prev, friend.id]
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
                                {friends.length === 0 && (
                                    <p className="text-[11px] text-muted-foreground py-2">No friends found.</p>
                                )}
                            </div>
                        </div>

                        {/* Split Summary */}
                        {(selectedGroupId || selectedFriendIds.length > 0) && (
                            <div className="bg-primary/5 rounded-xl p-3 border border-primary/10">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-muted-foreground">Splitting with:</span>
                                    <span className="font-semibold text-primary">
                                        {selectedGroupId ? "Group" : `${selectedFriendIds.length} Friend${selectedFriendIds.length > 1 ? 's' : ''}`}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center text-xs mt-1">
                                    <span className="text-muted-foreground">Each person pays:</span>
                                    <span className="font-bold">
                                        {(parseFloat(amount || '0') / ((selectedGroupId ? (groups.find(g => g.id === selectedGroupId)?.members.length || 1) : selectedFriendIds.length + 1))).toFixed(2)} {currency === 'INR' ? '₹' : currency === 'EUR' ? '€' : '$'}
                                    </span>
                                </div>
                            </div>
                        )}
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
