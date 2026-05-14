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
    CircleDollarSign,
    Sparkles
} from 'lucide-react';
import React from 'react';

/**
 * Canonical category list used across the app.
 * Import this instead of redefining category arrays in individual components.
 */
export const CATEGORIES = [
    // Daily essentials
    { id: 'food', label: 'Food' },
    { id: 'groceries', label: 'Groceries' },
    { id: 'transport', label: 'Transport' },
    // Personal
    { id: 'fashion', label: 'Fashion' },
    { id: 'beauty', label: 'Beauty' },
    { id: 'healthcare', label: 'Healthcare' },
    // Fixed costs
    { id: 'rent', label: 'Rent' },
    { id: 'bills', label: 'Bills' },
    // Discretionary
    { id: 'shopping', label: 'Shopping' },
    { id: 'entertainment', label: 'Entertainment' },
    { id: 'education', label: 'Education' },
    // Catch-all
    { id: 'others', label: 'Others' },
    { id: 'uncategorized', label: 'Uncategorized' },
] as const;


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
    beauty: '#E879F9',    // Fuchsia
    others: '#14B8A6',    // Teal
    uncategorized: '#94A3B8' // Slate
};

export const CHART_CONFIG = {
    food: { label: "Food", color: CATEGORY_COLORS.food },
    groceries: { label: "Groceries", color: CATEGORY_COLORS.groceries },
    fashion: { label: "Fashion", color: CATEGORY_COLORS.fashion },
    transport: { label: "Transport", color: CATEGORY_COLORS.transport },
    bills: { label: "Bills", color: CATEGORY_COLORS.bills },
    shopping: { label: "Shopping", color: CATEGORY_COLORS.shopping },
    healthcare: { label: "Healthcare", color: CATEGORY_COLORS.healthcare },
    entertainment: { label: "Entertainment", color: CATEGORY_COLORS.entertainment },
    rent: { label: "Rent", color: CATEGORY_COLORS.rent },
    education: { label: "Education", color: CATEGORY_COLORS.education },
    beauty: { label: "Beauty", color: CATEGORY_COLORS.beauty },
    others: { label: "Others", color: CATEGORY_COLORS.others },
    uncategorized: { label: "Uncategorized", color: CATEGORY_COLORS.uncategorized },
};


export const getIconForCategory = (category: string, className: string = "w-5 h-5 text-white", props: React.SVGAttributes<SVGSVGElement> = {}) => {
    const iconProps = { className, ...props };
    const id = category.toLowerCase();
    switch (id) {
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
        case 'beauty': return React.createElement(Sparkles, iconProps);
        case 'others': return React.createElement(LayoutGrid, iconProps);
        case 'uncategorized': return React.createElement(HelpCircle, iconProps);
        default: return React.createElement(CircleDollarSign, iconProps);
    }
};

/**
 * Returns the canonical label for a category ID.
 */
export const getCategoryLabel = (id: string) => {
    const category = CATEGORIES.find(c => c.id === id.toLowerCase());
    return category ? category.label : (id.charAt(0).toUpperCase() + id.slice(1));
};

/**
 * Automatically suggests a category based on the description text.
 */
export const autoCategorize = (description: string): string => {
    const lowerDesc = description.toLowerCase();
    
    if (lowerDesc.includes('uber') || lowerDesc.includes('taxi') || lowerDesc.includes('fuel') || lowerDesc.includes('petrol') || lowerDesc.includes('ola')) return 'transport';
    if (lowerDesc.includes('zomato') || lowerDesc.includes('swiggy') || lowerDesc.includes('restaurant') || lowerDesc.includes('cafe') || lowerDesc.includes('dining')) return 'food';
    if (lowerDesc.includes('milk') || lowerDesc.includes('curd') || lowerDesc.includes('tofu') || lowerDesc.includes('grocer') || lowerDesc.includes('supermarket') || lowerDesc.includes('mart') || lowerDesc.includes('bigbasket') || lowerDesc.includes('blinkit')) return 'groceries';
    if (lowerDesc.includes('shirt') || lowerDesc.includes('clothes') || lowerDesc.includes('fashion') || lowerDesc.includes('zara') || lowerDesc.includes('h&m') || lowerDesc.includes('apparel') || lowerDesc.includes('myntra') || lowerDesc.includes('ajio')) return 'fashion';
    if (lowerDesc.includes('netflix') || lowerDesc.includes('spotify') || lowerDesc.includes('movie') || lowerDesc.includes('cinema') || lowerDesc.includes('hotstar') || lowerDesc.includes('prime video')) return 'entertainment';
    if (lowerDesc.includes('pharmacy') || lowerDesc.includes('doctor') || lowerDesc.includes('hospital') || lowerDesc.includes('medical') || lowerDesc.includes('medicine')) return 'healthcare';
    if (lowerDesc.includes('bill') || lowerDesc.includes('electricity') || lowerDesc.includes('recharge') || lowerDesc.includes('utility') || lowerDesc.includes('gas')) return 'bills';
    if (lowerDesc.includes('rent') || lowerDesc.includes('lease') || lowerDesc.includes('landlord') || lowerDesc.includes('maintenance')) return 'rent';
    if (lowerDesc.includes('school') || lowerDesc.includes('tuition') || lowerDesc.includes('course') || lowerDesc.includes('education') || lowerDesc.includes('college') || lowerDesc.includes('university') || lowerDesc.includes('udemy') || lowerDesc.includes('coursera')) return 'education';
    if (lowerDesc.includes('skincare') || lowerDesc.includes('skin care') || lowerDesc.includes('shampoo') || lowerDesc.includes('conditioner') || lowerDesc.includes('moisturizer') || lowerDesc.includes('serum') || lowerDesc.includes('perfume') || lowerDesc.includes('lotion') || lowerDesc.includes('nykaa') || lowerDesc.includes('sephora') || lowerDesc.includes('bath') || lowerDesc.includes('body wash') || lowerDesc.includes('face wash') || lowerDesc.includes('makeup') || lowerDesc.includes('cosmetic') || lowerDesc.includes('sunscreen')) return 'beauty';
    if (lowerDesc.includes('shop') || lowerDesc.includes('amazon') || lowerDesc.includes('flipkart')) return 'shopping';
    
    return 'uncategorized';
};

/**
 * Returns the SVG string for a category icon. 
 * Useful for non-React contexts like Mapbox HTML markers.
 */
export const getIconSvgForCategory = (category: string) => {
    const id = category.toLowerCase();
    switch (id) {
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
        case 'beauty': return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>';
        case 'others': return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>';
        default: return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></svg>';
    }
};
