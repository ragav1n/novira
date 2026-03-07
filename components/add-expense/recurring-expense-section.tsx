import React from 'react';
import { RefreshCcw } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface RecurringExpenseSectionProps {
    isRecurring: boolean;
    setIsRecurring: (val: boolean) => void;
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    setFrequency: (val: 'daily' | 'weekly' | 'monthly' | 'yearly') => void;
    date: Date | undefined;
}

export function RecurringExpenseSection({
    isRecurring,
    setIsRecurring,
    frequency,
    setFrequency,
    date
}: RecurringExpenseSectionProps) {
    return (
        <div className="space-y-4 p-4 rounded-2xl bg-secondary/10 border border-white/5">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <RefreshCcw className="w-5 h-5 text-primary" />
                    <div>
                        <p className="text-sm font-medium">Recurring Expense</p>
                        <p className="text-[11px] text-muted-foreground">Automatically post this expense</p>
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
                                    "py-2 text-[11px] font-bold uppercase tracking-wider rounded-xl border transition-all",
                                    frequency === freq
                                        ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                                        : "bg-background/20 border-white/5 text-muted-foreground hover:border-white/10"
                                )}
                            >
                                {freq}
                            </button>
                        ))}
                    </div>
                    <p className="text-[11px] text-center text-muted-foreground italic">
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
    );
}
