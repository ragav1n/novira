import { 
    Utensils, 
    ShoppingCart, 
    Shirt, 
    Car, 
    Zap, 
    ShoppingBag, 
    HeartPulse, 
    Clapperboard, 
    Home, 
    School, 
    LayoutGrid, 
    HelpCircle,
    CircleDollarSign
} from 'lucide-react';
import React from 'react';

export const CATEGORY_COLORS: Record<string, string> = {
    food: '#9333EA',      // Deep Purple
    groceries: '#10B981', // Emerald
    fashion: '#F472B6',   // Hot Pink
    transport: '#F87171', // Red
    bills: '#06B6D4',     // Cyan
    shopping: '#FBBF24',  // Amber
    healthcare: '#F97316',// Orange
    entertainment: '#EC4899', // Pink
    rent: '#6366F1',      // Indigo
    education: '#84CC16', // Lime
    others: '#14B8A6',    // Teal
    uncategorized: '#94A3B8' // Slate
};

export const getIconForCategory = (category: string, className: string = "w-5 h-5 text-white") => {
    const iconProps = { className };
    switch (category.toLowerCase()) {
        case 'food': return React.createElement(Utensils, iconProps);
        case 'groceries': return React.createElement(ShoppingCart, iconProps);
        case 'fashion': return React.createElement(Shirt, iconProps);
        case 'transport': return React.createElement(Car, iconProps);
        case 'bills': return React.createElement(Zap, iconProps);
        case 'shopping': return React.createElement(ShoppingBag, iconProps);
        case 'healthcare': return React.createElement(HeartPulse, iconProps);
        case 'entertainment': return React.createElement(Clapperboard, iconProps);
        case 'rent': return React.createElement(Home, iconProps);
        case 'education': return React.createElement(School, iconProps);
        case 'others': return React.createElement(LayoutGrid, iconProps);
        case 'uncategorized': return React.createElement(HelpCircle, iconProps);
        default: return React.createElement(CircleDollarSign, iconProps);
    }
};

/**
 * Returns the SVG string for a category icon. 
 * Useful for non-React contexts like Mapbox HTML markers.
 */
export const getIconSvgForCategory = (category: string) => {
    switch (category.toLowerCase()) {
        case 'food': return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>';
        case 'groceries': return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>';
        case 'fashion': return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/></svg>';
        case 'transport': return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>';
        case 'bills': return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>';
        case 'shopping': return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>';
        case 'healthcare': return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/></svg>';
        case 'entertainment': return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 20v-2a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2"/><rect width="20" height="12" x="2" y="4" rx="2"/><path d="m9 8 5 3-5 3Z"/></svg>';
        case 'rent': return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>';
        case 'education': return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>';
        case 'others': return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>';
        default: return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></svg>';
    }
};
