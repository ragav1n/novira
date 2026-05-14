'use client';

import { format, parseISO } from 'date-fns';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { useWorkspaceTheme } from '@/hooks/useWorkspaceTheme';
import type { Tpl, PriceChange } from '@/lib/subscriptions-utils';

interface PriceChangeDialogProps {
    target: { template: Tpl; change: PriceChange } | null;
    onClose: () => void;
    onApply: () => void;
}

export function PriceChangeDialog({ target, onClose, onApply }: PriceChangeDialogProps) {
    const { formatCurrency } = useUserPreferences();
    const { theme: themeConfig } = useWorkspaceTheme();

    return (
        <AlertDialog open={!!target} onOpenChange={(open) => !open && onClose()}>
            <AlertDialogContent className="bg-card/95 backdrop-blur-xl border-white/10 rounded-3xl">
                <AlertDialogHeader>
                    <AlertDialogTitle>Update subscription price?</AlertDialogTitle>
                    <AlertDialogDescription>
                        {target && (
                            <>
                                Most recent <span className="font-semibold text-foreground">{target.template.description}</span> charge was{' '}
                                <span className="font-bold text-foreground">{formatCurrency(target.change.lastAmount, target.template.currency)}</span>{' '}
                                on {format(parseISO(target.change.lastDate), 'MMM d, yyyy')}.
                                Template currently shows{' '}
                                <span className="font-bold text-foreground">{formatCurrency(target.change.templateAmount, target.template.currency)}</span>.
                                Update template to match the new price?
                            </>
                        )}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={onClose}>Keep current</AlertDialogCancel>
                    <AlertDialogAction
                        className={cn("border", themeConfig.bgSolid, themeConfig.borderSolid, themeConfig.textWhite, themeConfig.hoverBg)}
                        onClick={onApply}
                    >
                        Update price
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

interface CancelSubscriptionDialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export function CancelSubscriptionDialog({ open, onClose, onConfirm }: CancelSubscriptionDialogProps) {
    return (
        <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
            <AlertDialogContent className="bg-card/95 backdrop-blur-xl border-white/10 rounded-3xl">
                <AlertDialogHeader>
                    <AlertDialogTitle>Cancel this subscription?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Future transactions for this subscription will not be created automatically. You can re-activate it anytime.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={onClose}>Keep</AlertDialogCancel>
                    <AlertDialogAction
                        className="bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30"
                        onClick={onConfirm}
                    >
                        Cancel Subscription
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
