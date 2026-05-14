export interface Trip {
    id: string;
    user_id: string;
    group_id?: string | null;
    name: string;
    slug: string;
    start_date: string;
    end_date: string;
    home_currency: string | null;
    base_location: string | null;
    auto_tag_enabled: boolean;
    created_at?: string;
}

export type TripInput = {
    name: string;
    start_date: string;
    end_date: string;
    home_currency?: string | null;
    base_location?: string | null;
    auto_tag_enabled?: boolean;
};

export function tripSlug(name: string): string {
    return name
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/^-+|-+$/g, '')
        .slice(0, 32);
}
