'use client';

import { Bell, BellRing, CalendarClock, Moon, Newspaper, RefreshCcw, Sparkles, TrendingUp } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/utils/haptics';
import type { usePushNotifications } from '@/hooks/usePushNotifications';

type PushState = ReturnType<typeof usePushNotifications>;

interface Props {
    push: PushState;
    digestFrequency: 'off' | 'daily' | 'weekly';
    setDigestFrequency: (freq: 'off' | 'daily' | 'weekly') => Promise<void> | void;
    billReminderLeadDays: number | null;
    setBillReminderLeadDays: (days: number | null) => void;
    bucketDeadlineAlerts: boolean;
    setBucketDeadlineAlerts: (enabled: boolean) => Promise<void> | void;
    spendingPaceAlerts: boolean;
    setSpendingPaceAlerts: (enabled: boolean) => Promise<void> | void;
    quietHoursStart: number | null;
    quietHoursEnd: number | null;
    setQuietHours: (start: number | null, end: number | null) => Promise<void> | void;
    smartDigestsEnabled: boolean;
    setSmartDigestsEnabled: (enabled: boolean) => Promise<void> | void;
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i);
const formatHour = (h: number) => {
    const period = h < 12 ? 'AM' : 'PM';
    const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${display}:00 ${period}`;
};

export function NotificationsSection({
    push,
    digestFrequency,
    setDigestFrequency,
    billReminderLeadDays,
    setBillReminderLeadDays,
    bucketDeadlineAlerts,
    setBucketDeadlineAlerts,
    spendingPaceAlerts,
    setSpendingPaceAlerts,
    quietHoursStart,
    quietHoursEnd,
    setQuietHours,
    smartDigestsEnabled,
    setSmartDigestsEnabled,
}: Props) {
    const quietEnabled = quietHoursStart != null && quietHoursEnd != null;

    const onQuietToggle = (enabled: boolean) => {
        if (enabled) {
            // Sensible defaults: 10pm → 7am
            setQuietHours(22, 7);
        } else {
            setQuietHours(null, null);
        }
    };

    return (
        <div className="bg-secondary/5 rounded-xl border border-white/5 divide-y divide-white/5">
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
                <>
                    <div className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <Sparkles className="w-4 h-4 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                                <p className="text-sm font-medium">Smart Digests</p>
                                <p className="text-[11px] text-muted-foreground">
                                    Morning, midday and evening check-ins
                                </p>
                            </div>
                        </div>
                        <Switch
                            checked={smartDigestsEnabled}
                            onCheckedChange={(checked) => setSmartDigestsEnabled(checked)}
                        />
                    </div>

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

                    <div className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <CalendarClock className="w-4 h-4 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                                <p className="text-sm font-medium">Bucket Deadlines</p>
                                <p className="text-[11px] text-muted-foreground">
                                    Alert when a bucket end date is approaching
                                </p>
                            </div>
                        </div>
                        <Switch
                            checked={bucketDeadlineAlerts}
                            onCheckedChange={(checked) => setBucketDeadlineAlerts(checked)}
                        />
                    </div>

                    <div className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <TrendingUp className="w-4 h-4 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                                <p className="text-sm font-medium">Spending Pace</p>
                                <p className="text-[11px] text-muted-foreground">
                                    Mid-month projection if you&apos;re trending over budget
                                </p>
                            </div>
                        </div>
                        <Switch
                            checked={spendingPaceAlerts}
                            onCheckedChange={(checked) => setSpendingPaceAlerts(checked)}
                        />
                    </div>

                    <div className="flex flex-col gap-3 p-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                                <Moon className="w-4 h-4 text-muted-foreground shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-sm font-medium">Quiet Hours</p>
                                    <p className="text-[11px] text-muted-foreground">
                                        Mute notifications during a window
                                    </p>
                                </div>
                            </div>
                            <Switch
                                checked={quietEnabled}
                                onCheckedChange={onQuietToggle}
                            />
                        </div>

                        {quietEnabled && (
                            <div className="flex items-center gap-2 pl-7">
                                <Select
                                    value={String(quietHoursStart)}
                                    onValueChange={(val) => setQuietHours(Number(val), quietHoursEnd)}
                                >
                                    <SelectTrigger className="flex-1 h-9 rounded-xl bg-secondary/20 border-white/10 text-xs font-bold">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {HOUR_OPTIONS.map((h) => (
                                            <SelectItem key={h} value={String(h)}>{formatHour(h)}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <span className="text-[11px] text-muted-foreground">to</span>
                                <Select
                                    value={String(quietHoursEnd)}
                                    onValueChange={(val) => setQuietHours(quietHoursStart, Number(val))}
                                >
                                    <SelectTrigger className="flex-1 h-9 rounded-xl bg-secondary/20 border-white/10 text-xs font-bold">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {HOUR_OPTIONS.map((h) => (
                                            <SelectItem key={h} value={String(h)}>{formatHour(h)}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>
                </>
            )}

            {!push.isSupported && (
                <div className="flex items-center gap-3 p-3">
                    <BellRing className="w-4 h-4 text-muted-foreground shrink-0" />
                    <p className="text-[11px] text-muted-foreground">
                        Push notifications aren&apos;t supported in this browser.
                    </p>
                </div>
            )}
        </div>
    );
}
