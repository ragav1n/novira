'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ViewHeaderProps {
    /** Rendered as the page's single <h1>. */
    title: React.ReactNode;
    /**
     * Back affordance. Omit for a title-only header; pass `true` for the default
     * `router.back()`, or a function for custom navigation.
     */
    onBack?: boolean | (() => void);
    /** Trailing actions, right-aligned. Already inside a `z-10` flex row. */
    right?: React.ReactNode;
    /** Extra classes on the header row. */
    className?: string;
}

/**
 * The standard top bar for a view: optional back button on the left, centered
 * title, optional actions on the right.
 *
 * Five views (search, subscriptions, goals, calendar, groups) each carried a
 * byte-identical copy of this markup, and they disagreed on two things that
 * matter: three used `<h2>` and two used `<h1>` for the same visual role, and
 * the back button existed in six variants across the app — four of which
 * (analytics `p-1.5`, search / calendar / subscriptions `p-2`) produced a tap
 * target well under 44px. The title is centered by absolute positioning with
 * `pointer-events-none` so it stays optically centered regardless of how wide
 * the leading and trailing slots are, without stealing taps from them.
 *
 * The back button uses the filled `bg-secondary/30` chip rather than the
 * transparent-until-hover variant the list views used: on touch there is no
 * hover state, so a transparent affordance never resolves into a button.
 */
export function ViewHeader({ title, onBack, right, className }: ViewHeaderProps) {
    const router = useRouter();
    const handleBack = typeof onBack === 'function' ? onBack : () => router.back();

    return (
        <div className={cn('relative flex items-center gap-3 min-h-[40px]', className)}>
            {onBack && (
                <button
                    onClick={handleBack}
                    aria-label="Go back"
                    className="min-h-[44px] min-w-[44px] -ml-2 inline-flex items-center justify-center rounded-full bg-secondary/30 hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors shrink-0 z-10"
                >
                    <ChevronLeft className="w-5 h-5" aria-hidden="true" />
                </button>
            )}

            {/* The h1 is the centring container; `truncate` lives on the inner span.
                On a flex container `text-overflow` has nothing to apply to — the text
                becomes an anonymous flex item — so putting it here hard-clipped long
                titles (trip names) mid-character instead of ellipsising. `min-w-0`
                lets the span shrink below its min-content width, which is what
                actually enables the ellipsis. */}
            <h1 className="absolute inset-0 flex items-center justify-center pointer-events-none px-12">
                <span className="min-w-0 truncate text-lg font-semibold tracking-tight">
                    {title}
                </span>
            </h1>

            {right && (
                <div className="flex items-center gap-1.5 ml-auto z-10">
                    {right}
                </div>
            )}
        </div>
    );
}
