'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, User, Shield, ChevronRight, LogOut, Trash2, Wrench, RefreshCcw, Download, SlidersHorizontal, Bell, Globe, Zap, LayoutDashboard, BookOpen, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { supabase } from '@/lib/supabase';
import { toast } from '@/utils/haptics';
import { version as APP_VERSION } from '@/package.json';
import { AlertBanner } from '@/components/ui/alert-banner';
import { AnimatePresence, motion } from 'framer-motion';
import { generateCSV, generatePDF } from '@/utils/export-utils';
import { buildIcs, downloadIcs } from '@/lib/ics-export';
import type { SavingsGoal } from '@/types/goal';
import { FileTriggerButton } from '@/components/ui/file-trigger';
import { DeleteAccountDialog } from '@/components/delete-account-dialog';
import { ExportDateRangeModal } from '@/components/export-date-range-modal';
import { DateRange } from 'react-day-picker';
import { format } from 'date-fns';
import { useBucketsList } from '@/components/providers/buckets-provider';
import { useGroups } from '@/components/providers/groups-provider';
import { useSyncQueueState } from '@/hooks/use-sync-queue-state';
import { useTransactionInvalidationListener } from '@/hooks/useTransactionInvalidationListener';
import type { RecurringTemplate } from '@/types/transaction';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { RecurringExpensesSection } from '@/components/settings/recurring-expenses-section';
import { CategorizationRulesSection } from '@/components/settings/categorization-rules-section';
import { useCategorizationRules } from '@/hooks/useCategorizationRules';
import { DataManagementSection } from '@/components/settings/data-management-section';
import { DashboardLayoutSection } from '@/components/settings/dashboard-layout-section';
import { PreferencesSection } from '@/components/settings/preferences-section';
import { NotificationsSection } from '@/components/settings/notifications-section';
import { LocaleSection } from '@/components/settings/locale-section';
import { QuickAddDefaultsSection } from '@/components/settings/quick-add-defaults-section';
import { SecuritySection } from '@/components/settings/security-section';
import { FailedSyncSection } from '@/components/settings/failed-sync-section';

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
    const [loadingIcs, setLoadingIcs] = useState(false);
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
        billReminderLeadDays,
        setBillReminderLeadDays,
        monthlyBudget,
        setMonthlyBudget,
        userId,
        user,
        activeWorkspaceId,
        setAvatarUrl: setAvatarUrlProvider,
        privacyMode,
        setPrivacyMode,
        digestFrequency,
        setDigestFrequency,
        bucketDeadlineAlerts,
        setBucketDeadlineAlerts,
        spendingPaceAlerts,
        setSpendingPaceAlerts,
        quietHoursStart,
        quietHoursEnd,
        setQuietHours,
        smartDigestsEnabled,
        setSmartDigestsEnabled,
        firstDayOfWeek,
        setFirstDayOfWeek,
        dateFormat,
        setDateFormat,
        defaultCategory,
        setDefaultCategory,
        defaultPaymentMethod,
        setDefaultPaymentMethod,
        defaultBucketId,
        setDefaultBucketId,
    } = useUserPreferences();

    const { buckets } = useBucketsList();
    const { groups } = useGroups();
    const push = usePushNotifications();
    const { rules: categorizationRules, loading: loadingRules } = useCategorizationRules(userId);

    // Local state for budget input to allow typing before saving
    const [localBudget, setLocalBudget] = useState(monthlyBudget.toString());

    const [hasPassword, setHasPassword] = useState(false);
    const [hasGoogleIdentity, setHasGoogleIdentity] = useState(false);
    const [recurringTemplates, setRecurringTemplates] = useState<RecurringTemplate[]>([]);
    const [loadingTemplates, setLoadingTemplates] = useState(true);

    const { failedItems, pending } = useSyncQueueState();

    // Honor a URL hash like `#notifications` so deep links can open a specific
    // section. Computed once on mount; users can still collapse/expand after.
    const [defaultOpenSections] = useState<string[]>(() => {
        if (typeof window === 'undefined') return [];
        const hash = window.location.hash.replace('#', '').trim();
        const valid = ['recurring', 'data', 'notifications', 'locale', 'quick-add', 'dashboard-layout', 'general', 'security'];
        return hash && valid.includes(hash) ? [hash] : [];
    });

    useEffect(() => {
        setLocalBudget(monthlyBudget.toString());
    }, [monthlyBudget]);

    useEffect(() => {
        if (userId) {
            Promise.allSettled([getProfile(), loadRecurringTemplates()]);
        } else {
            getProfile();
        }
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
        if (!userId) {
            setLoadingTemplates(false);
            return;
        }
        setLoadingTemplates(true);
        try {
            const { data, error } = await supabase
                .from('recurring_templates')
                .select('id, description, amount, currency, frequency, created_at, next_occurrence, category, is_active, is_income')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) {
                // Fallback: some columns may not exist yet — retry with minimal columns
                const { data: fallbackData, error: fallbackError } = await supabase
                    .from('recurring_templates')
                    .select('id, description, amount, currency, frequency, created_at, category, is_active')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false });
                if (fallbackError) throw fallbackError;
                setRecurringTemplates(
                    ((fallbackData || []) as RecurringTemplate[])
                        .map((t) => ({ ...t, next_occurrence: t.next_occurrence ?? '', last_processed: t.last_processed ?? null }))
                        .filter((t) => t.is_active)
                );
                return;
            }
            setRecurringTemplates(
                (data || [])
                    .map(t => ({ ...t, last_processed: null as string | null }))
                    .filter(t => t.is_active)
            );
        } catch (error) {
            console.warn('Error loading recurring templates:', error);
        } finally {
            setLoadingTemplates(false);
        }
    };

    // Realtime subscriptions for profile and recurring templates
    const getProfileRef = useRef(getProfile);
    getProfileRef.current = getProfile;
    const loadTemplatesRef = useRef(loadRecurringTemplates);
    loadTemplatesRef.current = loadRecurringTemplates;

    useTransactionInvalidationListener(() => loadTemplatesRef.current());

    useEffect(() => {
        if (!userId) return;

        const channel = supabase
            .channel(`settings-sync-${userId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
                () => getProfileRef.current())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'recurring_templates', filter: `user_id=eq.${userId}` },
                () => loadTemplatesRef.current())
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [userId]);

    const deleteRecurringTemplate = async (templateId: string) => {
        try {
            const { error } = await supabase
                .from('recurring_templates')
                .update({ is_active: false })
                .eq('id', templateId);

            if (error) throw error;
            setRecurringTemplates(prev => prev.filter(t => t.id !== templateId));
            toast.success('Recurring expense stopped');
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            toast.error('Failed to stop recurring expense: ' + msg);
        }
    };


    const updateProfile = async () => {
        setSaving(true);
        try {
            if (!userId) return;

            const parsedBudget = parseFloat(localBudget);
            if (isNaN(parsedBudget) || parsedBudget < 0) {
                toast.error('Please enter a valid budget amount.');
                setSaving(false);
                return;
            }

            const updates = {
                id: userId,
                full_name: fullName,
                monthly_budget: parsedBudget,
                updated_at: new Date().toISOString(),
            };

            const { error } = await supabase
                .from('profiles')
                .upsert(updates);

            // Sync with provider
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
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            console.error('Error uploading avatar:', error);
            toast.error('Error uploading avatar: ' + msg);
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleExportClick = (type: 'csv' | 'pdf') => {
        setExportType(type);
        setExportModalOpen(true);
    };

    const handleExportICS = async () => {
        if (!userId) {
            toast.error('You must be signed in to export your calendar');
            return;
        }
        setLoadingIcs(true);
        try {
            const [templatesRes, goalsRes] = await Promise.all([
                supabase
                    .from('recurring_templates')
                    .select('id, description, amount, currency, frequency, next_occurrence, last_processed, category, is_active, created_at, payment_method, group_id, metadata')
                    .eq('user_id', userId)
                    .eq('is_active', true),
                supabase
                    .from('savings_goals')
                    .select('id, user_id, name, target_amount, current_amount, currency, deadline, icon, color, group_id, created_at')
                    .eq('user_id', userId),
            ]);

            const templates = (templatesRes.data ?? []) as RecurringTemplate[];
            const goals = (goalsRes.data ?? []) as SavingsGoal[];

            const ics = buildIcs({
                recurringTemplates: templates,
                goals,
                buckets,
                formatAmount: (amount, cur) => formatCurrency(amount, cur),
            });

            const stamp = new Date().toISOString().slice(0, 10);
            downloadIcs(`novira-${stamp}.ics`, ics);
            toast.success('Calendar file ready — import it into your calendar app');
        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            console.error('Error building .ics:', error);
            toast.error('Could not build calendar file: ' + msg);
        } finally {
            setLoadingIcs(false);
        }
    };

    const handleExportConfirm = async (dateRange: DateRange | null, bucketId: string | null, groupId: string | 'personal' | null) => {
        setLoadingExport(true);
        try {
            if (!userId) return;

            let query = supabase
                .from('transactions')
                .select('id, description, amount, category, date, payment_method, created_at, currency, bucket_id, group_id, notes, is_recurring, is_settlement, place_name, exclude_from_allowance, exchange_rate, base_currency, converted_amount, tags')
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
            if (groupId === 'personal') {
                query = query.is('group_id', null);
            } else if (groupId) {
                query = query.eq('group_id', groupId);
            }

            const { data: transactions, error } = await query;

            if (error) throw error;

            if (!transactions || transactions.length === 0) {
                toast.error('No transactions found for the selected period');
                setExportModalOpen(false);
                return;
            }

            // Recurring templates scoped to the same workspace as the transactions —
            // exported as their own section so backups can recreate the schedule.
            let templatesQuery = supabase
                .from('recurring_templates')
                .select('id, description, category, amount, currency, frequency, next_occurrence, is_active, payment_method, group_id')
                .order('next_occurrence', { ascending: true });
            if (groupId === 'personal') {
                templatesQuery = templatesQuery.is('group_id', null).eq('user_id', userId);
            } else if (groupId) {
                templatesQuery = templatesQuery.eq('group_id', groupId);
            } else {
                templatesQuery = templatesQuery.eq('user_id', userId);
            }
            const { data: recurringTemplates } = await templatesQuery;

            const workspaceName = activeWorkspaceId
                ? groups.find(g => g.id === activeWorkspaceId)?.name
                : 'Personal';

            if (exportType === 'csv') {
                generateCSV(transactions, currency, convertAmount, formatCurrency, buckets, groups, dateRange || undefined, {
                    email: user?.email,
                    workspaceName,
                    monthlyBudget,
                }, recurringTemplates ?? []);
                toast.success('CSV Exported successfully');
            } else {
                await generatePDF(transactions, currency, convertAmount, formatCurrency, buckets, groups, dateRange || undefined, {
                    email: user?.email,
                    avatarUrl,
                    workspaceName,
                    monthlyBudget,
                }, recurringTemplates ?? []);

                toast.success('PDF Exported successfully');
            }
            setExportModalOpen(false);
        } catch (error) {
            const e = error as { message?: string; details?: string; hint?: string; code?: string; stack?: string };
            console.error('Export failed details:', {
                message: e?.message,
                details: e?.details,
                hint: e?.hint,
                code: e?.code,
                stack: e?.stack,
                error
            });
            toast.error('Failed to export data: ' + (e?.message || 'Unknown error'));
        } finally {
            setLoadingExport(false);
        }
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/signin');
    };



    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="relative min-h-screen"
        >


            <div className={cn(
                "p-5 space-y-6 max-w-md lg:max-w-4xl mx-auto relative transition-opacity duration-300",
                loading ? "opacity-40 pointer-events-none" : "opacity-100"
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

                <Accordion
                    type="multiple"
                    defaultValue={defaultOpenSections}
                    className="rounded-xl border border-white/5 bg-secondary/5 divide-y divide-white/5"
                >
                    <AccordionItem value="recurring" className="border-b-0 px-3">
                        <AccordionTrigger className="text-sm font-semibold text-muted-foreground hover:no-underline">
                            <div className="flex items-center gap-2">
                                <RefreshCcw className="w-4 h-4" />
                                <span>Recurring Expenses</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                            <RecurringExpensesSection
                                templates={recurringTemplates}
                                loading={loadingTemplates}
                                formatCurrency={formatCurrency}
                                onDelete={deleteRecurringTemplate}
                            />
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="auto-categorization" className="border-b-0 px-3">
                        <AccordionTrigger className="text-sm font-semibold text-muted-foreground hover:no-underline">
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4" />
                                <span>Auto-categorization rules</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                            <CategorizationRulesSection
                                userId={userId}
                                rules={categorizationRules}
                                loading={loadingRules}
                                buckets={buckets}
                            />
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="data" className="border-b-0 px-3">
                        <AccordionTrigger className="text-sm font-semibold text-muted-foreground hover:no-underline">
                            <div className="flex items-center gap-2">
                                <Download className="w-4 h-4" />
                                <span>Data Management</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                            <DataManagementSection
                                loading={loadingExport}
                                onImport={() => router.push('/import')}
                                onExportCSV={() => handleExportClick('csv')}
                                onExportPDF={() => handleExportClick('pdf')}
                                onExportICS={handleExportICS}
                                icsLoading={loadingIcs}
                            />
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="notifications" className="border-b-0 px-3">
                        <AccordionTrigger className="text-sm font-semibold text-muted-foreground hover:no-underline">
                            <div className="flex items-center gap-2">
                                <Bell className="w-4 h-4" />
                                <span>Notifications</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                            <NotificationsSection
                                push={push}
                                digestFrequency={digestFrequency}
                                setDigestFrequency={setDigestFrequency}
                                billReminderLeadDays={billReminderLeadDays}
                                setBillReminderLeadDays={setBillReminderLeadDays}
                                bucketDeadlineAlerts={bucketDeadlineAlerts}
                                setBucketDeadlineAlerts={setBucketDeadlineAlerts}
                                spendingPaceAlerts={spendingPaceAlerts}
                                setSpendingPaceAlerts={setSpendingPaceAlerts}
                                quietHoursStart={quietHoursStart}
                                quietHoursEnd={quietHoursEnd}
                                setQuietHours={setQuietHours}
                                smartDigestsEnabled={smartDigestsEnabled}
                                setSmartDigestsEnabled={setSmartDigestsEnabled}
                            />
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="locale" className="border-b-0 px-3">
                        <AccordionTrigger className="text-sm font-semibold text-muted-foreground hover:no-underline">
                            <div className="flex items-center gap-2">
                                <Globe className="w-4 h-4" />
                                <span>Currency &amp; Locale</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                            <LocaleSection
                                currency={currency}
                                setCurrency={setCurrency}
                                firstDayOfWeek={firstDayOfWeek}
                                setFirstDayOfWeek={setFirstDayOfWeek}
                                dateFormat={dateFormat}
                                setDateFormat={setDateFormat}
                            />
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="quick-add" className="border-b-0 px-3">
                        <AccordionTrigger className="text-sm font-semibold text-muted-foreground hover:no-underline">
                            <div className="flex items-center gap-2">
                                <Zap className="w-4 h-4" />
                                <span>Quick-Add Defaults</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                            <QuickAddDefaultsSection
                                defaultCategory={defaultCategory}
                                setDefaultCategory={setDefaultCategory}
                                defaultPaymentMethod={defaultPaymentMethod}
                                setDefaultPaymentMethod={setDefaultPaymentMethod}
                                defaultBucketId={defaultBucketId}
                                setDefaultBucketId={setDefaultBucketId}
                                buckets={buckets}
                            />
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="dashboard-layout" className="border-b-0 px-3">
                        <AccordionTrigger className="text-sm font-semibold text-muted-foreground hover:no-underline">
                            <div className="flex items-center gap-2">
                                <LayoutDashboard className="w-4 h-4" />
                                <span>Dashboard Layout</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                            <DashboardLayoutSection />
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="general" className="border-b-0 px-3">
                        <AccordionTrigger className="text-sm font-semibold text-muted-foreground hover:no-underline">
                            <div className="flex items-center gap-2">
                                <SlidersHorizontal className="w-4 h-4" />
                                <span>General</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                            <PreferencesSection
                                budgetAlertsEnabled={budgetAlertsEnabled}
                                onToggleBudgetAlerts={(checked) => {
                                    setBudgetAlertsEnabled(checked);
                                    if (checked) {
                                        setShowAlert(true);
                                        setTimeout(() => setShowAlert(false), 5000);
                                    } else {
                                        setShowAlert(false);
                                    }
                                }}
                                privacyMode={privacyMode}
                                setPrivacyMode={setPrivacyMode}
                            />
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="security" className="border-b-0 px-3">
                        <AccordionTrigger className="text-sm font-semibold text-muted-foreground hover:no-underline">
                            <div className="flex items-center gap-2">
                                <Shield className="w-4 h-4" />
                                <span>Security &amp; Privacy</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                            <SecuritySection
                                userEmail={userEmail}
                                hasPassword={hasPassword}
                                hasGoogleIdentity={hasGoogleIdentity}
                                onPasswordChangeSuccess={getProfile}
                            />
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>

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

                <FailedSyncSection failedItems={failedItems} />

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

                {/* Help & Guide */}
                <div className="space-y-3 pt-2">
                    <div className="bg-secondary/5 rounded-xl border border-white/5 overflow-hidden">
                        <button
                            onClick={() => router.push('/guide')}
                            className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors text-left outline-none group"
                        >
                            <div className="flex items-center gap-3">
                                <BookOpen className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">User Guide</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-all" />
                        </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground px-1">
                        A complete walkthrough of every feature, with live animated demos.
                    </p>
                </div>

                {/* Troubleshooting */}
                <div className="space-y-3 pt-2">
                    <div className="bg-secondary/5 rounded-xl border border-white/5 overflow-hidden">
                        <button
                            onClick={() => router.push('/sw-reset')}
                            className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors text-left outline-none group"
                        >
                            <div className="flex items-center gap-3">
                                <Wrench className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">Reset App</span>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-all" />
                        </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground px-1">
                        Clears cached data, the offline queue, and signs you out on this device. Your account stays intact.
                    </p>
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
                    <p className="text-[11px] text-muted-foreground px-1">
                        Permanently delete your account and all associated data.
                    </p>
                </div>

                {/* Footer Info */}
                <div className="text-center py-4 space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">Novira v{APP_VERSION}</p>
                    <div className="flex justify-center items-center gap-3 text-[11px] text-muted-foreground">
                        <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
                        <span className="w-1 h-1 rounded-full bg-white/10" />
                        <Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
                    </div>
                    <div className="flex justify-center items-center gap-2 text-[11px] text-muted-foreground">
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
            </div>
        </motion.div>
    );
}
