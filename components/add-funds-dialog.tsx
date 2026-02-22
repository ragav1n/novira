'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { toast } from '@/utils/haptics';
import { CurrencyDropdown } from '@/components/ui/currency-dropdown';
import { useUserPreferences, CURRENCY_DETAILS } from '@/components/providers/user-preferences-provider';

type AddFundsDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    userId: string | null;
    defaultBucketId?: string; // Optional: If we want to pre-fill the bucket based on the dashboard focus
    onSuccess?: () => void;
};

export function AddFundsDialog({ isOpen, onClose, userId, defaultBucketId, onSuccess }: AddFundsDialogProps) {
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const { currency, CURRENCY_SYMBOLS } = useUserPreferences();
    const [txCurrency, setTxCurrency] = useState(currency);

    React.useEffect(() => {
        setTxCurrency(currency);
    }, [currency]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!amount || parseFloat(amount) <= 0) {
            toast.error('Amount is required and must be greater than 0');
            return;
        }

        if (!description || description.trim() === '') {
            toast.error('Description is required');
            return;
        }
        
        if (!userId) {
            toast.error('Not logged in');
            return;
        }

        setLoading(true);

        try {
            const fundAmount = -Math.abs(parseFloat(amount));
            let exchangeRate = 1;
            let convertedAmount = fundAmount;

            if (txCurrency !== currency) {
                const FRANKFURTER_SUPPORTED = [
                    'AUD', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK', 'EUR', 'GBP', 'HKD',
                    'HUF', 'IDR', 'ILS', 'INR', 'ISK', 'JPY', 'KRW', 'MXN', 'MYR', 'NOK',
                    'NZD', 'PHP', 'PLN', 'RON', 'SEK', 'SGD', 'THB', 'TRY', 'USD', 'ZAR'
                ];

                try {
                    const dateStr = format(new Date(), 'yyyy-MM-dd');
                    let rate: number | null = null;

                    if (FRANKFURTER_SUPPORTED.includes(txCurrency) && FRANKFURTER_SUPPORTED.includes(currency)) {
                        const response = await fetch(`https://api.frankfurter.dev/v1/${dateStr}?from=${txCurrency}&to=${currency}`);
                        if (response.ok) {
                            const data = await response.json();
                            rate = data.rates[currency];
                        }
                    }

                    if (!rate) {
                        const API_KEY = process.env.NEXT_PUBLIC_EXCHANGERATE_API_KEY;
                        if (API_KEY) {
                            const url = `https://v6.exchangerate-api.com/v6/${API_KEY}/latest/${txCurrency}`;
                            const response = await fetch(url);
                            if (response.ok) {
                                const data = await response.json();
                                rate = data.conversion_rates[currency];
                            }
                        }
                    }

                    if (rate) {
                        exchangeRate = rate;
                        convertedAmount = fundAmount * exchangeRate;
                    }
                } catch (e) {
                    console.error('Error fetching historical rate:', e);
                }
            }

            const { error } = await supabase.from('transactions').insert({
                user_id: userId,
                amount: fundAmount,
                description,
                category: 'income',
                date: format(new Date(), 'yyyy-MM-dd'),
                payment_method: 'Cash',
                currency: txCurrency,
                exchange_rate: exchangeRate,
                base_currency: currency,
                converted_amount: convertedAmount,
                bucket_id: defaultBucketId || null,
                exclude_from_allowance: !!defaultBucketId // Exclude from allowance if adding to a specific bucket!
            });

            if (error) throw error;

            toast.success('Funds added successfully!');
            setAmount('');
            setDescription('');
            onSuccess?.();
            onClose();
        } catch (error: any) {
            toast.error('Failed to add funds: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md rounded-3xl border-white/10 bg-card/98 backdrop-blur-xl">
                <DialogHeader>
                    <DialogTitle>Add Funds / Income</DialogTitle>
                    <DialogDescription>
                        Record income or allocate funds to your budget. This will increase your remaining available budget.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div className="space-y-2">
                        <Label htmlFor="fund-amount">Amount</Label>
                        <div className="relative">
                            <Input
                                id="fund-amount"
                                type="number"
                                step="0.01"
                                value={amount}
                                placeholder="e.g. 500"
                                onChange={(e) => setAmount(e.target.value)}
                                className="pl-12"
                            />
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-primary">
                                {CURRENCY_SYMBOLS[txCurrency as keyof typeof CURRENCY_SYMBOLS] || '$'}
                            </span>
                        </div>
                        <div className="mt-2">
                            <CurrencyDropdown value={txCurrency} onValueChange={(val) => setTxCurrency(val as any)} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="fund-description">Description <span className="text-destructive">*</span></Label>
                        <Input
                            id="fund-description"
                            value={description}
                            placeholder="e.g. Salary, Refund..."
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>
                    
                    <DialogFooter className="pt-4 gap-2 sm:gap-0">
                        <Button type="button" variant="outline" className="rounded-xl" onClick={onClose} disabled={loading}>
                            Cancel
                        </Button>
                        <Button type="submit" className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white" disabled={loading}>
                            {loading ? "Adding..." : "Add Funds"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
