import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Tag, Plane, Home, Gift, Car, Utensils, ShoppingCart, Heart, Gamepad2, Music, Laptop, School, Filter } from 'lucide-react';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { useBucketsList, Bucket } from '@/components/providers/buckets-provider';
import { useUserPreferences, CURRENCY_DETAILS, type Currency } from '@/components/providers/user-preferences-provider';
import { toast } from '@/utils/haptics';
import { cn } from '@/lib/utils';
import { CATEGORIES as SYSTEM_CATEGORIES, CATEGORY_COLORS, getIconForCategory } from '@/lib/categories';

interface BucketDialogProps {
    isOpen: boolean;
    onClose: () => void;
    editingBucket?: Bucket | null;
}

export function BucketDialog({ isOpen, onClose, editingBucket }: BucketDialogProps) {
    const { createBucket, updateBucket } = useBucketsList();
    const { currency } = useUserPreferences();

    const [isProcessing, setIsProcessing] = useState(false);
    const [newBucketName, setNewBucketName] = useState('');
    const [newBucketTarget, setNewBucketTarget] = useState('');
    const [newBucketIcon, setNewBucketIcon] = useState('Tag');
    const [bucketDateRange, setBucketDateRange] = useState<DateRange | undefined>();
    const [newBucketCurrency, setNewBucketCurrency] = useState<Currency | string>(currency || 'USD');
    const [allowedCategories, setAllowedCategories] = useState<string[]>([]);

    useEffect(() => {
        if (isOpen) {
            if (editingBucket) {
                setNewBucketName(editingBucket.name);
                setNewBucketTarget(editingBucket.budget.toString());
                setNewBucketIcon(editingBucket.icon || 'Tag');
                setBucketDateRange({
                    from: editingBucket.start_date ? new Date(editingBucket.start_date) : undefined,
                    to: editingBucket.end_date ? new Date(editingBucket.end_date) : undefined
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
        }
    }, [isOpen, editingBucket, currency]);

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
                    allowed_categories: allowedCategories
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
                    allowed_categories: allowedCategories
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

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-[400px] w-[95vw] rounded-3xl border-white/10 bg-card/95 backdrop-blur-xl p-0 overflow-hidden shadow-2xl">
                <div className="p-6 space-y-4 w-full max-w-full overflow-hidden flex flex-col box-border">
                    <DialogHeader className="text-left px-0">
                        <DialogTitle>{editingBucket ? 'Edit Bucket' : 'Create Bucket'}</DialogTitle>
                        <DialogDescription>{editingBucket ? 'Modify your bucket details.' : 'Organize your private spending.'}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-3 w-full overflow-hidden">
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Select Icon</p>
                            <div className="flex gap-2 overflow-x-auto pb-4 px-1 w-full scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                                {[
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
                                ].map(item => (
                                    <div key={item.name} className="flex flex-col items-center gap-1.5 shrink-0">
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                setNewBucketIcon(item.name);
                                            }}
                                            className={cn(
                                                "w-12 h-12 rounded-2xl border flex items-center justify-center transition-all",
                                                newBucketIcon === item.name
                                                    ? "bg-cyan-500/20 border-cyan-500 text-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                                                    : "bg-secondary/10 border-white/5 text-muted-foreground hover:border-white/10"
                                            )}
                                        >
                                            <item.icon className="w-5 h-5 pointer-events-none" />
                                        </button>
                                        <span className={cn(
                                            "text-[9px] font-bold uppercase tracking-wider",
                                            newBucketIcon === item.name ? "text-cyan-500" : "text-muted-foreground"
                                        )}>
                                            {item.label}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2 text-left w-full">
                            <label htmlFor="bucket-name" className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Bucket Name</label>
                            <Input
                                autoFocus
                                id="bucket-name"
                                name="bucket-name"
                                placeholder="e.g. Trip, New iPhone, Gift..."
                                value={newBucketName}
                                onChange={(e) => setNewBucketName(e.target.value)}
                                className="bg-secondary/20 border-white/5 h-12 rounded-2xl focus-visible:ring-cyan-500/50 w-full"
                            />
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2 text-left w-full">
                                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Currency</p>
                                    <Select value={newBucketCurrency} onValueChange={setNewBucketCurrency}>
                                        <SelectTrigger className="bg-secondary/20 border-white/5 h-12 rounded-2xl w-full">
                                            <div className="flex items-center gap-2">
                                                <span className="text-primary font-bold w-6">{CURRENCY_DETAILS[newBucketCurrency as keyof typeof CURRENCY_DETAILS]?.symbol}</span>
                                                <span className="text-sm font-semibold">{newBucketCurrency}</span>
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent position="popper" className="bg-card border-white/10 rounded-xl overflow-y-auto max-h-[200px]">
                                            {Object.entries(CURRENCY_DETAILS).map(([code, detail]) => (
                                                <SelectItem key={code} value={code} className="py-2.5 px-3 focus:bg-primary/20 rounded-lg">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-primary font-bold w-6 text-left">{detail.symbol}</span>
                                                        <span className="text-sm font-semibold">{code}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2 text-left w-full">
                                    <label htmlFor="bucket-budget" className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Total Budget</label>
                                    <div className="relative w-full">
                                        <Input
                                            id="bucket-budget"
                                            name="bucket-budget"
                                            type="number"
                                            placeholder="0.00"
                                            value={newBucketTarget}
                                            onChange={(e) => setNewBucketTarget(e.target.value)}
                                            className="bg-secondary/20 border-white/5 h-12 rounded-2xl pl-8 focus-visible:ring-cyan-500/50 w-full"
                                        />
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">
                                            {CURRENCY_DETAILS[newBucketCurrency as keyof typeof CURRENCY_DETAILS]?.symbol || '$'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2 text-left w-full">
                                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest pl-1">Dates</p>
                                <DateRangePicker
                                    date={bucketDateRange}
                                    setDate={setBucketDateRange}
                                    className="h-12"
                                    numberOfMonths={1}
                                    align="center"
                                />
                            </div>

                            <div className="space-y-2 text-left w-full">
                                <div className="flex items-center justify-between pl-1">
                                    <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
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
                                <p className="text-[10px] text-muted-foreground/70 pl-1 -mt-1">
                                    {allowedCategories.length === 0
                                        ? 'All categories count toward this bucket.'
                                        : `Only ${allowedCategories.length} ${allowedCategories.length === 1 ? 'category counts' : 'categories count'} toward this bucket.`}
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {SYSTEM_CATEGORIES.map((cat) => {
                                        const active = allowedCategories.includes(cat.id);
                                        const color = CATEGORY_COLORS[cat.id] || '#8A2BE2';
                                        return (
                                            <button
                                                type="button"
                                                key={cat.id}
                                                onClick={() => setAllowedCategories(prev =>
                                                    active ? prev.filter(c => c !== cat.id) : [...prev, cat.id]
                                                )}
                                                className={cn(
                                                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors capitalize",
                                                    active
                                                        ? "border-transparent"
                                                        : "bg-secondary/10 border-white/5 text-muted-foreground hover:border-white/10"
                                                )}
                                                style={active ? { backgroundColor: `${color}20`, borderColor: `${color}50`, color } : undefined}
                                            >
                                                <span className="w-3 h-3 inline-flex items-center justify-center">
                                                    {React.cloneElement(getIconForCategory(cat.id) as React.ReactElement<{ style?: React.CSSProperties }>, {
                                                        style: { color: active ? color : undefined, width: '100%', height: '100%' }
                                                    })}
                                                </span>
                                                {cat.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <Button
                            onClick={handleAction}
                            disabled={isProcessing}
                            className="w-full h-12 rounded-2xl bg-cyan-500 hover:bg-cyan-600 text-white font-bold shadow-lg shadow-cyan-500/20 mt-4 text-sm"
                        >
                            {isProcessing ? 'Processing...' : editingBucket ? 'Save Changes' : 'Create Bucket'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
