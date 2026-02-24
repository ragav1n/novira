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
    food: '#8A2BE2',      // Electric Purple
    groceries: '#10B981', // Emerald
    fashion: '#F472B6',   // Hot Pink
    transport: '#FF6B6B', // Coral Red
    bills: '#4ECDC4',     // Medium Aquamarine
    shopping: '#F9C74F',  // Maize Crayola
    healthcare: '#FF9F1C',// Orange State
    entertainment: '#FF1493', // Deep Pink
    rent: '#6366F1',      // Indigo
    education: '#84CC16', // Lime
    others: '#2DD4BF',    // Kelly Green / Teal
    uncategorized: '#6366F1' // Indigo
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
