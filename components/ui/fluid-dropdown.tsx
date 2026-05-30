"use client"

import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { ChevronDown, Shirt, Briefcase, Smartphone, Home, Layers } from "lucide-react"
import { cn } from "@/lib/utils"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
} from "@/components/ui/material-ui-dropdown-menu"

// Types
export interface Category {
    id: string
    label: string
    icon: React.ElementType
    color: string
}

export const categories: Category[] = [
    { id: "all", label: "All", icon: Layers, color: "#A06CD5" },
    { id: "lifestyle", label: "Lifestyle", icon: Shirt, color: "#FF6B6B" },
    { id: "desk", label: "Desk", icon: Briefcase, color: "#4ECDC4" },
    { id: "tech", label: "Tech", icon: Smartphone, color: "#45B7D1" },
    { id: "home", label: "Home", icon: Home, color: "#F9C74F" },
]

interface FluidDropdownProps {
    items?: Category[];
    activeId?: string | null;
    onSelect?: (category: Category) => void;
    className?: string;
    triggerClassName?: string;
}

// Icon + label selector rebuilt on the Material dropdown — ripple rows +
// cinematic sweep — keeping the same items/activeId/onSelect API so the
// add-expense category selector and the dashboard workspace switcher are
// untouched. Supports controlled (activeId) and uncontrolled use.
export function FluidDropdown({ items = categories, activeId, onSelect, className, triggerClassName }: FluidDropdownProps) {
    const [selectedState, setSelectedState] = React.useState<Category>(items[0])

    const selectedCategory = React.useMemo(() => {
        if (activeId !== undefined) {
            return items.find(i => i.id === activeId) || items[0];
        }
        return selectedState;
    }, [activeId, items, selectedState]);

    const handleSelect = (category: Category) => {
        if (activeId === undefined) setSelectedState(category);
        onSelect?.(category);
    };

    const SelectedIcon = selectedCategory.icon;

    return (
        <DropdownMenu>
            <DropdownMenuPrimitive.Trigger asChild>
                <button
                    type="button"
                    aria-haspopup="menu"
                    className={cn(
                        "group w-full flex items-center justify-between bg-secondary/10 text-foreground",
                        "hover:bg-secondary/20 data-[state=open]:bg-secondary/20",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                        "transition-all duration-200 ease-in-out",
                        "border border-white/10 data-[state=open]:border-primary/50",
                        "h-14 px-4 rounded-xl text-sm font-medium",
                        className,
                        triggerClassName,
                    )}
                >
                    <span className="flex items-center min-w-0">
                        <SelectedIcon className="w-4 h-4 mr-2 shrink-0" style={{ color: selectedCategory.color }} />
                        <span className="truncate">{selectedCategory.label}</span>
                    </span>
                    <ChevronDown className="w-4 h-4 ml-1 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </button>
            </DropdownMenuPrimitive.Trigger>

            <DropdownMenuContent
                align="start"
                side="bottom"
                sideOffset={8}
                // Always open downward; if the list is taller than the space below
                // the trigger, cap to the available height and scroll instead of
                // flipping the menu above the field.
                avoidCollisions={false}
                className="rounded-xl bg-card/95 border-white/10 p-1 min-w-[var(--radix-dropdown-menu-trigger-width)] max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto scrollbar-hide"
            >
                {items.flatMap((category, index) => {
                    const Icon = category.icon;
                    const isActive = selectedCategory.id === category.id;
                    const item = (
                        <DropdownMenuItem
                            key={category.id}
                            delayDuration={0}
                            onSelect={() => handleSelect(category)}
                            className={cn(
                                "rounded-lg cursor-pointer min-h-[40px]",
                                isActive ? "bg-primary/20 text-neutral-100" : "text-neutral-300",
                            )}
                        >
                            <Icon className="w-4 h-4 shrink-0" style={{ color: category.color }} />
                            <span className="truncate flex-1 text-left">{category.label}</span>
                        </DropdownMenuItem>
                    );
                    return index === 1
                        ? [<DropdownMenuSeparator key={`sep-${category.id}`} />, item]
                        : [item];
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
