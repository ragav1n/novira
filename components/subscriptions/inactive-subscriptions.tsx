'use client';

import { RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { useWorkspaceTheme } from '@/hooks/useWorkspaceTheme';
import { INACTIVE_PAGE_SIZE, type Tpl } from '@/lib/subscriptions-utils';

interface Props {
    templates: Tpl[];
    showAll: boolean;
    onToggleShowAll: () => void;
    onReactivate: (id: string) => void;
    /** Id currently being toggled, so its button can disable instead of double-firing. */
    busyId?: string | null;
}

export function InactiveSubscriptions({ templates, showAll, onToggleShowAll, onReactivate, busyId = null }: Props) {
    const { formatCurrency } = useUserPreferences();
    const { theme: themeConfig } = useWorkspaceTheme();

    if (templates.length === 0) return null;

    const visible = showAll ? templates : templates.slice(0, INACTIVE_PAGE_SIZE);

    return (
        <div className="pt-6 border-t border-white/10 space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-muted-foreground">
                    Inactive Subscriptions ({templates.length})
                </h3>
                {templates.length > INACTIVE_PAGE_SIZE && (
                    <button
                        type="button"
                        onClick={onToggleShowAll}
                        className={cn("text-eyebrow uppercase", themeConfig.text)}
                    >
                        {showAll ? 'Show less' : `Show all (${templates.length})`}
                    </button>
                )}
            </div>
            {visible.map((template) => (
                <div key={template.id} className={cn("flex justify-between items-center p-3 rounded-xl bg-secondary/10 opacity-70 border border-white/5 group", themeConfig.bg)}>
                    <div className="flex items-center gap-3">
                        <RotateCw className={cn("w-4 h-4", themeConfig.text)} />
                        <span className="font-medium text-sm line-through opacity-60">{template.description}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-muted-foreground">{formatCurrency(template.amount, template.currency)} / {template.frequency}</span>
                        <button
                            type="button"
                            onClick={() => onReactivate(template.id)}
                            disabled={busyId === template.id}
                            aria-busy={busyId === template.id}
                            className={cn("text-eyebrow uppercase px-3 min-h-[44px] rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors disabled:opacity-50 disabled:pointer-events-none", themeConfig.text)}
                        >
                            {busyId === template.id ? 'Working…' : 'Re-activate'}
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}
