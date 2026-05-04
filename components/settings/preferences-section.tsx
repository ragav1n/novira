'use client';

import { AlertTriangle, Banknote, Bell, EyeOff, Newspaper, RefreshCcw, SlidersHorizontal } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { CurrencyDropdown } from '@/components/ui/currency-dropdown';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/utils/haptics';
import type { Currency } from '@/components/providers/user-preferences-provider';
import type { usePushNotifications } from '@/hooks/usePushNotifications';

type PushState = ReturnType<typeof usePushNotifications>;

interface Props {
    currency: Currency;
    setCurrency: (val: Currency) => void;
    budgetAlertsEnabled: boolean;
    onToggleBudgetAlerts: (enabled: boolean) => void;
    billReminderLeadDays: number | null;
    setBillReminderLeadDays: (days: number | null) => void;
    push: PushState;
    privacyMode: boolean;
    setPrivacyMode: (enabled: boolean) => void;
    digestFrequency: 'off' | 'daily' | 'weekly';
    setDigestFrequency: (freq: 'off' | 'daily' | 'weekly') => Promise<void> | void;
}

export function PreferencesSection({
    currency,
    setCurrency,
    budgetAlertsEnabled,
    onToggleBudgetAlerts,
    billReminderLeadDays,
    setBillReminderLeadDays,
    push,
    privacyMode,
    setPrivacyMode,
    digestFrequency,
    setDigestFrequency,
}: Props) {
    return (
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
                            <p className="text-[11px] text-muted-foreground">Select your preferred currency</p>
                        </div>
                    </div>
                    <div className="mt-1">
                        <CurrencyDropdown value={currency} onValueChange={(val) => setCurrency(val as Currency)} />
                    </div>
                </div>

                <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                        <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                        <div>
                            <p className="text-sm font-medium">Budget Alerts</p>
                            <p className="text-[11px] text-muted-foreground">Alert when overspending</p>
                        </div>
                    </div>
                    <Switch
                        checked={budgetAlertsEnabled}
                        onCheckedChange={onToggleBudgetAlerts}
                    />
                </div>

                <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <EyeOff className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                            <p className="text-sm font-medium">Privacy Mode</p>
                            <p className="text-[11px] text-muted-foreground">Hide amounts; tap eye in header to reveal</p>
                        </div>
                    </div>
                    <Switch
                        checked={privacyMode}
                        onCheckedChange={setPrivacyMode}
                    />
                </div>

                {push.isSupported && (
                    <div className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <Bell className="w-4 h-4 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                                <p className="text-sm font-medium">Push Notifications</p>
                                <p className="text-[11px] text-muted-foreground">
                                    {push.permission === 'denied'
                                        ? 'Blocked — enable in your browser settings'
                                        : 'Reminders, sync alerts and updates'}
                                </p>
                            </div>
                        </div>
                        <Switch
                            checked={push.isSubscribed}
                            disabled={push.loading || push.permission === 'denied'}
                            onCheckedChange={async (checked) => {
                                if (checked) {
                                    const ok = await push.subscribe();
                                    if (ok) toast.success('Notifications enabled');
                                    else if (push.permission === 'denied') toast.error('Permission denied — enable in browser settings');
                                    else toast.error('Could not enable notifications');
                                } else {
                                    const ok = await push.unsubscribe();
                                    if (ok) toast.success('Notifications disabled');
                                    else toast.error('Could not disable notifications');
                                }
                            }}
                        />
                    </div>
                )}

                {push.isSupported && push.isSubscribed && (
                    <div className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <Newspaper className="w-4 h-4 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                                <p className="text-sm font-medium">Spending Digest</p>
                                <p className="text-[11px] text-muted-foreground">
                                    Recap of your recent spending
                                </p>
                            </div>
                        </div>
                        <Select
                            value={digestFrequency}
                            onValueChange={(val) => setDigestFrequency(val as 'off' | 'daily' | 'weekly')}
                        >
                            <SelectTrigger className="w-[120px] h-9 rounded-xl bg-secondary/20 border-white/10 text-xs font-bold">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="off">Off</SelectItem>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {push.isSupported && push.isSubscribed && (
                    <div className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <RefreshCcw className="w-4 h-4 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                                <p className="text-sm font-medium">Bill Reminders</p>
                                <p className="text-[11px] text-muted-foreground">
                                    Notify me before recurring bills are due
                                </p>
                            </div>
                        </div>
                        <Select
                            value={billReminderLeadDays == null ? 'off' : String(billReminderLeadDays)}
                            onValueChange={(val) => {
                                const next = val === 'off' ? null : Number(val);
                                setBillReminderLeadDays(next);
                            }}
                        >
                            <SelectTrigger className="w-[120px] h-9 rounded-xl bg-secondary/20 border-white/10 text-xs font-bold">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="off">Off</SelectItem>
                                <SelectItem value="1">1 day before</SelectItem>
                                <SelectItem value="3">3 days before</SelectItem>
                                <SelectItem value="7">1 week before</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>
        </div>
    );
}
