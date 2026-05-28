import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Tag, Plane, Home, Gift, Car, Utensils, ShoppingCart, Heart, Gamepad2, Music, Laptop, School, Filter, Sparkles } from 'lucide-react';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { useBucketsList, Bucket } from '@/components/providers/buckets-provider';
import { useUserPreferences, CURRENCY_DETAILS, type Currency } from '@/components/providers/user-preferences-provider';
import { toast } from '@/utils/haptics';
import { cn } from '@/lib/utils';
import { CATEGORIES as SYSTEM_CATEGORIES, CATEGORY_COLORS, getIconForCategory } from '@/lib/categories';
import { supabase } from '@/lib/supabase';
import { subMonths, subYears, format, startOfMonth, endOfMonth } from 'date-fns';

interface BucketDialogProps {
    isOpen: boolean;
    onClose: () => void;
    editingBucket?: Bucket | null;
}

const ICONS = [
    { name: 'Tag', label: 'Tag', icon: Tag },
    { name: 'Plane', label: 'Trip', icon: Plane },
    { name: 'Home', label: 'Home', icon: Home },
    { name: 'Gift', label: 'Gift', icon: Gift },
    { name: 'Car', label: 'Car', icon: Car },
    { name: 'Utensils', label: 'Food', icon: Utensils },
    { name: 'ShoppingCart', label: 'Shop', icon: ShoppingCart },
    { name: 'Heart', label: 'Health', icon: Heart },
    { name: 'Gamepad2', label: 'Game', icon: Gamepad2 },
    { name: 'Music', label: 'Music', icon: Music },
    { name: 'Laptop', label: 'Tech', icon: Laptop },
    { name: 'School', label: 'School', icon: School },
];

export function BucketDialog({ isOpen, onClose, editingBucket }: BucketDialogProps) {
    const { createBucket, updateBucket } = useBucketsList();
    const { currency, formatCurrency, userId } = useUserPreferences();

    const [isProcessing, setIsProcessing] = useState(false);
    const [newBucketName, setNewBucketName] = useState('');
    const [newBucketTarget, setNewBucketTarget] = useState('');
    const [newBucketIcon, setNewBucketIcon] = useState('Tag');
    const [bucketDateRange, setBucketDateRange] = useState<DateRange | undefined>();
    const [newBucketCurrency, setNewBucketCurrency] = useState<Currency | string>(currency || 'USD');
    const [allowedCategories, setAllowedCategories] = useState<string[]>([]);
    const [budgetSuggestions, setBudgetSuggestions] = useState<{ avg3mo: number; sameMonthLastYear: number } | null>(null);

    useEffect(() => {
        if (isOpen) {
            if (editingBucket) {
                setNewBucketName(editingBucket.name);
                setNewBucketTarget(editingBucket.budget.toString());
                setNewBucketIcon(editingBucket.icon || 'Tag');
                setBucketDateRange({
                    from: editingBucket.start_date ? new Date(editingBucket.start_date) : undefined,
                    to: editingBucket.end_date ? new Date(editingBucket.end_date) : undefined,
                });
                setNewBucketCurrency(editingBucket.currency || currency || 'USD');
                setAllowedCategories(editingBucket.allowed_categories || []);
            } else {
                setNewBucketName('');
                setNewBucketTarget('');
                setNewBucketIcon('Tag');
                setBucketDateRange(undefined);
                setNewBucketCurrency(currency || 'USD');
                setAllowedCategories([]);
            }
            setBudgetSuggestions(null);
        }
    }, [isOpen, editingBucket, currency]);

    useEffect(() => {
        if (!isOpen || !editingBucket || !userId) {
            setBudgetSuggestions(null);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const now = new Date();
                const threeMonthsAgo = startOfMonth(subMonths(now, 3));
                const sameMonthLastYearStart = startOfMonth(subYears(now, 1));
                const sameMonthLastYearEnd = endOfMonth(subYears(now, 1));

                const [recent, lastYear] = await Promise.all([
                    supabase
                        .from('transactions')
                        .select('amount, date')
                        .eq('user_id', userId)
                        .eq('bucket_id', editingBucket.id)
                        .gte('date', format(threeMonthsAgo, 'yyyy-MM-dd'))
                        .lt('date', format(startOfMonth(now), 'yyyy-MM-dd')),
                    supabase
                        .from('transactions')
                        .select('amount, date')
                        .eq('user_id', userId)
                        .eq('bucket_id', editingBucket.id)
                        .gte('date', format(sameMonthLastYearStart, 'yyyy-MM-dd'))
                        .lte('date', format(sameMonthLastYearEnd, 'yyyy-MM-dd')),
                ]);

                if (cancelled) return;

                let recentSum = 0;
                for (const row of recent.data || []) {
                    recentSum += Number(row.amount);
                }
                // Divide by the full window length (3 months). Using the count of
                // months that *had* spending inflates sparse buckets — 1 active
                // month with $300 would render as "Avg 3mo · $300" instead of $100.
                const avg3mo = recentSum / 3;
                const sameMonthLastYear = (lastYear.data || []).reduce((s, r) => s + Number(r.amount), 0);

                if (avg3mo > 0 || sameMonthLastYear > 0) {
                    setBudgetSuggestions({ avg3mo, sameMonthLastYear });
                } else {
                    setBudgetSuggestions(null);
                }
            } catch (err) {
                console.error('Failed to compute bucket budget suggestions:', err);
            }
        })();
        return () => { cancelled = true; };
    }, [isOpen, editingBucket, userId]);

    const handleAction = async () => {
        if (!newBucketName.trim()) {
            toast.error('Please enter a bucket name');
            return;
        }

        setIsProcessing(true);
        try {
            if (editingBucket) {
                await updateBucket(editingBucket.id, {
                    name: newBucketName,
                    budget: parseFloat(newBucketTarget) || 0,
                    icon: newBucketIcon,
                    start_date: bucketDateRange?.from?.toISOString(),
                    end_date: bucketDateRange?.to?.toISOString(),
                    currency: newBucketCurrency,
                    allowed_categories: allowedCategories,
                });
                toast.success('Bucket updated');
            } else {
                await createBucket({
                    name: newBucketName,
                    budget: parseFloat(newBucketTarget) || 0,
                    icon: newBucketIcon,
                    type: 'trip',
                    start_date: bucketDateRange?.from?.toISOString(),
                    end_date: bucketDateRange?.to?.toISOString(),
                    currency: newBucketCurrency,
                    allowed_categories: allowedCategories,
                });
                toast.success('Bucket created');
            }
            onClose();
        } catch (error) {
            const msg = error instanceof Error ? error.message : `Failed to ${editingBucket ? 'update' : 'create'} bucket`;
            toast.error(msg);
        } finally {
            setIsProcessing(false);
        }
    };

    const ActiveIcon = ICONS.find(i => i.name === newBucketIcon)?.icon || Tag;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-[420px] w-[95vw] rounded-[28px] border-white/[0.08] bg-card/95 backdrop-blur-2xl p-0 overflow-hidden shadow-2xl">
                <div className="p-5 space-y-4 max-h-[88vh] overflow-y-auto">
                    <DialogHeader className="text-left flex-row items-start gap-3 space-y-0">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-cyan-400/[0.08] text-cyan-400">
                            <ActiveIcon className="w-[18px] h-[18px]" />
                        </div>
                        <div className="min-w-0">
                            <DialogTitle className="text-[15px] font-semibold tracking-tight">
                                {editingBucket ? 'Edit bucket' : 'New bucket'}
                            </DialogTitle>
                            <DialogDescription className="text-[12px] mt-0.5">
                                {editingBucket ? 'Update name, budget, or category filter.' : 'Group spending under a private label.'}
                            </DialogDescription>
                        </div>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Icon picker */}
                        <div className="space-y-1.5">
                            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70 pl-1">Icon</p>
                            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                                {ICONS.map(item => {
                                    const active = newBucketIcon === item.name;
                                    return (
                                        <button
                                            key={item.name}
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setNewBucketIcon(item.name);
                                            }}
                                            aria-label={item.label}
                                            aria-pressed={active}
                                            className={cn(
                                                'h-10 w-10 shrink-0 rounded-xl border flex items-center justify-center transition-colors',
                                                active
                                                    ? 'bg-cyan-400/15 border-cyan-400/40 text-cyan-300'
                                                    : 'bg-secondary/10 border-white/[0.05] text-muted-foreground hover:border-white/[0.1]',
                                            )}
                                        >
                                            <item.icon className="w-4 h-4 pointer-events-none" />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Name */}
                        <div className="space-y-1.5">
                            <label htmlFor="bucket-name" className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70 pl-1">
                                Name
                            </label>
                            <Input
                                autoFocus
                                id="bucket-name"
                                name="bucket-name"
                                placeholder="e.g. Trip, New iPhone, Gift…"
                                value={newBucketName}
                                onChange={(e) => setNewBucketName(e.target.value)}
                                className="bg-secondary/20 border-white/[0.06] h-11 rounded-xl focus-visible:ring-cyan-400/40"
                            />
                        </div>

                        {/* Currency + Budget */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70 pl-1">Currency</p>
                                <Select value={newBucketCurrency} onValueChange={setNewBucketCurrency}>
                                    <SelectTrigger className="bg-secondary/20 border-white/[0.06] h-11 rounded-xl">
                                        <div className="flex items-center gap-2">
                                            <span className="text-cyan-300 font-bold w-5 text-left">{CURRENCY_DETAILS[newBucketCurrency as keyof typeof CURRENCY_DETAILS]?.symbol}</span>
                                            <span className="text-[13px] font-semibold">{newBucketCurrency}</span>
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent position="popper" className="bg-card border-white/[0.08] rounded-xl overflow-y-auto max-h-[200px]">
                                        {Object.entries(CURRENCY_DETAILS).map(([code, detail]) => (
                                            <SelectItem key={code} value={code} className="py-2 px-3 focus:bg-cyan-400/10 rounded-lg">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-cyan-300 font-bold w-5 text-left">{detail.symbol}</span>
                                                    <span className="text-[13px] font-semibold">{code}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <label htmlFor="bucket-budget" className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70 pl-1">
                                    Budget
                                </label>
                                <div className="relative">
                                    <Input
                                        id="bucket-budget"
                                        name="bucket-budget"
                                        type="number"
                                        inputMode="decimal"
                                        placeholder="0.00"
                                        value={newBucketTarget}
                                        onChange={(e) => setNewBucketTarget(e.target.value)}
                                        className="bg-secondary/20 border-white/[0.06] h-11 rounded-xl pl-7 focus-visible:ring-cyan-400/40 tabular-nums"
                                    />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[13px] font-bold">
                                        {CURRENCY_DETAILS[newBucketCurrency as keyof typeof CURRENCY_DETAILS]?.symbol || '$'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {budgetSuggestions && (
                            <div className="flex flex-wrap items-center gap-1.5 -mt-1">
                                <span className="text-[10px] uppercase tracking-[0.14em] font-medium text-muted-foreground/60 inline-flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" aria-hidden="true" />
                                    Try
                                </span>
                                {budgetSuggestions.avg3mo > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setNewBucketTarget(Math.round(budgetSuggestions.avg3mo).toString())}
                                        className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-cyan-400/10 border border-cyan-400/25 text-cyan-300 hover:bg-cyan-400/15 transition-colors tabular-nums"
                                    >
                                        Avg 3mo · {formatCurrency(budgetSuggestions.avg3mo)}
                                    </button>
                                )}
                                {budgetSuggestions.sameMonthLastYear > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setNewBucketTarget(Math.round(budgetSuggestions.sameMonthLastYear).toString())}
                                        className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-cyan-400/10 border border-cyan-400/25 text-cyan-300 hover:bg-cyan-400/15 transition-colors tabular-nums"
                                    >
                                        Last year · {formatCurrency(budgetSuggestions.sameMonthLastYear)}
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Dates */}
                        <div className="space-y-1.5">
                            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70 pl-1">Dates</p>
                            <DateRangePicker
                                date={bucketDateRange}
                                setDate={setBucketDateRange}
                                className="h-11"
                                numberOfMonths={1}
                                align="center"
                            />
                        </div>

                        {/* Category filter */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between pl-1">
                                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70 inline-flex items-center gap-1.5">
                                    <Filter className="w-3 h-3" aria-hidden="true" />
                                    Limit to categories
                                </p>
                                {allowedCategories.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setAllowedCategories([])}
                                        className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        Clear
                                    </button>
                                )}
                            </div>
                            <p className="text-[10px] text-muted-foreground/70 pl-1">
                                {allowedCategories.length === 0
                                    ? 'All categories count toward this bucket.'
                                    : `${allowedCategories.length} ${allowedCategories.length === 1 ? 'category counts' : 'categories count'} toward this bucket.`}
                            </p>
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                                {SYSTEM_CATEGORIES.map((cat) => {
                                    const active = allowedCategories.includes(cat.id);
                                    const color = CATEGORY_COLORS[cat.id] || '#8A2BE2';
                                    return (
                                        <button
                                            type="button"
                                            key={cat.id}
                                            onClick={() => setAllowedCategories(prev =>
                                                active ? prev.filter(c => c !== cat.id) : [...prev, cat.id],
                                            )}
                                            className={cn(
                                                'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-colors capitalize',
                                                active
                                                    ? 'border-transparent'
                                                    : 'bg-secondary/10 border-white/[0.05] text-muted-foreground hover:border-white/[0.1]',
                                            )}
                                            style={active ? { backgroundColor: `${color}1F`, borderColor: `${color}50`, color } : undefined}
                                        >
                                            <span className="w-3 h-3 inline-flex items-center justify-center">
                                                {React.cloneElement(getIconForCategory(cat.id) as React.ReactElement<{ style?: React.CSSProperties }>, {
                                                    style: { color: active ? color : undefined, width: '100%', height: '100%' },
                                                })}
                                            </span>
                                            {cat.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <Button
                            onClick={handleAction}
                            disabled={isProcessing}
                            className="w-full h-11 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-cyan-950 font-semibold mt-2 disabled:opacity-60"
                        >
                            {isProcessing ? 'Saving…' : editingBucket ? 'Save changes' : 'Create bucket'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
