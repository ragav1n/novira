'use client';

import React, { useEffect, useState } from 'react';
import { ChevronLeft, User, Download, AlertTriangle, Shield, Lock, ChevronRight, SlidersHorizontal, LogOut, Banknote, FileSpreadsheet } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { WaveLoader } from '@/components/ui/wave-loader';
import { AlertBanner } from '@/components/ui/alert-banner';
import { AnimatePresence } from 'framer-motion';
import { generateCSV, generatePDF } from '@/utils/export-utils';
import { ChangePasswordDialog } from '@/components/change-password-dialog';
import { FileTriggerButton } from '@/components/ui/file-trigger';
import { Camera, Trash2 } from 'lucide-react';
import { DeleteAccountDialog } from '@/components/delete-account-dialog';

export function SettingsView() {
    const router = useRouter();
    const budgetInputRef = React.useRef<HTMLInputElement>(null);
    const [fullName, setFullName] = useState('');
    // Removed local budget state
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [userEmail, setUserEmail] = useState('');
    // Removed local budgetAlertsEnabled state
    const [showAlert, setShowAlert] = useState(false);
    const [loadingExport, setLoadingExport] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const {
        currency,
        setCurrency,
        formatCurrency,
        convertAmount,
        budgetAlertsEnabled,
        setBudgetAlertsEnabled,
        monthlyBudget,
        setMonthlyBudget,
        userId
    } = useUserPreferences();

    // Local state for budget input to allow typing before saving
    const [localBudget, setLocalBudget] = useState(monthlyBudget.toString());

    useEffect(() => {
        setLocalBudget(monthlyBudget.toString());
    }, [monthlyBudget]);

    useEffect(() => {
        getProfile();
    }, [userId]);

    const getProfile = async () => {
        try {
            if (!userId) return;
            setUserEmail(''); // Email might not be available if not in session, but profile has it? No profile table might rely on sync. 
            // Actually, email is in auth.users, not profiles usually, unless synced.
            // Let's explicitly fetch email if needed or just skip it if not critical. 
            // For now, let's try to get session ONLY for email if we really need it, or just ignore. 
            // The UI uses email for avatar fallback. 
            // Let's keep a single getSession call just for email if strictly needed, or better, 
            // if we can get email from profile if we added it there. 
            // Checking previous code: `user.email`. 
            // We can fetch session for email, or just rely on profile name.

            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user?.email) setUserEmail(session.user.email);

            const { data, error } = await supabase
                .from('profiles')
                .select('full_name, monthly_budget, avatar_url')
                .eq('id', userId)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Error fetching profile:', error);
            }

            if (data) {
                setFullName(data.full_name || '');
                setAvatarUrl(data.avatar_url);
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateProfile = async () => {
        setSaving(true);
        try {
            if (!userId) return;

            const updates = {
                id: userId,
                full_name: fullName,
                monthly_budget: parseFloat(localBudget),
                updated_at: new Date().toISOString(),
            };

            const { error } = await supabase
                .from('profiles')
                .upsert(updates);

            // Sync with provider
            await setMonthlyBudget(updates.monthly_budget);

            if (error) throw error;
            toast.success('Profile updated successfully');
        } catch (error: any) {
            toast.error('Error updating profile: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleAvatarUpload = async (file: File) => {
        try {
            const MAX_SIZE = 10 * 1024 * 1024; // 10MB
            if (file.size > MAX_SIZE) {
                toast.error('File size too large. Maximum size is 10MB.');
                return;
            }

            setUploadingAvatar(true);
            if (!userId) return;

            const fileExt = file.name.split('.').pop();
            const fileName = `${userId}-${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            // Upload the file to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) {
                throw uploadError;
            }

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            // Update profile
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ avatar_url: publicUrl, updated_at: new Date().toISOString() })
                .eq('id', userId);

            if (updateError) {
                throw updateError;
            }

            setAvatarUrl(publicUrl);
            toast.success('Avatar updated successfully');
        } catch (error: any) {
            console.error('Error uploading avatar:', error);
            toast.error('Error uploading avatar: ' + error.message);
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleExport = async (type: 'csv' | 'pdf') => {
        setLoadingExport(true);
        try {
            if (!userId) return;

            const { data: transactions, error } = await supabase
                .from('transactions')
                .select('*')
                .order('date', { ascending: false });

            if (error) throw error; // And filter locally for safety/security or RLS handles it. RLS handles it.

            if (!transactions || transactions.length === 0) {
                toast.error('No transactions to export');
                return;
            }

            if (type === 'csv') {
                generateCSV(transactions, currency, convertAmount, formatCurrency);
                toast.success('CSV Exported successfully');
            } else {
                generatePDF(transactions, currency, convertAmount, formatCurrency);
                toast.success('PDF Exported successfully');
            }
        } catch (error: any) {
            console.error('Export failed:', error);
            toast.error('Failed to export data');
        } finally {
            setLoadingExport(false);
        }
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/signin');
    };

    if (loading) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center min-h-[50vh]">
                <WaveLoader bars={5} message="Loading settings..." />
            </div>
        );
    }

    return (
        <div className="p-5 space-y-6 max-w-md mx-auto relative min-h-full">
            {/* Header */}
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-full bg-secondary/30 hover:bg-secondary/50 transition-colors"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-lg font-semibold">Settings</h2>
                <div className="w-9" /> {/* Spacer to balance Back button */}
            </div>

            {/* Profile Section */}
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
                                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                fullName ? fullName.substring(0, 2) : userEmail.substring(0, 2)
                            )}
                            {uploadingAvatar && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
                                    <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                                </div>
                            )}
                        </div>

                        {/* File Trigger - Pencil Icon */}
                        <div className="absolute bottom-0 right-0 z-10 translate-x-1/4 translate-y-1/4">
                            <FileTriggerButton
                                onSelect={(file) => handleAvatarUpload(file)}
                                currentAvatarUrl={avatarUrl}
                            />
                        </div>
                    </div>

                    <div className="flex-1 space-y-3">
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Full Name</label>
                            <Input
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="bg-secondary/10 border-white/5 h-9"
                                placeholder="e.g. John Doe"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Monthly Budget</label>
                            <Input
                                ref={budgetInputRef}
                                value={localBudget}
                                onChange={(e) => setLocalBudget(e.target.value)}
                                className="bg-secondary/10 border-white/5 h-9"
                                placeholder="e.g. 3000"
                                type="number"
                            />
                        </div>
                        <Button
                            onClick={updateProfile}
                            disabled={saving}
                            className="w-full h-8 text-xs bg-primary/20 text-primary hover:bg-primary/30 border border-primary/20"
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Data Management */}
            <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <Download className="w-4 h-4" />
                    <span>Data Management</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <Button
                        variant="outline"
                        onClick={() => router.push('/import')}
                        disabled={loadingExport}
                        className="h-16 flex flex-col items-center justify-center gap-1 bg-secondary/5 border-primary/20 hover:bg-primary/10 hover:border-primary/50 transition-all group col-span-2"
                    >
                        <FileSpreadsheet className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-medium">Import Bank Statement (Excel/CSV)</span>
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => handleExport('csv')}
                        disabled={loadingExport}
                        className="h-16 flex flex-col items-center justify-center gap-1 bg-secondary/5 border-primary/20 hover:bg-primary/10 hover:border-primary/50 transition-all group"
                    >
                        <Download className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-medium">{loadingExport ? 'Exporting...' : 'Export CSV'}</span>
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => handleExport('pdf')}
                        disabled={loadingExport}
                        className="h-16 flex flex-col items-center justify-center gap-1 bg-secondary/5 border-primary/20 hover:bg-primary/10 hover:border-primary/50 transition-all group"
                    >
                        <Download className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-medium">{loadingExport ? 'Exporting...' : 'Export PDF'}</span>
                    </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">Import bank statements or export your expense data.</p>
            </div>

            {/* Preferences */}
            <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <SlidersHorizontal className="w-4 h-4" />
                    <span>Preferences</span>
                </div>

                <div className="bg-secondary/5 rounded-xl border border-white/5 divide-y divide-white/5">
                    <div className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3">
                            <Banknote className="w-4 h-4 text-muted-foreground" />
                            <div>
                                <p className="text-sm font-medium">Currency</p>
                                <p className="text-[10px] text-muted-foreground">Select your preferred currency</p>
                            </div>
                        </div>
                        <div className="flex items-center bg-secondary/20 rounded-lg p-0.5">
                            <button
                                onClick={() => setCurrency('USD')}
                                className={cn(
                                    "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                    currency === 'USD' ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                USD
                            </button>
                            <button
                                onClick={() => setCurrency('EUR')}
                                className={cn(
                                    "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                    currency === 'EUR' ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                EUR
                            </button>
                            <button
                                onClick={() => setCurrency('INR')}
                                className={cn(
                                    "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                    currency === 'INR' ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                INR
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                            <div>
                                <p className="text-sm font-medium">Budget Alerts</p>
                                <p className="text-[10px] text-muted-foreground">Alert when overspending</p>
                            </div>
                        </div>
                        <Switch
                            checked={budgetAlertsEnabled}
                            onCheckedChange={(checked) => {
                                setBudgetAlertsEnabled(checked);
                                if (checked) {
                                    setShowAlert(true);
                                    setTimeout(() => setShowAlert(false), 5000);
                                } else {
                                    setShowAlert(false);
                                }
                            }}
                        />
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {showAlert && (
                    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-[90%] max-w-md z-50">
                        <AlertBanner
                            variant="warning"
                            title="Budget Alerts Enabled"
                            description="You'll be notified when you exceed 80% of your budget."
                            onDismiss={() => setShowAlert(false)}
                            primaryAction={{
                                label: "Configure",
                                onClick: () => {
                                    setShowAlert(false);
                                    budgetInputRef.current?.focus();
                                    budgetInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                },
                            }}
                        />
                    </div>
                )}
            </AnimatePresence>

            {/* Security */}
            <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <Shield className="w-4 h-4" />
                    <span>Security & Privacy</span>
                </div>

                <div className="bg-secondary/5 rounded-xl border border-white/5 divide-y divide-white/5">
                    <ChangePasswordDialog
                        trigger={
                            <button className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors text-left outline-none">
                                <div className="flex items-center gap-3">
                                    <Lock className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-sm font-medium">Change Password</span>
                                </div>
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            </button>
                        }
                    />
                </div>
            </div>

            {/* Logout */}
            <div className="pt-2">
                <button
                    onClick={handleSignOut}
                    className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-secondary/10 hover:bg-secondary/20 text-muted-foreground hover:text-foreground transition-colors duration-200 border border-white/5"
                >
                    <LogOut className="w-4 h-4" />
                    <span className="font-medium text-sm">Log Out</span>
                </button>
            </div>

            {/* Danger Zone - Refined */}
            <div className="space-y-3 pt-2">
                {/* No header, just part of the flow or separate section */}

                <div className="bg-secondary/5 rounded-xl border border-white/5 overflow-hidden">
                    <DeleteAccountDialog
                        trigger={
                            <button className="w-full flex items-center justify-between p-3 hover:bg-destructive/5 transition-colors text-left outline-none group">
                                <div className="flex items-center gap-3">
                                    <Trash2 className="w-4 h-4 text-muted-foreground group-hover:text-destructive transition-colors" />
                                    <span className="text-sm font-medium text-muted-foreground group-hover:text-destructive transition-colors">Delete Account</span>
                                </div>
                                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-destructive/50 transition-colors" />
                            </button>
                        }
                    />
                </div>
                <p className="text-[10px] text-muted-foreground px-1">
                    Permanently delete your account and all associated data.
                </p>
            </div>

            {/* Footer Info */}
            <div className="text-center py-4 space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Novira v1.3</p>
                <div className="flex justify-center items-center gap-2 text-[10px] text-muted-foreground">
                    <Shield className="w-3 h-3" />
                    <span>Secure & Encrypted</span>
                </div>
            </div>
        </div>
    );
}
