'use client';

import React, { useState } from 'react';
import { Bell, Download, Globe, LayoutDashboard, RefreshCcw, Shield, SlidersHorizontal, Sparkles, Wallet, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { useBucketsList } from '@/components/providers/buckets-provider';
import { useGroups } from '@/components/providers/groups-provider';
import { useSyncQueueState } from '@/hooks/use-sync-queue-state';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useCategorizationRules } from '@/hooks/useCategorizationRules';
import { useRecurringTemplates } from '@/hooks/useRecurringTemplates';
import { useDataExport } from '@/hooks/useDataExport';
import { RecurringExpensesSection } from '@/components/settings/recurring-expenses-section';
import { CategorizationRulesSection } from '@/components/settings/categorization-rules-section';
import { AccountsSection } from '@/components/settings/accounts-section';
import { DataManagementSection } from '@/components/settings/data-management-section';
import { DashboardLayoutSection } from '@/components/settings/dashboard-layout-section';
import { PreferencesSection } from '@/components/settings/preferences-section';
import { NotificationsSection } from '@/components/settings/notifications-section';
import { LocaleSection } from '@/components/settings/locale-section';
import { QuickAddDefaultsSection } from '@/components/settings/quick-add-defaults-section';
import { SecuritySection } from '@/components/settings/security-section';
import { FailedSyncSection } from '@/components/settings/failed-sync-section';
import { SettingsHeader } from '@/components/settings/settings-header';
import { ProfileSection } from '@/components/settings/profile-section';
import { SettingsAppFooter } from '@/components/settings/settings-app-footer';
import { ExportDateRangeModal } from '@/components/export-date-range-modal';

export function SettingsView() {
    const router = useRouter();
    const {
        currency,
        setCurrency,
        formatCurrency,
        budgetAlertsEnabled,
        setBudgetAlertsEnabled,
        billReminderLeadDays,
        setBillReminderLeadDays,
        userId,
        user,
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
        settlementNotificationsEnabled,
        setSettlementNotificationsEnabled,
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
    const { rules: categorizationRules, loading: loadingRules, setRules: setCategorizationRules } = useCategorizationRules(userId);
    const { templates: recurringTemplates, loading: loadingTemplates, deleteTemplate } = useRecurringTemplates(userId);
    const dataExport = useDataExport();

    const { failedItems } = useSyncQueueState();

    const [showAlert, setShowAlert] = useState(false);

    // Honor a URL hash like `#notifications` so deep links can open a specific
    // section. Computed once on mount; users can still collapse/expand after.
    const [defaultOpenSections] = useState<string[]>(() => {
        if (typeof window === 'undefined') return [];
        const hash = window.location.hash.replace('#', '').trim();
        const valid = ['recurring', 'data', 'notifications', 'locale', 'quick-add', 'dashboard-layout', 'general', 'security'];
        return hash && valid.includes(hash) ? [hash] : [];
    });

    const userEmail = user?.email ?? '';
    const hasPassword = !!user?.identities?.some((i) => i.provider === 'email');
    const hasGoogleIdentity = !!user?.identities?.some((i) => i.provider === 'google');

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
            <div className="p-5 space-y-6 max-w-md lg:max-w-4xl mx-auto relative">
                <SettingsHeader />

                <ProfileSection
                    showBudgetAlert={showAlert}
                    onDismissBudgetAlert={() => setShowAlert(false)}
                />

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
                                onDelete={deleteTemplate}
                            />
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="accounts" className="border-b-0 px-3">
                        <AccordionTrigger className="text-sm font-semibold text-muted-foreground hover:no-underline">
                            <div className="flex items-center gap-2">
                                <Wallet className="w-4 h-4" />
                                <span>Accounts</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                            <AccountsSection
                                defaultCurrency={currency}
                                formatCurrency={formatCurrency}
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
                                setRules={setCategorizationRules}
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
                                loading={dataExport.loadingExport}
                                onImport={() => router.push('/import')}
                                onExportCSV={() => dataExport.handleExportClick('csv')}
                                onExportPDF={() => dataExport.handleExportClick('pdf')}
                                onExportICS={dataExport.handleExportICS}
                                icsLoading={dataExport.loadingIcs}
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
                                settlementNotificationsEnabled={settlementNotificationsEnabled}
                                setSettlementNotificationsEnabled={setSettlementNotificationsEnabled}
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
                                onPasswordChangeSuccess={() => {
                                    supabase.auth.refreshSession().catch((err) => {
                                        console.warn('Failed to refresh session after password change:', err);
                                    });
                                }}
                            />
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>

                <FailedSyncSection failedItems={failedItems} />

                <SettingsAppFooter onSignOut={handleSignOut} />

                <ExportDateRangeModal
                    isOpen={dataExport.exportModalOpen}
                    onOpenChange={dataExport.setExportModalOpen}
                    onExport={dataExport.handleExportConfirm}
                    loading={dataExport.loadingExport}
                    title={dataExport.exportType === 'csv' ? 'Export CSV' : 'Export PDF'}
                />
            </div>
        </motion.div>
    );
}
