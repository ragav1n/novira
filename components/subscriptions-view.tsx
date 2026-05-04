'use client';

import { motion } from 'framer-motion';

import React, { useEffect, useState, useCallback } from 'react';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { useWorkspaceTheme } from '@/hooks/useWorkspaceTheme';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, RotateCw, Trash2, ArrowLeft, Tag, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useBucketsList } from '@/components/providers/buckets-provider';
import { getBucketIcon } from '@/utils/icon-utils';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';
import { toast } from '@/utils/haptics';
import { getCategoryLabel, getIconForCategory, CATEGORY_COLORS } from '@/lib/categories';
import type { RecurringTemplate } from '@/types/transaction';

// Local type that admits the metadata JSONB the server returns. RecurringTemplate
// in shared types is intentionally narrower; this view needs to read/write the
// bucket_id stored inside metadata.
type RecurringTemplateWithMeta = RecurringTemplate & {
    metadata?: Record<string, unknown> | null;
};

export function SubscriptionsView() {
    const { userId, formatCurrency, convertAmount, currency, activeWorkspaceId } = useUserPreferences();
    const { theme: themeConfig } = useWorkspaceTheme();
    const { buckets } = useBucketsList();

    const router = useRouter();
    const [templates, setTemplates] = useState<RecurringTemplateWithMeta[]>([]);
    const [loading, setLoading] = useState(true);
    const [cancelTarget, setCancelTarget] = useState<string | null>(null);

    const loadTemplates = useCallback(async () => {
        if (!userId) return;
        setLoading(true);
        let query = supabase
            .from('recurring_templates')
            .select('*')
            .eq('user_id', userId)
            .order('next_occurrence', { ascending: true })
            .limit(200);

        if (activeWorkspaceId && activeWorkspaceId !== 'personal') {
            query = query.eq('group_id', activeWorkspaceId);
        } else if (activeWorkspaceId === 'personal') {
            query = query.is('group_id', null);
        }

        const { data, error } = await query;

        if (!error && data) {
            setTemplates(data);
        }
        setLoading(false);
    }, [userId, activeWorkspaceId]);

    useEffect(() => {
        loadTemplates();
    }, [loadTemplates]);

    // Real-time subscription for recurring templates
    useEffect(() => {
        if (!userId) return;

        const templatesChannel = supabase
            .channel(`templates-changes-${userId}-${activeWorkspaceId || 'personal'}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'recurring_templates', filter: `user_id=eq.${userId}` },
                () => { loadTemplates(); }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(templatesChannel);
        };
    }, [userId, activeWorkspaceId, loadTemplates]);

    // Persist a bucket assignment into the template's metadata blob. We fetch the
    // current metadata from local state so notes/friend_ids/place_* survive the write.
    const handleAssignBucket = async (template: RecurringTemplateWithMeta, bucketId: string | null) => {
        const existing = (template.metadata && typeof template.metadata === 'object') ? template.metadata : {};
        const nextMetadata = { ...existing, bucket_id: bucketId };
        // Optimistic
        setTemplates(prev => prev.map(t => t.id === template.id ? { ...t, metadata: nextMetadata } : t));
        const { error } = await supabase
            .from('recurring_templates')
            .update({ metadata: nextMetadata })
            .eq('id', template.id);
        if (error) {
            toast.error('Failed to update bucket');
            loadTemplates();
        } else {
            toast.success(bucketId ? 'Bucket updated' : 'Bucket cleared');
        }
    };

    const handleToggleActive = async (id: string, currentStatus: boolean) => {
        const newStatus = !currentStatus;
        // Optimistic update
        setTemplates(prev => prev.map(t => t.id === id ? { ...t, is_active: newStatus } : t));

        const { error } = await supabase
            .from('recurring_templates')
            .update({ is_active: newStatus })
            .eq('id', id);

        if (error) {
            toast.error('Failed to update subscription status');
            loadTemplates();
        } else {
            toast.success(newStatus ? 'Subscription re-activated!' : 'Subscription cancelled');
        }
    };



    const totalMonthly = templates
        .filter(t => t.is_active)
        .reduce((acc, curr) => {
            const amountInBase = convertAmount(Number(curr.amount), curr.currency, currency);
            let monthlyEquivalent = amountInBase;
            if (curr.frequency === 'yearly') monthlyEquivalent /= 12;
            if (curr.frequency === 'weekly') monthlyEquivalent *= 4.33;
            if (curr.frequency === 'daily') monthlyEquivalent *= 30;
            return acc + monthlyEquivalent;
        }, 0);

    return (
        <>
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 220, damping: 28, mass: 0.9 }}
            className="relative min-h-screen w-full"
        >


            <div className="p-5 space-y-6 max-w-md lg:max-w-4xl mx-auto relative min-h-screen z-10">
                <div className="flex items-center justify-between relative min-h-[40px] mb-2">
                <button
                    onClick={() => router.back()}
                    aria-label="Go back"
                    className="w-10 h-10 rounded-full bg-secondary/30 hover:bg-secondary/50 flex items-center justify-center transition-colors shrink-0 z-10"
                >
                    <ArrowLeft className="w-5 h-5" aria-hidden="true" />
                </button>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <h1 className="text-lg font-semibold flex items-center gap-2">
                        <RotateCw className={`w-5 h-5 ${themeConfig.text}`} /> 
                        Subscriptions
                    </h1>
                </div>
                <div className="w-10 shrink-0 z-10" />
            </div>

            <Card className={cn(`bg-gradient-to-br backdrop-blur-md`, themeConfig.gradient, themeConfig.border)}>
                <CardContent className="p-6">
                    <p className="text-sm text-muted-foreground font-medium mb-1">Estimated Monthly Cost</p>
                    <h2 className={`text-3xl font-bold ${themeConfig.text}`}>{formatCurrency(totalMonthly)}</h2>
                    <p className="text-xs text-muted-foreground mt-2">Based on {templates.filter(t => t.is_active).length} active recurring expenses</p>
                </CardContent>
            </Card>

            <div className="space-y-3">
                <h3 className="text-lg font-bold mb-4">Upcoming Renewals</h3>
                
                {loading ? (
                    <div className="space-y-3">
                        <div className="h-20 w-full rounded-3xl bg-secondary/10 animate-pulse" />
                        <div className="h-20 w-full rounded-3xl bg-secondary/10 animate-pulse" />
                        <div className="h-20 w-full rounded-3xl bg-secondary/10 animate-pulse" />
                    </div>
                ) : templates.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground border border-dashed border-white/10 rounded-3xl">
                        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>No active subscriptions found.</p>
                        <p className="text-xs opacity-70 mt-1">Add a recurring expense to see it here.</p>
                    </div>
                ) : (
                    templates.filter(t => t.is_active).map((template) => {
                        const bucketId = (template.metadata && typeof template.metadata === 'object'
                            ? (template.metadata as Record<string, unknown>).bucket_id
                            : null) as string | null;
                        const linkedBucket = bucketId ? buckets.find(b => b.id === bucketId) : null;
                        return (
                        <Card key={template.id} className="bg-card/40 border-white/5 backdrop-blur-sm overflow-hidden group">
                            <CardContent className="p-4 flex items-center gap-4">
                                <div className={cn("w-12 h-12 rounded-2xl flex flex-col items-center justify-center shrink-0 border", themeConfig.bg, themeConfig.border)}>
                                    <span className={cn("text-[10px] font-bold uppercase leading-tight w-full text-center py-0.5 rounded-t-lg", themeConfig.text, themeConfig.headerBg)}>
                                        {format(parseISO(template.next_occurrence), 'MMM')}
                                    </span>
                                    <span className="text-lg font-bold text-foreground">
                                        {format(parseISO(template.next_occurrence), 'd')}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-base truncate">{template.description}</h4>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                                        <span className="capitalize bg-secondary/50 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider">{template.frequency}</span>
                                        <div className="flex items-center gap-1 opacity-70">
                                            <div className="w-3.5 h-3.5 flex items-center justify-center">
                                                {getIconForCategory(template.category, "w-full h-full", { style: { color: CATEGORY_COLORS[template.category] || CATEGORY_COLORS.others } })}
                                            </div>
                                            <span className="truncate">{getCategoryLabel(template.category)}</span>
                                        </div>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <button
                                                    type="button"
                                                    className={cn(
                                                        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border transition-colors",
                                                        linkedBucket
                                                            ? "bg-cyan-500/10 border-cyan-500/25 text-cyan-300 hover:bg-cyan-500/15"
                                                            : "bg-secondary/30 border-white/5 text-muted-foreground/70 hover:text-foreground"
                                                    )}
                                                    aria-label={linkedBucket ? `Bucket: ${linkedBucket.name}, change` : 'Assign bucket'}
                                                >
                                                    {linkedBucket ? (
                                                        <>
                                                            <span className="w-2.5 h-2.5 inline-flex items-center justify-center">
                                                                {getBucketIcon(linkedBucket.icon)}
                                                            </span>
                                                            <span className="truncate max-w-[80px]">{linkedBucket.name}</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Tag className="w-2.5 h-2.5" aria-hidden="true" />
                                                            <span>Add to bucket</span>
                                                        </>
                                                    )}
                                                </button>
                                            </PopoverTrigger>
                                            <PopoverContent align="start" className="w-56 p-1 bg-card/95 backdrop-blur-xl border-white/10">
                                                <div className="max-h-64 overflow-y-auto">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleAssignBucket(template, null)}
                                                        className={cn(
                                                            "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-secondary/30 transition-colors",
                                                            !bucketId && "bg-secondary/20"
                                                        )}
                                                    >
                                                        <X className="w-3 h-3 text-muted-foreground" aria-hidden="true" />
                                                        <span>No bucket</span>
                                                    </button>
                                                    {buckets.filter(b => !b.is_archived).map(b => (
                                                        <button
                                                            type="button"
                                                            key={b.id}
                                                            onClick={() => handleAssignBucket(template, b.id)}
                                                            className={cn(
                                                                "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-secondary/30 transition-colors",
                                                                bucketId === b.id && "bg-cyan-500/10 text-cyan-300"
                                                            )}
                                                        >
                                                            <span className="w-3 h-3 inline-flex items-center justify-center text-cyan-400">
                                                                {getBucketIcon(b.icon)}
                                                            </span>
                                                            <span className="truncate">{b.name}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2 shrink-0">
                                    <span className="font-bold text-base">{formatCurrency(template.amount, template.currency)}</span>
                                    <button
                                        onClick={() => setCancelTarget(template.id)}
                                        className="text-rose-400 hover:text-rose-300 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                        title="Cancel Subscription"
                                        aria-label="Cancel subscription"
                                    >
                                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                                    </button>
                                </div>
                            </CardContent>
                        </Card>
                        );
                    })
                )}
            </div>
            
            {templates.filter(t => !t.is_active).length > 0 && (
                 <div className="pt-6 border-t border-white/10 space-y-3">
                     <h3 className="text-sm font-bold text-muted-foreground">Inactive Subscriptions</h3>
                     {templates.filter(t => !t.is_active).map((template) => (
                         <div key={template.id} className={cn("flex justify-between items-center p-3 rounded-xl bg-secondary/10 opacity-70 border border-white/5 group", themeConfig.bg)}>
                             <div className="flex items-center gap-3">
                                 <RotateCw className={cn("w-4 h-4", themeConfig.text)} />
                                 <span className="font-medium text-sm line-through opacity-60">{template.description}</span>
                             </div>
                             <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-muted-foreground">{formatCurrency(template.amount, template.currency)} / {template.frequency}</span>
                                <button 
                                    onClick={() => handleToggleActive(template.id, false)}
                                    className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors", themeConfig.text)}
                                >
                                    Re-activate
                                </button>
                             </div>
                         </div>
                     ))}
                 </div>
            )}
            
            </div>
        </motion.div>

        <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
            <AlertDialogContent className="bg-card/95 backdrop-blur-xl border-white/10 rounded-3xl">
                <AlertDialogHeader>
                    <AlertDialogTitle>Cancel this subscription?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Future transactions for this subscription will not be created automatically. You can re-activate it anytime.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setCancelTarget(null)}>Keep</AlertDialogCancel>
                    <AlertDialogAction
                        className="bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:bg-rose-500/30"
                        onClick={() => { if (cancelTarget) { handleToggleActive(cancelTarget, true); setCancelTarget(null); } }}
                    >
                        Cancel Subscription
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    );
}
