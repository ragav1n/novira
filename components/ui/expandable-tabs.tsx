"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useOnClickOutside } from "usehooks-ts";
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

interface ExpandableTabsProps {
    tabs: TabItem[];
    className?: string;
    activeColor?: string;
    onChange?: (index: number | null) => void;
    activeIndex?: number | null;
}

// Horizontal padding floors at 0.6rem. Combined with the 18px icon and the
// min-w-[44px] on the button this keeps every tab at a usable target — the old
// 0.2rem/0.35rem values collapsed unselected tabs to roughly 24-29px wide.
const buttonVariants = {
    initial: {
        gap: 0,
        paddingLeft: "0.6rem",
        paddingRight: "0.6rem",
    },
    animate: ({ isSelected }: { isSelected: boolean; hasSelected: boolean }) => ({
        gap: isSelected ? "0.5rem" : 0,
        paddingLeft: isSelected ? "0.85rem" : "0.6rem",
        paddingRight: isSelected ? "0.85rem" : "0.6rem",
    }),
};

const spanVariants = {
    initial: { width: 0, opacity: 0 },
    animate: { width: "auto", opacity: 1 },
    exit: { width: 0, opacity: 0 },
};

const transition = { type: "spring", bounce: 0, duration: 0.3 };

export function ExpandableTabs({
    tabs,
    className,
    activeColor = "text-primary",
    onChange,
    activeIndex = null,
}: ExpandableTabsProps) {
    const [selected, setSelected] = React.useState<number | null>(null);
    // Bumped on every tap so re-tapping the already-selected tab still
    // refreshes the 5s auto-collapse timer (setSelected(same) is a no-op).
    const [selectionTick, setSelectionTick] = React.useState(0);
    const outsideClickRef = React.useRef<HTMLDivElement>(null);
    const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

    useOnClickOutside(outsideClickRef as any, () => {
        setSelected(null);
        onChange?.(null);
    });

    React.useEffect(() => {
        if (selected !== null) {
            const timer = setTimeout(() => {
                setSelected(null);
            }, 5000); // Auto-collapse after 5 seconds

            // Scroll the selected tab into view so it's not hidden off-screen
            const tab = tabRefs.current[selected];
            if (tab) {
                setTimeout(() => {
                    tab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
                }, 150); // slight delay to let the layout shift start
            }

            return () => clearTimeout(timer);
        }
    }, [selected, selectionTick]);

    const handleSelect = (index: number) => {
        setSelected(index);
        setSelectionTick((n) => n + 1);
        onChange?.(index);
    };

    const Separator = () => (
        <div className="mx-0.5 h-[20px] w-[1px] bg-border/50" aria-hidden="true" />
    );

    return (
        <nav
            ref={outsideClickRef}
            aria-label="Main"
            className={cn(
                // min-h pins the row height so width/padding animations on children
                // can't reflow vertically when the row overflows horizontally.
                "flex flex-nowrap items-center gap-1 sm:gap-2 rounded-2xl border bg-background p-1 shadow-sm overflow-x-auto no-scrollbar min-h-[44px] sm:min-h-[48px]",
                className
            )}
        >
            {tabs.map((tab, index) => {
                if (tab.type === "separator") {
                    return <Separator key={`separator-${index}`} />;
                }

                const Icon = tab.icon;
                const isActiveRoute = activeIndex === index;
                const isHighlighted = selected === index || isActiveRoute;
                return (
                    <motion.button
                        key={tab.title}
                        ref={(el) => {
                            tabRefs.current[index] = el as HTMLButtonElement | null;
                        }}
                        variants={buttonVariants}
                        initial="initial"
                        animate="animate"
                        // Matches the label-visibility condition below so the padding
                        // expands for whichever tab is actually showing its name.
                        custom={{ isSelected: selected === index || isActiveRoute, hasSelected: selected !== null }}
                        onClick={() => handleSelect(index)}
                        transition={transition}
                        aria-current={isActiveRoute ? 'page' : undefined}
                        // The visible label only renders for the transiently-selected
                        // tab, so without this every tab announced as just "button".
                        aria-label={tab.title}
                        title={tab.title}
                        className={cn(
                            "relative flex items-center justify-center rounded-xl min-h-[40px] min-w-[44px] py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-colors duration-300 shrink-0",
                            isHighlighted
                                ? cn("bg-muted", activeColor)
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                    >
                        <Icon size={18} aria-hidden="true" />
                        <AnimatePresence initial={false}>
                            {/* Show the label for the tab you're actually on, not only
                                the one you just tapped — `selected` is transient tap
                                state that clears after 5s, which left the routed tab
                                as an unlabelled glyph. */}
                            {(selected === index || isActiveRoute) && (
                                <motion.span
                                    variants={spanVariants}
                                    initial="initial"
                                    animate="animate"
                                    exit="exit"
                                    transition={transition}
                                    className="overflow-hidden whitespace-nowrap"
                                >
                                    {tab.title}
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </motion.button>
                );
            })}
        </nav>
    );
}
