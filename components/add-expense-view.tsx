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

    const handleSubmit = async () => {
        if (!amount || !description || !date) {
            toast.error('Please fill in all required fields');
            return;
        }

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                toast.error('You must be logged in');
                router.push('/signin');
                return;
            }

            const { error } = await supabase.from('transactions').insert({
                user_id: user.id,
                amount: parseFloat(amount),
                description,
                category: selectedCategory,
                date: format(date, 'yyyy-MM-dd'),
                payment_method: paymentMethod,
                notes
            });

            if (error) throw error;

            toast.success('Expense added successfully!');
            router.push('/');
        } catch (error: any) {
            toast.error('Failed to add expense: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-5 space-y-6 max-w-md mx-auto pt-4 relative">
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
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-primary">{currency === 'EUR' ? '€' : '$'}</span>
                </div>
            </div>

            {/* Description */}
            <div className="space-y-4">
                <FloatingLabelInput
                    id="description"
                    label="Description"
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
                    <label className="text-sm font-medium">Date</label>
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

            {/* Spacer for bottom nav */}
            <div className="h-20" />
        </div>
    );
}
