import { useCallback, useEffect, useState } from 'react';

export type DashboardCardId =
    | 'cashflow_forecast'
    | 'upcoming_recurring'
    | 'category_donut'
    | 'transaction_list';

export type DashboardLayout = Record<DashboardCardId, boolean>;

const STORAGE_KEY = 'novira_dashboard_layout';

export const DEFAULT_DASHBOARD_LAYOUT: DashboardLayout = {
    cashflow_forecast: true,
    upcoming_recurring: true,
    category_donut: true,
    transaction_list: true,
};

function readLayout(): DashboardLayout {
    if (typeof window === 'undefined') return DEFAULT_DASHBOARD_LAYOUT;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULT_DASHBOARD_LAYOUT;
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_DASHBOARD_LAYOUT, ...parsed };
    } catch {
        return DEFAULT_DASHBOARD_LAYOUT;
    }
}

export function useDashboardLayout() {
    const [layout, setLayoutState] = useState<DashboardLayout>(DEFAULT_DASHBOARD_LAYOUT);

    useEffect(() => {
        setLayoutState(readLayout());
        const onStorage = (e: StorageEvent) => {
            if (e.key === STORAGE_KEY) setLayoutState(readLayout());
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
    }, []);

    const setCard = useCallback((id: DashboardCardId, visible: boolean) => {
        setLayoutState((prev) => {
            const next = { ...prev, [id]: visible };
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            } catch { /* ignore */ }
            return next;
        });
    }, []);

    const reset = useCallback(() => {
        setLayoutState(DEFAULT_DASHBOARD_LAYOUT);
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch { /* ignore */ }
    }, []);

    return { layout, setCard, reset };
}
