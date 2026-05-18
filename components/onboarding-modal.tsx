'use client';

import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { Plus, Tag, ChartLine, ArrowRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
    open: boolean;
    onComplete: () => void;
}

interface Step {
    icon: React.ReactNode;
    title: string;
    body: string;
    cta: string;
    onCta: (router: ReturnType<typeof useRouter>) => void;
}

const STEPS: Step[] = [
    {
        icon: <Plus className="w-6 h-6" />,
        title: 'Add your first expense',
        body: 'Track what you spend. Tap the + to log a transaction — the form remembers your context so the second time is faster.',
        cta: 'Add expense',
        onCta: (router) => router.push('/add'),
    },
    {
        icon: <Tag className="w-6 h-6" />,
        title: 'Create a bucket',
        body: 'Buckets are budgets for a trip, a project, or a category. Spending tagged to a bucket counts against its budget instead of your monthly allowance.',
        cta: 'Open groups',
        onCta: (router) => router.push('/groups?tab=buckets'),
    },
    {
        icon: <ChartLine className="w-6 h-6" />,
        title: 'See your analytics',
        body: 'Once you have a few transactions, the analytics view will surface spending trends, top merchants, weekday patterns, and a forward-projection of your month.',
        cta: 'Open analytics',
        onCta: (router) => router.push('/analytics'),
    },
];

export function OnboardingModal({ open, onComplete }: Props) {
    const router = useRouter();
    const [step, setStep] = useState(0);

    const next = useCallback(() => {
        if (step >= STEPS.length - 1) {
            onComplete();
        } else {
            setStep(s => s + 1);
        }
    }, [step, onComplete]);

    const skip = useCallback(() => onComplete(), [onComplete]);

    const current = STEPS[step];

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) onComplete(); }}>
            <DialogContent className="max-w-[400px] w-[95vw] rounded-3xl border-white/10 bg-card/95 backdrop-blur-xl p-0 overflow-hidden shadow-2xl">
                <div className="p-6 space-y-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-primary">
                            <Sparkles className="w-3 h-3" aria-hidden="true" />
                            Welcome
                        </div>
                        <div className="flex items-center gap-1.5" aria-hidden="true">
                            {STEPS.map((_, i) => (
                                <span
                                    key={i}
                                    className={cn(
                                        'w-1.5 h-1.5 rounded-full transition-colors',
                                        i === step ? 'bg-primary' : i < step ? 'bg-primary/40' : 'bg-white/15'
                                    )}
                                />
                            ))}
                        </div>
                    </div>
                    <div className="flex flex-col items-center text-center space-y-3 py-2">
                        <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary">
                            {current.icon}
                        </div>
                        <DialogTitle className="text-lg font-bold">{current.title}</DialogTitle>
                        <DialogDescription className="text-[12.5px] text-muted-foreground leading-relaxed max-w-[300px]">
                            {current.body}
                        </DialogDescription>
                    </div>
                    <div className="flex gap-2 pt-1">
                        <Button
                            variant="ghost"
                            onClick={skip}
                            className="flex-1 h-11 rounded-xl text-[12px] font-bold text-muted-foreground hover:text-foreground"
                        >
                            {step < STEPS.length - 1 ? 'Skip' : 'Close'}
                        </Button>
                        <Button
                            onClick={() => {
                                current.onCta(router);
                                onComplete();
                            }}
                            className="flex-1 h-11 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-[12px]"
                        >
                            {current.cta}
                        </Button>
                        {step < STEPS.length - 1 && (
                            <Button
                                onClick={next}
                                variant="outline"
                                size="icon"
                                className="h-11 w-11 rounded-xl bg-secondary/10 border-white/10"
                                aria-label="Next step"
                            >
                                <ArrowRight className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
