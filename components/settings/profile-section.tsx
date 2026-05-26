'use client';

import React, { useEffect, useRef, useState } from 'react';
import { User } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { AlertBanner } from '@/components/ui/alert-banner';
import { FileTriggerButton } from '@/components/ui/file-trigger';
import { supabase } from '@/lib/supabase';
import { toast } from '@/utils/haptics';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';

interface Props {
    showBudgetAlert: boolean;
    onDismissBudgetAlert: () => void;
}

export function ProfileSection({ showBudgetAlert, onDismissBudgetAlert }: Props) {
    const { userId, user, monthlyBudget, setMonthlyBudget, setAvatarUrl: setAvatarUrlProvider } = useUserPreferences();

    const budgetInputRef = useRef<HTMLInputElement>(null);
    const [fullName, setFullName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [saving, setSaving] = useState(false);
    const [localBudget, setLocalBudget] = useState(monthlyBudget.toString());
    const userEmail = user?.email ?? '';

    useEffect(() => {
        setLocalBudget(monthlyBudget.toString());
    }, [monthlyBudget]);

    useEffect(() => {
        if (!userId) return;
        const loadProfile = async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('full_name, avatar_url')
                .eq('id', userId)
                .single();
            if (error && error.code !== 'PGRST116') {
                console.error('Error fetching profile:', error);
                return;
            }
            if (data) {
                setFullName(data.full_name || '');
                setAvatarUrl(data.avatar_url);
            }
        };
        loadProfile();

        const channel = supabase
            .channel(`profile-sync-${userId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
                () => { loadProfile(); }
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [userId]);

    const updateProfile = async () => {
        if (!userId) return;
        setSaving(true);
        try {
            const parsedBudget = parseFloat(localBudget);
            if (isNaN(parsedBudget) || parsedBudget < 0) {
                toast.error('Please enter a valid budget amount.');
                return;
            }
            const updates = {
                id: userId,
                full_name: fullName,
                monthly_budget: parsedBudget,
                updated_at: new Date().toISOString(),
            };
            const { error } = await supabase.from('profiles').upsert(updates);
            await setMonthlyBudget(updates.monthly_budget);
            if (error) throw error;
            toast.success('Profile updated successfully');
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            toast.error('Error updating profile: ' + msg);
        } finally {
            setSaving(false);
        }
    };

    const handleAvatarUpload = async (file: File) => {
        try {
            const MAX_SIZE = 10 * 1024 * 1024;
            if (file.size > MAX_SIZE) {
                toast.error('File size too large. Maximum size is 10MB.');
                return;
            }
            setUploadingAvatar(true);
            if (!userId) return;

            const fileExt = file.name.split('.').pop();
            const fileName = `${userId}-${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);

            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
                .eq('id', userId);
            if (updateError) throw updateError;

            setAvatarUrl(publicUrl);
            setAvatarUrlProvider(publicUrl);
            toast.success('Avatar updated successfully');
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            console.error('Error uploading avatar:', error);
            toast.error('Error uploading avatar: ' + msg);
        } finally {
            setUploadingAvatar(false);
        }
    };

    return (
        <>
            <div className="space-y-4">
                <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <span>Profile</span>
                    </div>
                </div>

                <div className="flex gap-4">
                    <div className="relative group self-start">
                        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-xl font-bold shadow-lg shadow-primary/20 text-white uppercase overflow-hidden relative">
                            {avatarUrl ? (
                                <img src={avatarUrl} alt="Avatar" width={64} height={64} className="w-full h-full object-cover" />
                            ) : (
                                fullName ? fullName.substring(0, 2) : userEmail.substring(0, 2)
                            )}
                            {uploadingAvatar && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
                                    <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                                </div>
                            )}
                        </div>
                        <div className="absolute bottom-0 right-0 z-10 translate-x-1/4 translate-y-1/4">
                            <FileTriggerButton
                                onSelect={(file) => handleAvatarUpload(file)}
                                currentAvatarUrl={avatarUrl}
                            />
                        </div>
                    </div>

                    <div className="flex-1 space-y-3">
                        <div className="space-y-1">
                            <label htmlFor="full-name" className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider">Full Name</label>
                            <Input
                                id="full-name"
                                name="full-name"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="bg-secondary/10 border-white/5 h-10 rounded-xl"
                                placeholder="e.g. John Doe"
                                autoComplete="name"
                            />
                        </div>
                        <div className="space-y-1">
                            <label htmlFor="monthly-allowance" className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider">Monthly Allowance</label>
                            <Input
                                id="monthly-allowance"
                                name="monthly-allowance"
                                ref={budgetInputRef}
                                value={localBudget}
                                onChange={(e) => setLocalBudget(e.target.value)}
                                className="bg-secondary/10 border-white/5 h-10 rounded-xl"
                                placeholder="e.g. 3000"
                                type="number"
                                inputMode="decimal"
                                autoComplete="off"
                            />
                        </div>
                        <Button
                            onClick={updateProfile}
                            disabled={saving}
                            className="w-full h-10 text-xs bg-primary/20 text-primary hover:bg-primary/30 border border-primary/20 rounded-xl font-bold"
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {showBudgetAlert && (
                    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-[90%] max-w-md z-50">
                        <AlertBanner
                            variant="warning"
                            title="Budget Alerts Enabled"
                            description="You'll be notified when you exceed 80% of your budget."
                            onDismiss={onDismissBudgetAlert}
                            primaryAction={{
                                label: "Configure",
                                onClick: () => {
                                    onDismissBudgetAlert();
                                    budgetInputRef.current?.focus();
                                    budgetInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                },
                            }}
                        />
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
