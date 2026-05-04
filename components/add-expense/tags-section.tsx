import React, { useMemo, useState } from 'react';
import { Hash, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TagsSectionProps {
    tags: string[];
    setTags: (tags: string[]) => void;
    knownTags: string[];
}

const MAX_TAGS = 12;
const MAX_LEN = 32;

function normalize(input: string) {
    return input.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, MAX_LEN);
}

export function TagsSection({ tags, setTags, knownTags }: TagsSectionProps) {
    const [draft, setDraft] = useState('');
    const [focused, setFocused] = useState(false);

    const suggestions = useMemo(() => {
        const taken = new Set(tags);
        const q = draft.trim().toLowerCase();
        const pool = knownTags.filter(t => !taken.has(t));
        if (!q) return pool.slice(0, 6);
        return pool.filter(t => t.includes(q)).slice(0, 8);
    }, [knownTags, tags, draft]);

    const addTag = (raw: string) => {
        const t = normalize(raw);
        if (!t) return;
        if (tags.includes(t)) return;
        if (tags.length >= MAX_TAGS) return;
        setTags([...tags, t]);
        setDraft('');
    };

    const removeTag = (t: string) => setTags(tags.filter(x => x !== t));

    return (
        <div className="space-y-2">
            <label htmlFor="expense-tags" className="text-sm font-medium flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
                Tags <span className="text-xs text-muted-foreground font-normal">(Optional)</span>
            </label>

            <div className={cn(
                "flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-secondary/10 border min-h-[44px] transition-colors",
                focused ? "border-primary/40" : "border-white/10"
            )}>
                {tags.map(t => (
                    <span
                        key={t}
                        className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-primary/15 border border-primary/25 text-primary text-[11px] font-semibold"
                    >
                        <span>#{t}</span>
                        <button
                            type="button"
                            onClick={() => removeTag(t)}
                            className="rounded-full hover:bg-primary/20 p-0.5 transition-colors"
                            aria-label={`Remove tag ${t}`}
                        >
                            <X className="w-3 h-3" aria-hidden="true" />
                        </button>
                    </span>
                ))}

                <input
                    id="expense-tags"
                    name="expense-tags"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => {
                        setFocused(false);
                        if (draft) addTag(draft);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
                            if (draft.trim()) {
                                e.preventDefault();
                                addTag(draft);
                            }
                        } else if (e.key === 'Backspace' && !draft && tags.length) {
                            removeTag(tags[tags.length - 1]);
                        }
                    }}
                    placeholder={tags.length ? '' : 'Add tags…'}
                    maxLength={MAX_LEN}
                    className="flex-1 min-w-[80px] bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 px-1"
                    disabled={tags.length >= MAX_TAGS}
                />
            </div>

            {focused && suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {suggestions.map(t => (
                        <button
                            type="button"
                            key={t}
                            onMouseDown={(e) => { e.preventDefault(); addTag(t); }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary/30 hover:bg-primary/15 border border-white/5 text-[11px] font-semibold text-muted-foreground hover:text-primary transition-colors"
                        >
                            <Plus className="w-3 h-3" aria-hidden="true" />
                            <span>#{t}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
