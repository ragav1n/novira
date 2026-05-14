'use client';

import { Search, X, ArrowUpDown, Check, Tag } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { useWorkspaceTheme } from '@/hooks/useWorkspaceTheme';
import { cn } from '@/lib/utils';
import { getCategoryLabel, getIconForCategory, CATEGORY_COLORS } from '@/lib/categories';
import { ALL_FREQUENCIES, SORT_LABELS, type Frequency, type SortBy, type BucketState } from '@/lib/subscriptions-utils';

interface Props {
    search: string;
    setSearch: (v: string) => void;
    sortBy: SortBy;
    setSortBy: (v: SortBy) => void;
    filterFrequencies: Set<Frequency>;
    onToggleFrequency: (f: Frequency) => void;
    bucketState: BucketState;
    setBucketState: (v: BucketState) => void;
    availableCategories: string[];
    filterCategories: Set<string>;
    onToggleCategory: (c: string) => void;
    hasActiveFilters: boolean;
    onClearFilters: () => void;
}

export function SubscriptionFilters({
    search, setSearch, sortBy, setSortBy,
    filterFrequencies, onToggleFrequency,
    bucketState, setBucketState,
    availableCategories, filterCategories, onToggleCategory,
    hasActiveFilters, onClearFilters,
}: Props) {
    const { theme: themeConfig } = useWorkspaceTheme();

    return (
        <div className="space-y-2">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                    <Input
                        id="subs-search"
                        name="subs-search"
                        autoComplete="off"
                        placeholder="Search subscriptions"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className={`pl-9 pr-9 bg-secondary/10 border-white/10 h-10 rounded-xl ${themeConfig.ring}`}
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => setSearch('')}
                            aria-label="Clear search"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
                <Popover>
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            className={cn(
                                "h-10 px-3 rounded-xl bg-secondary/10 border border-white/10 inline-flex items-center gap-1.5 text-xs font-bold shrink-0",
                                themeConfig.text
                            )}
                            aria-label="Sort subscriptions"
                        >
                            <ArrowUpDown className="w-3.5 h-3.5" aria-hidden="true" />
                            <span className="hidden sm:inline">{SORT_LABELS[sortBy]}</span>
                        </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-56 p-1 bg-card/95 backdrop-blur-xl border-white/10">
                        {(Object.keys(SORT_LABELS) as SortBy[]).map(opt => (
                            <button
                                key={opt}
                                type="button"
                                onClick={() => setSortBy(opt)}
                                className={cn(
                                    "w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-secondary/30 transition-colors",
                                    sortBy === opt && "bg-secondary/30"
                                )}
                            >
                                <span>{SORT_LABELS[opt]}</span>
                                {sortBy === opt && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                            </button>
                        ))}
                    </PopoverContent>
                </Popover>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                {ALL_FREQUENCIES.map(f => (
                    <button
                        key={f}
                        type="button"
                        onClick={() => onToggleFrequency(f)}
                        className={cn(
                            "shrink-0 capitalize px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors",
                            filterFrequencies.has(f)
                                ? cn(themeConfig.bgMedium, themeConfig.borderMedium, themeConfig.text)
                                : "bg-secondary/20 border-white/10 text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {f}
                    </button>
                ))}
                <span className="w-px h-4 bg-white/10 shrink-0 mx-1" aria-hidden="true" />
                {(['all', 'with', 'without'] as BucketState[]).map(opt => (
                    <button
                        key={opt}
                        type="button"
                        onClick={() => setBucketState(opt)}
                        className={cn(
                            "shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors",
                            bucketState === opt
                                ? "bg-cyan-500/15 border-cyan-500/30 text-cyan-300"
                                : "bg-secondary/20 border-white/10 text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {opt === 'all' ? 'Any bucket' : opt === 'with' ? 'With bucket' : 'No bucket'}
                    </button>
                ))}
                {availableCategories.length > 1 && (
                    <Popover>
                        <PopoverTrigger asChild>
                            <button
                                type="button"
                                className={cn(
                                    "shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors inline-flex items-center gap-1",
                                    filterCategories.size > 0
                                        ? "bg-violet-500/15 border-violet-500/30 text-violet-300"
                                        : "bg-secondary/20 border-white/10 text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <Tag className="w-2.5 h-2.5" aria-hidden="true" />
                                {filterCategories.size > 0 ? `Categories (${filterCategories.size})` : 'Category'}
                            </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-56 p-1 bg-card/95 backdrop-blur-xl border-white/10 max-h-72 overflow-y-auto">
                            {availableCategories.map(c => (
                                <button
                                    key={c}
                                    type="button"
                                    onClick={() => onToggleCategory(c)}
                                    className={cn(
                                        "w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-secondary/30 transition-colors",
                                        filterCategories.has(c) && "bg-violet-500/10 text-violet-300"
                                    )}
                                >
                                    <span className="flex items-center gap-2 min-w-0">
                                        <span className="w-3 h-3 inline-flex items-center justify-center shrink-0">
                                            {getIconForCategory(c, "w-full h-full", { style: { color: CATEGORY_COLORS[c] || CATEGORY_COLORS.others } })}
                                        </span>
                                        <span className="truncate">{getCategoryLabel(c)}</span>
                                    </span>
                                    {filterCategories.has(c) && <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
                                </button>
                            ))}
                        </PopoverContent>
                    </Popover>
                )}
                {hasActiveFilters && (
                    <button
                        type="button"
                        onClick={onClearFilters}
                        className="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold text-rose-400 hover:text-rose-300 inline-flex items-center gap-1"
                    >
                        <X className="w-2.5 h-2.5" aria-hidden="true" /> Clear
                    </button>
                )}
            </div>
        </div>
    );
}
