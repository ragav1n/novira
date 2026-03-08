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
}

const buttonVariants = {
    initial: {
        gap: 0,
        paddingLeft: "0.35rem",
        paddingRight: "0.35rem",
    },
    animate: ({ isSelected, hasSelected }: { isSelected: boolean; hasSelected: boolean }) => ({
        gap: isSelected ? "0.5rem" : 0,
        paddingLeft: isSelected ? "0.85rem" : hasSelected ? "0.2rem" : "0.35rem",
        paddingRight: isSelected ? "0.85rem" : hasSelected ? "0.2rem" : "0.35rem",
    }),
};

const spanVariants = {
    initial: { width: 0, opacity: 0 },
    animate: { width: "auto", opacity: 1 },
    exit: { width: 0, opacity: 0 },
};

const transition = { delay: 0.1, type: "spring", bounce: 0, duration: 0.6 };

export function ExpandableTabs({
    tabs,
    className,
    activeColor = "text-primary",
    onChange,
}: ExpandableTabsProps) {
    const [selected, setSelected] = React.useState<number | null>(null);
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
    }, [selected]);

    const handleSelect = (index: number) => {
        setSelected(index);
        onChange?.(index);
    };

    const Separator = () => (
        <div className="mx-0.5 h-[20px] w-[1px] bg-border/50" aria-hidden="true" />
    );

    return (
        <div
            ref={outsideClickRef}
            className={cn(
                "flex flex-nowrap items-center gap-1 sm:gap-2 rounded-2xl border bg-background p-1 shadow-sm overflow-x-auto no-scrollbar",
                className
            )}
        >
            {tabs.map((tab, index) => {
                if (tab.type === "separator") {
                    return <Separator key={`separator-${index}`} />;
                }

                const Icon = tab.icon;
                return (
                    <motion.button
                        key={tab.title}
                        ref={(el) => {
                            tabRefs.current[index] = el as HTMLButtonElement | null;
                        }}
                        variants={buttonVariants}
                        initial="initial"
                        animate="animate"
                        custom={{ isSelected: selected === index, hasSelected: selected !== null }}
                        onClick={() => handleSelect(index)}
                        transition={transition}
                        className={cn(
                            "relative flex items-center rounded-xl py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-colors duration-300 shrink-0",
                            selected === index
                                ? cn("bg-muted", activeColor)
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                    >
                        <Icon size={18} />
                        <AnimatePresence initial={false}>
                            {selected === index && (
                                <motion.span
                                    variants={spanVariants}
                                    initial="initial"
                                    animate="animate"
                                    exit="exit"
                                    transition={transition}
                                    className="overflow-hidden"
                                >
                                    {tab.title}
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </motion.button>
                );
            })}
        </div>
    );
}
