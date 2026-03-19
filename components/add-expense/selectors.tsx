import React from 'react';
import { X, Tag, Plane, Home, Gift, Car, Utensils, ShoppingCart, Heart, Gamepad2, School, Laptop, Music } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FluidDropdown, type Category } from '@/components/ui/fluid-dropdown';
import type { Bucket } from '@/components/providers/buckets-provider';

//-------------------------------------------------------------------------
// Category Selector
//-------------------------------------------------------------------------

interface CategorySelectorProps {
    categories: Category[];
    selectedCategory: string;
    onSelect: (id: string) => void;
}

export function CategorySelector({ categories, selectedCategory, onSelect }: CategorySelectorProps) {
    return (
        <div className="space-y-2">
            <p className="text-sm font-medium">Category *</p>
            <FluidDropdown
                items={categories}
                onSelect={(cat) => onSelect(cat.id)}
                className="w-full max-w-none"
            />
        </div>
    );
}

//-------------------------------------------------------------------------
// Bucket Selector
//-------------------------------------------------------------------------

interface BucketSelectorProps {
    buckets: Bucket[];
    selectedBucketId: string | null;
    setSelectedBucketId: (id: string | null) => void;
}

export function BucketSelector({ buckets, selectedBucketId, setSelectedBucketId }: BucketSelectorProps) {
    if (buckets.length === 0) return null;

    const getBucketIcon = (iconName?: string) => {
        const icons: Record<string, any> = {
            Tag, Plane, Home, Gift, Car, Utensils, ShoppingCart,
            Heart, Gamepad2, School, Laptop, Music
        };
        const Icon = icons[iconName || 'Tag'] || Tag;
        return <Icon className="w-full h-full" />;
    };

    return (
        <div className="space-y-2">
            <p className="text-sm font-medium">Personal Bucket (Private)</p>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 custom-scrollbar">
                <div
                    onClick={() => setSelectedBucketId(null)}
                    className={cn(
                        "flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all min-w-[80px] cursor-pointer",
                        selectedBucketId === null
                            ? "bg-secondary/30 border-white/20"
                            : "bg-background/20 border-white/5 hover:border-white/10"
                    )}
                >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-secondary/20 border border-white/5">
                        <X className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <span className="text-[11px] font-medium truncate w-16 text-center">None</span>
                </div>
                {buckets.filter(b => !b.is_archived).map((bucket) => (
                    <div
                        key={bucket.id}
                        onClick={() => setSelectedBucketId(bucket.id)}
                        className={cn(
                            "flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all min-w-[80px] cursor-pointer",
                            selectedBucketId === bucket.id
                                ? "bg-primary/20 border-primary shadow-[0_0_15px_rgba(138,43,226,0.2)]"
                                : "bg-background/20 border-white/5 hover:border-white/10"
                        )}
                    >
                        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-secondary/20 border border-white/5">
                            <div className="w-5 h-5 text-primary">
                                {getBucketIcon(bucket.icon)}
                            </div>
                        </div>
                        <span className="text-[11px] font-medium truncate w-16 text-center">{bucket.name}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
