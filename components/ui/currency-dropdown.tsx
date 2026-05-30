"use client"

import * as React from "react"
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { useUserPreferences } from "@/components/providers/user-preferences-provider"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
} from "@/components/ui/material-ui-dropdown-menu"

interface CurrencyDropdownProps {
    value: string;
    onValueChange: (value: string) => void;
    className?: string;
    compact?: boolean;
}

// Currency picker rebuilt on the Material dropdown — ripple rows + cinematic
// sweep, while keeping the same controlled value/onValueChange/compact API so
// every call site is untouched. The field button uses the raw Radix trigger so
// its justify-between layout (value left, chevron right) is preserved.
export function CurrencyDropdown({ value, onValueChange, className, compact = false }: CurrencyDropdownProps) {
    const { CURRENCY_DETAILS } = useUserPreferences()
    const currentDetail = CURRENCY_DETAILS[value as keyof typeof CURRENCY_DETAILS] || { symbol: '$', name: value };

    return (
        <DropdownMenu>
            <DropdownMenuPrimitive.Trigger asChild>
                <button
                    type="button"
                    aria-label="Select currency"
                    className={cn(
                        "group w-full flex items-center justify-between bg-secondary/10 text-foreground",
                        "hover:bg-secondary/20 data-[state=open]:bg-secondary/20",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                        "transition-all duration-200 ease-in-out",
                        "border border-white/10 data-[state=open]:border-primary/50",
                        "h-11 px-3 rounded-xl",
                        className,
                    )}
                >
                    <span className="flex items-center gap-1.5 min-w-0 pr-1 truncate">
                        <span className="text-primary font-bold text-left shrink-0">{currentDetail.symbol}</span>
                        <span className="text-sm font-semibold truncate text-left shrink-0 px-1">{value}</span>
                        {!compact && (
                            <span className="text-secondary-foreground text-xs truncate ml-1">{currentDetail.name}</span>
                        )}
                    </span>
                    <ChevronDown className="w-4 h-4 ml-1 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </button>
            </DropdownMenuPrimitive.Trigger>

            <DropdownMenuContent
                align="end"
                side="bottom"
                sideOffset={8}
                // Always open downward; cap to 320px or the space below the trigger
                // (whichever is smaller) and scroll, rather than flipping above the field.
                avoidCollisions={false}
                className={cn(
                    "max-h-[min(320px,var(--radix-dropdown-menu-content-available-height))] overflow-y-auto scrollbar-hide rounded-2xl bg-[#0B0B12]/95 border-white/10 p-1",
                    compact ? "min-w-[200px]" : "min-w-[var(--radix-dropdown-menu-trigger-width)]",
                )}
            >
                {Object.entries(CURRENCY_DETAILS).map(([code, detail]) => {
                    const isActive = value === code;
                    return (
                        <DropdownMenuItem
                            key={code}
                            delayDuration={0}
                            onSelect={() => onValueChange(code)}
                            className={cn(
                                "rounded-lg cursor-pointer min-h-[40px]",
                                isActive ? "bg-primary/20 text-neutral-100" : "text-neutral-300",
                            )}
                        >
                            <span className="text-primary font-bold w-6 text-center shrink-0">{detail.symbol}</span>
                            <span className="text-sm font-semibold w-8 text-left shrink-0">{code}</span>
                            {!compact && (
                                <span className="text-sm text-neutral-400 truncate flex-1 text-left">{detail.name}</span>
                            )}
                            {isActive && <Check className="w-4 h-4 text-primary ml-auto shrink-0" />}
                        </DropdownMenuItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
