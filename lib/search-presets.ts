export type SearchFilterSnapshot = {
    q?: string;
    categories?: string[];
    payments?: string[];
    from?: string;
    to?: string;
    min?: number;
    max?: number;
    bucket?: string | null;
    tags?: string[];
    sort?: string;
    recurring?: boolean;
    excluded?: boolean;
};

export type SearchPreset = {
    id: string;
    name: string;
    createdAt: number;
    filters: SearchFilterSnapshot;
};

const MAX_PRESETS = 10;

const storageKey = (userId: string) => `novira:search-presets:${userId}`;

function safeRead(userId: string): SearchPreset[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(storageKey(userId));
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error('Failed to read search presets:', error);
        return [];
    }
}

function safeWrite(userId: string, presets: SearchPreset[]): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(storageKey(userId), JSON.stringify(presets));
    } catch (error) {
        console.error('Failed to write search presets:', error);
    }
}

export function loadPresets(userId: string): SearchPreset[] {
    return safeRead(userId).sort((a, b) => b.createdAt - a.createdAt);
}

export function savePreset(userId: string, name: string, filters: SearchFilterSnapshot): SearchPreset {
    const preset: SearchPreset = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: name.trim(),
        createdAt: Date.now(),
        filters,
    };
    const existing = safeRead(userId);
    const next = [preset, ...existing].slice(0, MAX_PRESETS);
    safeWrite(userId, next);
    return preset;
}

export function deletePreset(userId: string, id: string): void {
    const existing = safeRead(userId);
    safeWrite(userId, existing.filter(p => p.id !== id));
}
