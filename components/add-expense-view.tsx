'use client';

import React, { useState } from 'react';
import { ChevronLeft, Sparkles, Calendar, CreditCard, Utensils, Car, Zap, ShoppingBag, HeartPulse, Clapperboard, Layers } from 'lucide-react';
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
    const [amount, setAmount] = useState('45.80');
    const [date, setDate] = useState<Date | undefined>(new Date());

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
                    <p className="text-xs text-muted-foreground">2 of 5</p>
                </div>
                <button className="text-sm font-medium text-primary hover:text-primary/80">Next</button>
            </div>

            {/* Amount Input */}
            <div className="space-y-2">
                <label className="text-sm font-medium">Amount *</label>
                <div className="relative">
                    <Input
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="h-16 text-3xl font-bold pl-12 bg-secondary/10 border-primary/50 focus-visible:ring-primary/50"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-primary">$</span>
                </div>
            </div>

            {/* Description */}
            <div className="space-y-4">
                <FloatingLabelInput
                    id="description"
                    label="Description"
                    defaultValue="Whole Foods Market"
                    className="bg-secondary/10 border-white/10 h-14"
                />

                {/* AI Suggestion */}
                <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/20">
                    <div className="flex items-start gap-2">
                        <Sparkles className="w-4 h-4 text-primary mt-0.5" />
                        <div className="space-y-1 w-full">
                            <p className="text-xs font-medium text-primary">AI Suggestion</p>
                            <p className="text-xs text-muted-foreground">This looks like a Food & Dining expense</p>
                            <Button size="sm" className="w-full mt-2 h-7 text-xs bg-primary hover:bg-primary/90">
                                <Sparkles className="w-3 h-3 mr-1" />
                                Apply Suggestion
                            </Button>
                        </div>
                    </div>
                </div>
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
                    <label className="text-sm font-medium">Payment</label>
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-secondary/10 border border-white/10 h-12">
                        <CreditCard className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">Credit Card</span>
                    </div>
                </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
                <label className="text-sm font-medium">Notes (Optional)</label>
                <Textarea
                    placeholder="Add notes..."
                    className="bg-secondary/10 border-white/10 resize-none min-h-[80px]"
                    defaultValue="Weekly grocery shopping..."
                />
            </div>

            {/* Main Action Button */}
            <Button className="w-full h-12 text-base font-semibold shadow-[0_0_20px_rgba(138,43,226,0.3)] hover:shadow-[0_0_30px_rgba(138,43,226,0.5)] transition-all">
                Add Expense
            </Button>

            {/* Spacer for bottom nav */}
            <div className="h-20" />
        </div>
    );
}
