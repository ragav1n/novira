'use client';

import React from 'react';
import { RefreshCcw, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { RecurringTemplate } from '@/types/transaction';

interface Props {
    templates: RecurringTemplate[];
    loading: boolean;
    formatCurrency: (amount: number, currency?: string) => string;
    onDelete: (templateId: string) => void;
}

export function RecurringExpensesSection({ templates, loading, formatCurrency, onDelete }: Props) {
    const [templateToDelete, setTemplateToDelete] = React.useState<RecurringTemplate | null>(null);

    return (
        <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <RefreshCcw className="w-4 h-4" />
                <span>Recurring Expenses</span>
            </div>
            <div className="bg-secondary/5 rounded-xl border border-white/5 divide-y divide-white/5 min-h-[48px]">
                {loading ? (
                    <>
                        <div className="flex items-center justify-between p-3">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-secondary/20 animate-pulse" />
                                <div className="space-y-2">
                                    <div className="h-3 w-32 rounded bg-secondary/20 animate-pulse" />
                                    <div className="h-2 w-24 rounded bg-secondary/20 animate-pulse" />
                                </div>
                            </div>
                            <div className="h-8 w-8 rounded-full bg-secondary/20 animate-pulse" />
                        </div>
                        <div className="flex items-center justify-between p-3">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-secondary/20 animate-pulse" />
                                <div className="space-y-2">
                                    <div className="h-3 w-28 rounded bg-secondary/20 animate-pulse" />
                                    <div className="h-2 w-20 rounded bg-secondary/20 animate-pulse" />
                                </div>
                            </div>
                            <div className="h-8 w-8 rounded-full bg-secondary/20 animate-pulse" />
                        </div>
                    </>
                ) : templates.length > 0 ? (
                    templates.map((template) => (
                        <div key={template.id} className="flex items-center justify-between p-3">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                    <RefreshCcw className="w-4 h-4 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium truncate max-w-[150px]">{template.description}</p>
                                    <p className="text-[11px] text-muted-foreground">
                                        {formatCurrency(template.amount, template.currency)} • {template.frequency}
                                        {template.created_at && ` • Started ${format(new Date(template.created_at), 'MMM d, yyyy')}`}
                                    </p>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                onClick={() => setTemplateToDelete(template)}
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    ))
                ) : (
                    <div className="p-4 text-center text-xs text-muted-foreground italic">
                        No active recurring expenses
                    </div>
                )}
            </div>
            <p className="text-[11px] text-muted-foreground">Manage your automated recurring transactions.</p>

            <AlertDialog open={!!templateToDelete} onOpenChange={(open) => !open && setTemplateToDelete(null)}>
                <AlertDialogContent className="bg-card/95 backdrop-blur-xl border-white/10 rounded-3xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Stop this recurring expense?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Future transactions for "{templateToDelete?.description}" will not be created automatically.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2 sm:gap-0 mt-4">
                        <AlertDialogCancel className="rounded-xl border-white/10">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive hover:bg-destructive/90 text-white rounded-xl"
                            onClick={() => {
                                if (templateToDelete) {
                                    onDelete(templateToDelete.id);
                                    setTemplateToDelete(null);
                                }
                            }}
                        >
                            Stop Series
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
