'use client';

import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ArrowDownLeft, ArrowUpRight, Banknote, Building2, CreditCard, Wallet } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CurrencyDropdown } from '@/components/ui/currency-dropdown';
import { CategorySelector } from '@/components/add-expense/selectors';
import { CATEGORIES as SYSTEM_CATEGORIES, CATEGORY_COLORS, getIconForCategory } from '@/lib/categories';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { toast } from '@/utils/haptics';
import { getMeta, type Frequency, type Tpl } from '@/lib/subscriptions-utils';
import type { SubscriptionMetadata } from '@/types/transaction';

const FREQUENCIES: Frequency[] = ['daily', 'weekly', 'monthly', 'yearly'];

const PAYMENT_METHODS = ['Cash', 'UPI', 'Debit Card', 'Credit Card', 'Bank Transfer'] as const;
type PaymentMethod = typeof PAYMENT_METHODS[number];

const PAYMENT_METHOD_COLORS: Record<PaymentMethod, string> = {
    'Cash': '#22C55E',
    'UPI': '#F59E0B',
    'Debit Card': '#3B82F6',
    'Credit Card': '#A855F7',
    'Bank Transfer': '#06B6D4',
};

const dropdownCategories = SYSTEM_CATEGORIES.map(cat => ({
    id: cat.id,
    label: cat.label,
    icon: (props: { className?: string }) => getIconForCategory(cat.id, props.className || 'w-4 h-4', props),
    color: CATEGORY_COLORS[cat.id] || '#8A2BE2',
}));

function PaymentMethodIcon({ method }: { method: PaymentMethod }) {
    if (method === 'Cash') return <Banknote className="w-4 h-4" />;
    if (method === 'UPI') return <Wallet className="w-4 h-4" />;
    if (method === 'Bank Transfer') return <Building2 className="w-4 h-4" />;
    return <CreditCard className="w-4 h-4" />;
}

interface Props {
    template: Tpl | null;
    onClose: () => void;
}

export function EditSubscriptionDialog({ template, onClose }: Props) {
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState('USD');
    const [frequency, setFrequency] = useState<Frequency>('monthly');
    const [nextOccurrence, setNextOccurrence] = useState('');
    const [category, setCategory] = useState('others');
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
    const [notes, setNotes] = useState('');
    const [isIncome, setIsIncome] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!template) return;
        const meta = getMeta(template);
        setDescription(template.description ?? '');
        setAmount(String(template.amount ?? ''));
        setCurrency((template.currency || 'USD').toUpperCase());
        setFrequency(template.frequency);
        setNextOccurrence((template.next_occurrence || '').slice(0, 10));
        setCategory(template.category || 'others');
        const pm = (template.payment_method as PaymentMethod | null | undefined) ?? 'Cash';
        setPaymentMethod(PAYMENT_METHODS.includes(pm as PaymentMethod) ? (pm as PaymentMethod) : 'Cash');
        setNotes(typeof meta.notes === 'string' ? meta.notes : '');
        setIsIncome(!!template.is_income);
    }, [template]);

    const nextPreview = useMemo(() => {
        if (!nextOccurrence) return null;
        try {
            return format(parseISO(nextOccurrence), 'PPP');
        } catch {
            return null;
        }
    }, [nextOccurrence]);

    const handleSave = async () => {
        if (!template) return;
        const trimmedDesc = description.trim();
        if (!trimmedDesc) {
            toast.error('Description is required');
            return;
        }
        const parsedAmount = parseFloat(amount);
        if (!isFinite(parsedAmount) || parsedAmount <= 0) {
            toast.error('Enter a valid amount');
            return;
        }
        if (!nextOccurrence) {
            toast.error('Pick the next date');
            return;
        }

        setSaving(true);
        try {
            const existingMeta = getMeta(template);
            const nextMeta: SubscriptionMetadata = { ...existingMeta };
            const trimmedNotes = notes.trim();
            if (trimmedNotes) {
                nextMeta.notes = trimmedNotes;
            } else {
                delete nextMeta.notes;
            }

            const { error } = await supabase
                .from('recurring_templates')
                .update({
                    description: trimmedDesc,
                    amount: parsedAmount,
                    currency: currency.toUpperCase(),
                    frequency,
                    next_occurrence: nextOccurrence,
                    category,
                    payment_method: paymentMethod,
                    is_income: isIncome,
                    metadata: nextMeta,
                })
                .eq('id', template.id);

            if (error) throw error;
            toast.success('Subscription updated');
            onClose();
        } catch (err) {
            console.error('Failed to update template', err);
            toast.error('Failed to save changes');
        } finally {
            setSaving(false);
        }
    };

    const open = !!template;

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
            <DialogContent className="bg-card/95 backdrop-blur-xl border-white/10 rounded-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit recurring payment</DialogTitle>
                    <DialogDescription>
                        Change any detail of this template. Future occurrences will use the new values.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 mt-2">
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => setIsIncome(false)}
                            aria-pressed={!isIncome}
                            className={cn(
                                'flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold uppercase tracking-wider rounded-xl border transition-all',
                                !isIncome
                                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                    : 'bg-background/20 border-white/5 text-muted-foreground hover:border-white/10'
                            )}
                        >
                            <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
                            Expense
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsIncome(true)}
                            aria-pressed={isIncome}
                            className={cn(
                                'flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold uppercase tracking-wider rounded-xl border transition-all',
                                isIncome
                                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                    : 'bg-background/20 border-white/5 text-muted-foreground hover:border-white/10'
                            )}
                        >
                            <ArrowDownLeft className="w-3 h-3" aria-hidden="true" />
                            Income
                        </button>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="edit-sub-description" className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider">
                            Description
                        </label>
                        <Input
                            id="edit-sub-description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="e.g. Netflix"
                            className="bg-secondary/10 border-white/5 h-11 rounded-xl"
                        />
                    </div>

                    <div className="grid grid-cols-[1fr_auto] gap-2">
                        <div className="space-y-2">
                            <label htmlFor="edit-sub-amount" className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider">
                                Amount
                            </label>
                            <Input
                                id="edit-sub-amount"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                className="bg-secondary/10 border-white/5 h-11 rounded-xl"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider">
                                Currency
                            </label>
                            <CurrencyDropdown
                                value={currency}
                                onValueChange={setCurrency}
                                compact
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <p className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider">Frequency</p>
                        <div className="grid grid-cols-4 gap-2">
                            {FREQUENCIES.map((f) => (
                                <button
                                    key={f}
                                    type="button"
                                    onClick={() => setFrequency(f)}
                                    aria-pressed={frequency === f}
                                    className={cn(
                                        'py-2 text-[11px] font-bold uppercase tracking-wider rounded-xl border transition-all',
                                        frequency === f
                                            ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20'
                                            : 'bg-background/20 border-white/5 text-muted-foreground hover:border-white/10'
                                    )}
                                >
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="edit-sub-next" className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider">
                            Next {isIncome ? 'deposit' : 'bill'}
                        </label>
                        <Input
                            id="edit-sub-next"
                            type="date"
                            value={nextOccurrence}
                            onChange={(e) => setNextOccurrence(e.target.value)}
                            className="bg-secondary/10 border-white/5 h-11 rounded-xl"
                        />
                        {nextPreview && (
                            <p className="text-[11px] text-muted-foreground italic">{nextPreview}</p>
                        )}
                    </div>

                    <CategorySelector
                        categories={dropdownCategories}
                        selectedCategory={category}
                        onSelect={setCategory}
                    />

                    <div className="space-y-2">
                        <p className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider">Payment method</p>
                        <div className="grid grid-cols-2 gap-2">
                            {PAYMENT_METHODS.map((method, idx) => {
                                const isSelected = paymentMethod === method;
                                const color = PAYMENT_METHOD_COLORS[method];
                                return (
                                    <button
                                        key={method}
                                        type="button"
                                        onClick={() => setPaymentMethod(method)}
                                        aria-pressed={isSelected}
                                        className={cn(
                                            'flex items-center gap-3 p-2.5 rounded-xl border transition-all text-left',
                                            isSelected
                                                ? 'border-white/20 shadow-lg'
                                                : 'bg-secondary/10 border-white/5 hover:bg-secondary/20',
                                            idx === 4 && 'col-span-2'
                                        )}
                                        style={{
                                            backgroundColor: isSelected ? `${color}20` : undefined,
                                            borderColor: isSelected ? color : undefined,
                                        }}
                                    >
                                        <div
                                            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                                            style={{
                                                backgroundColor: isSelected ? `${color}30` : 'rgba(255,255,255,0.05)',
                                                color: isSelected ? color : 'inherit',
                                            }}
                                        >
                                            <PaymentMethodIcon method={method} />
                                        </div>
                                        <span
                                            className="text-sm font-medium"
                                            style={{ color: isSelected ? color : undefined }}
                                        >
                                            {method}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="edit-sub-notes" className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider">
                            Notes
                        </label>
                        <Textarea
                            id="edit-sub-notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Optional"
                            rows={3}
                            className="bg-secondary/10 border-white/5 rounded-xl resize-none"
                        />
                    </div>
                </div>

                <DialogFooter className="mt-4 gap-2 sm:gap-2">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={onClose}
                        disabled={saving}
                        className="rounded-xl border border-white/10"
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="rounded-xl bg-primary text-white hover:bg-primary/90"
                    >
                        {saving ? 'Saving…' : 'Save changes'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
