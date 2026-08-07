"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface Tab {
    title: string;
    icon: LucideIcon;
    type?: never;
}

interface Separator {
    type: "separator";
    title?: never;
    icon?: never;
}

type TabItem = Tab | Separator;

// Module scope, not defined inside the component: an inline component is a new
// type on every render, so React unmounts and remounts it each time.
const TabSeparator = () => (
    <div className="mx-0.5 h-[20px] w-[1px] shrink-0 bg-border/50" aria-hidden="true" />
);

interface ExpandableTabsProps {
    tabs: TabItem[];
    className?: string;
    activeColor?: string;
    onChange?: (index: number | null) => void;
    activeIndex?: number | null;
}

/**
 * The floating bottom nav: nine fixed-width icon cells that never move.
 *
 * This used to animate a text label into the tapped tab, which meant springing
 * `gap`, `paddingLeft` and `paddingRight` across all nine buttons plus
 * `width: 0 -> auto` on the label — twice per tap (open, then a 5s auto-collapse)
 * — reflowing the entire row each time. It needed a `scrollIntoView` 150ms later
 * to chase the tab that had just slid out from under the user's thumb.
 *
 * The label is gone rather than merely made cheaper, because at nine tabs on a
 * 390px viewport there is no width for one: a label wide enough to read
 * ("Analytics", "Cash Flow") pushes the row ~20px past the screen edge and
 * displaces every tab beside it. Reserving a fixed slot for the longest label
 * doesn't fit either. So the row is now icon-only and distributes the full width
 * evenly — no layout animation anywhere, no `AnimatePresence`, no framer-motion
 * at all on the app's most-tapped surface. Each cell also gets ~36px instead of
 * ~30px from the reclaimed space.
 *
 * Names are still exposed: `aria-label` for assistive tech, `title` for a
 * pointer tooltip. The active route reads as a filled pill in the accent colour.
 */
export function ExpandableTabs({
    tabs,
    className,
    activeColor = "text-primary",
    onChange,
    activeIndex = null,
}: ExpandableTabsProps) {
    return (
        <nav
            aria-label="Main"
            className={cn(
                // `w-full` is load-bearing: the parent centres this with `justify-center`,
                // so without it the nav shrinks to its content and `flex-1` on the cells
                // has no free width to distribute (they collapse to the 18px icon).
                // max-w-md keeps the bar from stretching absurdly wide on tablets, where
                // the mobile nav still shows (the desktop nav is lg:).
                // min-h pins the row height; the cells flex to share the available width
                // so the row can never overflow and never needs to scroll.
                "flex w-full max-w-md flex-nowrap items-center gap-0.5 sm:gap-1.5 rounded-xl border bg-background p-1 shadow-sm min-h-[44px] sm:min-h-[48px]",
                className
            )}
        >
            {tabs.map((tab, index) => {
                if (tab.type === "separator") {
                    return <TabSeparator key={`separator-${index}`} />;
                }

                const Icon = tab.icon;
                const isActiveRoute = activeIndex === index;
                return (
                    <button
                        key={tab.title}
                        onClick={() => onChange?.(index)}
                        aria-current={isActiveRoute ? 'page' : undefined}
                        aria-label={tab.title}
                        title={tab.title}
                        className={cn(
                            // flex-1 + min-w-0 so nine cells divide the row evenly at any
                            // width; min-h-[40px] keeps the vertical target inside a 44px row.
                            "relative flex flex-1 min-w-0 items-center justify-center rounded-xl min-h-[40px] py-1.5 sm:py-2",
                            // Only colours transition — no geometry.
                            "transition-colors duration-200",
                            isActiveRoute
                                ? cn("bg-muted", activeColor)
                                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        )}
                    >
                        <Icon size={18} aria-hidden="true" />
                    </button>
                );
            })}
        </nav>
    );
}
