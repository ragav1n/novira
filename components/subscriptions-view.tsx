'use client';

import { motion } from 'framer-motion';

import React, { useEffect, useState } from 'react';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { supabase } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, CreditCard, RotateCw, Trash2, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { useRouter } from 'next/navigation';

interface RecurringTemplate {
    id: string;
    description: string;
    amount: number;
    currency: string;
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    next_occurrence: string;
    last_processed: string | null;
    category: string;
    is_active: boolean;
}

export function SubscriptionsView() {
    const { userId, formatCurrency, convertAmount, currency } = useUserPreferences();
    const router = useRouter();
    const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;

        const loadTemplates = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from('recurring_templates')
                .select('*')
                .eq('user_id', userId)
                .order('next_occurrence', { ascending: true });

            if (!error && data) {
                setTemplates(data);
            }
            setLoading(false);
        };

        loadTemplates();
    }, [userId]);

    const handleCancel = async (id: string) => {
        if (!confirm('Are you sure you want to cancel this subscription?')) return;
        
        // Optimistic update
        setTemplates(prev => prev.map(t => t.id === id ? { ...t, is_active: false } : t));
        
        await supabase
            .from('recurring_templates')
            .update({ is_active: false })
            .eq('id', id);
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
        <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 0.8 }}
            className="relative min-h-screen w-full"
        >
            <div className="p-5 space-y-6 max-w-md mx-auto relative min-h-screen">
                <div className="flex items-center justify-between relative min-h-[40px] mb-2">
                <button 
                    onClick={() => router.back()} 
                    className="w-10 h-10 rounded-full bg-secondary/30 hover:bg-secondary/50 flex items-center justify-center transition-colors shrink-0 z-10"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <h1 className="text-lg font-semibold flex items-center gap-2">
                        <RotateCw className="w-5 h-5 text-primary" /> 
                        Subscriptions
                    </h1>
                </div>
                <div className="w-10 shrink-0 z-10" />
            </div>

            <Card className="bg-gradient-to-br from-[#8A2BE2]/20 to-[#4B0082]/20 border-primary/20 backdrop-blur-md">
                <CardContent className="p-6">
                    <p className="text-sm text-muted-foreground font-medium mb-1">Estimated Monthly Cost</p>
                    <h2 className="text-3xl font-bold text-primary">{formatCurrency(totalMonthly)}</h2>
                    <p className="text-xs text-muted-foreground mt-2">Based on {templates.filter(t => t.is_active).length} active recurring expenses</p>
                </CardContent>
            </Card>

            <div className="space-y-3">
                <h3 className="text-lg font-bold mb-4">Upcoming Renewals</h3>
                
                {templates.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground border border-dashed border-white/10 rounded-3xl">
                        <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p>No active subscriptions found.</p>
                        <p className="text-xs opacity-70 mt-1">Add a recurring expense to see it here.</p>
                    </div>
                ) : (
                    templates.filter(t => t.is_active).map((template) => (
                        <Card key={template.id} className="bg-card/40 border-white/5 backdrop-blur-sm overflow-hidden group">
                            <CardContent className="p-4 flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex flex-col items-center justify-center shrink-0 border border-primary/20">
                                    <span className="text-[10px] font-bold text-primary uppercase leading-tight bg-primary/20 w-full text-center py-0.5 rounded-t-lg">
                                        {format(parseISO(template.next_occurrence), 'MMM')}
                                    </span>
                                    <span className="text-lg font-bold text-foreground">
                                        {format(parseISO(template.next_occurrence), 'd')}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold text-base truncate">{template.description}</h4>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                        <span className="capitalize bg-secondary/50 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider">{template.frequency}</span>
                                        <span className="truncate">{template.category}</span>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-2 shrink-0">
                                    <span className="font-bold text-base">{formatCurrency(template.amount, template.currency)}</span>
                                    <button 
                                        onClick={() => handleCancel(template.id)}
                                        className="text-rose-400 hover:text-rose-300 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                        title="Cancel Subscription"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
            
            {templates.filter(t => !t.is_active).length > 0 && (
                 <div className="pt-6 border-t border-white/10 space-y-3">
                     <h3 className="text-sm font-bold text-muted-foreground">Inactive Subscriptions</h3>
                     {templates.filter(t => !t.is_active).map((template) => (
                         <div key={template.id} className="flex justify-between items-center p-3 rounded-xl bg-secondary/10 opacity-60">
                             <div className="flex items-center gap-3">
                                 <RotateCw className="w-4 h-4 text-muted-foreground" />
                                 <span className="font-medium text-sm line-through">{template.description}</span>
                             </div>
                             <span className="text-xs font-bold text-muted-foreground">{formatCurrency(template.amount, template.currency)} / {template.frequency}</span>
                         </div>
                     ))}
                 </div>
            )}
            
            </div>
        </motion.div>
    );
}
