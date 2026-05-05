'use client';

import { AlertTriangle, EyeOff } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface Props {
    budgetAlertsEnabled: boolean;
    onToggleBudgetAlerts: (enabled: boolean) => void;
    privacyMode: boolean;
    setPrivacyMode: (enabled: boolean) => void;
}

export function PreferencesSection({
    budgetAlertsEnabled,
    onToggleBudgetAlerts,
    privacyMode,
    setPrivacyMode,
}: Props) {
    return (
        <div className="bg-secondary/5 rounded-xl border border-white/5 divide-y divide-white/5">
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
        </div>
    );
}
