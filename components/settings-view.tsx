'use client';

import React, { useEffect, useState } from 'react';
import { ChevronLeft, User, Download, AlertTriangle, Shield, Lock, ChevronRight, SlidersHorizontal, LogOut, Banknote, FileSpreadsheet, ShieldCheck, RefreshCcw, Camera, Trash2, Plus, Save, Wallet, Bell, Mail, Moon, Sun, Smartphone, Globe, CreditCard } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { toast } from '@/utils/haptics';
import { WaveLoader } from '@/components/ui/wave-loader';
import { AlertBanner } from '@/components/ui/alert-banner';
import { AnimatePresence, motion } from 'framer-motion';
import { generateCSV, generatePDF } from '@/utils/export-utils';
import { ChangePasswordDialog } from '@/components/change-password-dialog';
import { FileTriggerButton } from '@/components/ui/file-trigger';
import { DeleteAccountDialog } from '@/components/delete-account-dialog';
import { ExportDateRangeModal } from '@/components/export-date-range-modal';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { useBuckets } from '@/components/providers/buckets-provider';
import { useGroups } from '@/components/providers/groups-provider';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CurrencyDropdown } from '@/components/ui/currency-dropdown';

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
    const [exportModalOpen, setExportModalOpen] = useState(false);
    const [exportType, setExportType] = useState<'csv' | 'pdf' | null>(null);
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
        userId,
        user,
        setAvatarUrl: setAvatarUrlProvider,
        CURRENCY_DETAILS
    } = useUserPreferences();

    const { buckets } = useBuckets();
    const { groups } = useGroups();

    // Local state for budget input to allow typing before saving
    const [localBudget, setLocalBudget] = useState(monthlyBudget.toString());

    const [hasPassword, setHasPassword] = useState(false);
    const [hasGoogleIdentity, setHasGoogleIdentity] = useState(false);
    const [recurringTemplates, setRecurringTemplates] = useState<any[]>([]);
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [templateToDelete, setTemplateToDelete] = useState<any | null>(null);

    useEffect(() => {
        setLocalBudget(monthlyBudget.toString());
    }, [monthlyBudget]);

    useEffect(() => {
        getProfile();
        if (userId) loadRecurringTemplates();
    }, [userId]);

    const getProfile = async () => {
        try {
            if (user) {
                if (user.email) setUserEmail(user.email);

                // User has a password if they have an 'email' identity
                const hasEmailIdentity = user.identities?.some(identity => identity.provider === 'email');
                setHasPassword(!!hasEmailIdentity);

                // Check for Google identity
                const hasGoogle = user.identities?.some(identity => identity.provider === 'google');
                setHasGoogleIdentity(!!hasGoogle);
            }

            if (!userId) return;

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

    const loadRecurringTemplates = async () => {
        if (!userId) return;
        setLoadingTemplates(true);
        try {
            const { data, error } = await supabase
                .from('recurring_templates')
                .select('*')
                .eq('user_id', userId)
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setRecurringTemplates(data || []);
        } catch (error) {
            console.error('Error loading recurring templates:', error);
        } finally {
            setLoadingTemplates(false);
        }
    };

    const deleteRecurringTemplate = async (templateId: string) => {
        try {
            const { error } = await supabase
                .from('recurring_templates')
                .delete()
                .eq('id', templateId);

            if (error) throw error;
            setRecurringTemplates(prev => prev.filter(t => t.id !== templateId));
            toast.success('Recurring expense stopped');
        } catch (error: any) {
            toast.error('Failed to stop recurring expense: ' + error.message);
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
            setAvatarUrlProvider(publicUrl);
            toast.success('Avatar updated successfully');
        } catch (error: any) {
            console.error('Error uploading avatar:', error);
            toast.error('Error uploading avatar: ' + error.message);
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleExportClick = (type: 'csv' | 'pdf') => {
        setExportType(type);
        setExportModalOpen(true);
    };

    const handleExportConfirm = async (dateRange: DateRange | null, bucketId: string | null) => {
        setLoadingExport(true);
        try {
            if (!userId) return;

            let query = supabase
                .from('transactions')
                .select('*')
                .order('date', { ascending: false });

            if (dateRange?.from) {
                query = query.gte('date', format(dateRange.from, 'yyyy-MM-dd'));
            }
            if (dateRange?.to) {
                query = query.lte('date', format(dateRange.to, 'yyyy-MM-dd'));
            }
            if (bucketId) {
                query = query.eq('bucket_id', bucketId);
            }

            const { data: transactions, error } = await query;

            if (error) throw error;

            if (!transactions || transactions.length === 0) {
                toast.error('No transactions found for the selected period');
                setExportModalOpen(false);
                return;
            }

            if (exportType === 'csv') {
                generateCSV(transactions, currency, convertAmount, formatCurrency, buckets, groups);
                toast.success('CSV Exported successfully');
            } else {
                await generatePDF(transactions, currency, convertAmount, formatCurrency, buckets, groups, dateRange || undefined, {
                    email: user?.email,
                    avatarUrl
                });
                toast.success('PDF Exported successfully');
            }
            setExportModalOpen(false);
        } catch (error: any) {
            console.error('Export failed details:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code,
                stack: error.stack,
                error
            });
            toast.error('Failed to export data: ' + (error.message || 'Unknown error'));
        } finally {
            setLoadingExport(false);
        }
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/signin');
    };



    return (
        <div className="relative min-h-screen">
            <AnimatePresence>
                {loading && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-background/20 backdrop-blur-[2px]"
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: 'rgba(12, 8, 30, 0.2)',
                            backdropFilter: 'blur(2px)',
                            zIndex: 50
                        }}
                    >
                        <WaveLoader bars={5} message="Loading settings..." />
                    </motion.div>
                )}
            </AnimatePresence>

            <div className={cn(
                "p-5 space-y-6 max-w-md mx-auto relative transition-all duration-300",
                loading ? "opacity-40 blur-[1px] pointer-events-none" : "opacity-100 blur-0"
            )}>
                {/* Header */}
                <div className="flex items-center justify-between mb-6 relative min-h-[40px]">
                    <button
                        onClick={() => router.back()}
                        className="p-2 rounded-full bg-secondary/30 hover:bg-secondary/50 transition-colors shrink-0 z-10"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <h2 className="text-lg font-semibold truncate px-12">Settings</h2>
                    </div>
                    <div className="w-9 shrink-0 z-10" />
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
                                <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Monthly Allowance</label>
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

                {/* Recurring Expenses Management */}
                <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                        <RefreshCcw className="w-4 h-4" />
                        <span>Recurring Expenses</span>
                    </div>
                    <div className="bg-secondary/5 rounded-xl border border-white/5 divide-y divide-white/5">
                        {loadingTemplates ? (
                            <div className="p-4 text-center text-xs text-muted-foreground">Loading...</div>
                        ) : recurringTemplates.length > 0 ? (
                            recurringTemplates.map((template) => (
                                <div key={template.id} className="flex items-center justify-between p-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                            <RefreshCcw className="w-4 h-4 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium truncate max-w-[150px]">{template.description}</p>
                                            <p className="text-[10px] text-muted-foreground">
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
                    <p className="text-[10px] text-muted-foreground">Manage your automated recurring transactions.</p>
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
                            onClick={() => handleExportClick('csv')}
                            disabled={loadingExport}
                            className="h-16 flex flex-col items-center justify-center gap-1 bg-secondary/5 border-primary/20 hover:bg-primary/10 hover:border-primary/50 transition-all group"
                        >
                            <Download className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                            <span className="text-xs font-medium">{loadingExport ? 'Exporting...' : 'Export CSV'}</span>
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => handleExportClick('pdf')}
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
                        <div className="flex flex-col gap-3 p-3">
                            <div className="flex items-center gap-3">
                                <Banknote className="w-4 h-4 text-muted-foreground" />
                                <div>
                                    <p className="text-sm font-medium">Currency</p>
                                    <p className="text-[10px] text-muted-foreground">Select your preferred currency</p>
                                </div>
                            </div>
                            <div className="mt-1">
                                <CurrencyDropdown value={currency} onValueChange={(val) => setCurrency(val as any)} />
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
                        {/* Primary Email (ReadOnly) */}
                        <div className="flex items-center justify-between p-3">
                            <div className="flex items-center gap-3">
                                <Lock className="w-4 h-4 text-muted-foreground" />
                                <div>
                                    <p className="text-sm font-medium">Account Email</p>
                                    <p className="text-[10px] text-muted-foreground">{userEmail}</p>
                                </div>
                            </div>
                            <div className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-white/5 text-muted-foreground border border-white/10">
                                Primary
                            </div>
                        </div>

                        {hasPassword && (
                            <ChangePasswordDialog
                                mode="change"
                                onSuccess={getProfile}
                                trigger={
                                    <button className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors text-left outline-none group/btn">
                                        <div className="flex items-center gap-3">
                                            <Lock className="w-4 h-4 text-muted-foreground group-hover/btn:text-primary transition-colors" />
                                            <span className="text-sm font-medium text-muted-foreground group-hover/btn:text-foreground transition-colors">Change Password</span>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover/btn:translate-x-0.5 transition-all" />
                                    </button>
                                }
                            />
                        )}

                        {hasGoogleIdentity && (
                            <div className={cn(
                                "flex items-center justify-between p-3",
                                hasPassword ? "bg-transparent border-t border-white/5" : "bg-white/[0.02]"
                            )}>
                                <div className="flex items-center gap-3">
                                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                                        <path
                                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                            fill="#4285F4"
                                        />
                                        <path
                                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                            fill="#34A853"
                                        />
                                        <path
                                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                            fill="#FBBC05"
                                        />
                                        <path
                                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                            fill="#EA4335"
                                        />
                                    </svg>
                                    <span className="text-sm font-medium text-muted-foreground">
                                        {hasPassword ? "Google Account Linked" : "Connected via Google"}
                                    </span>
                                </div>
                                {hasPassword && (
                                    <div className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-primary/10 text-primary border border-primary/20">
                                        Linked
                                    </div>
                                )}
                            </div>
                        )}
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
                    <p className="text-xs text-muted-foreground font-medium">Novira v2.1</p>
                    <div className="flex justify-center items-center gap-2 text-[10px] text-muted-foreground">
                        <Shield className="w-3 h-3" />
                        <span>Secure & Encrypted</span>
                    </div>
                </div>

                <ExportDateRangeModal
                    isOpen={exportModalOpen}
                    onOpenChange={setExportModalOpen}
                    onExport={handleExportConfirm}
                    loading={loadingExport}
                    title={exportType === 'csv' ? 'Export CSV' : 'Export PDF'}
                />

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
                                        deleteRecurringTemplate(templateToDelete.id);
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
        </div>
    );
}
