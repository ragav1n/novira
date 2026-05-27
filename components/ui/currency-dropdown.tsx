"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence, MotionConfig } from "framer-motion"
import { ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { useUserPreferences } from "@/components/providers/user-preferences-provider"

// Custom hook for click outside detection across multiple refs
function useClickAway(refs: Array<React.RefObject<HTMLElement | null>>, handler: () => void) {
    React.useEffect(() => {
        const listener = (event: PointerEvent) => {
            const target = event.target as Node
            for (const ref of refs) {
                if (ref.current && ref.current.contains(target)) return
            }
            handler()
        }

        document.addEventListener("pointerdown", listener)

        return () => {
            document.removeEventListener("pointerdown", listener)
        }
    }, [refs, handler])
}

// Animation variants
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            when: "beforeChildren",
            staggerChildren: 0.05,
        },
    },
}

const itemVariants = {
    hidden: { opacity: 0, y: -10 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.4,
            ease: [0.32, 0.725, 0.32, 1],
        },
    },
}

interface CurrencyDropdownProps {
    value: string;
    onValueChange: (value: string) => void;
    className?: string;
    compact?: boolean;
}

export function CurrencyDropdown({ value, onValueChange, className, compact = false }: CurrencyDropdownProps) {
    const [isOpen, setIsOpen] = React.useState(false)
    const [hoveredCode, setHoveredCode] = React.useState<string | null>(null)
    const [menuRect, setMenuRect] = React.useState<{ top: number; left: number; width: number } | null>(null)
    const triggerRef = React.useRef<HTMLButtonElement>(null)
    const menuRef = React.useRef<HTMLDivElement>(null)
    const { CURRENCY_DETAILS } = useUserPreferences()

    useClickAway([triggerRef, menuRef], () => setIsOpen(false))

    const updatePosition = React.useCallback(() => {
        const node = triggerRef.current
        if (!node) return
        const rect = node.getBoundingClientRect()
        const minWidth = compact ? 180 : rect.width
        const width = Math.max(rect.width, minWidth)
        // Right-align with the trigger so the menu can be wider than a narrow trigger
        const left = Math.min(rect.right - width, window.innerWidth - width - 8)
        setMenuRect({
            top: rect.bottom + 8,
            left: Math.max(8, left),
            width,
        })
    }, [compact])

    React.useEffect(() => {
        if (!isOpen) return
        updatePosition()
        const onScrollOrResize = () => updatePosition()
        window.addEventListener("scroll", onScrollOrResize, true)
        window.addEventListener("resize", onScrollOrResize)
        return () => {
            window.removeEventListener("scroll", onScrollOrResize, true)
            window.removeEventListener("resize", onScrollOrResize)
        }
    }, [isOpen, updatePosition])

    React.useEffect(() => {
        if (!isOpen) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setIsOpen(false)
        }
        document.addEventListener("keydown", onKey)
        return () => document.removeEventListener("keydown", onKey)
    }, [isOpen])

    const handleSelect = (code: string) => {
        onValueChange(code);
        setIsOpen(false);
    }

    const currentDetail = CURRENCY_DETAILS[value as keyof typeof CURRENCY_DETAILS] || { symbol: '$', name: value };
    const portalTarget = typeof window === "undefined" ? null : document.body

    return (
        <MotionConfig reducedMotion="user">
            <div className={cn("w-full relative", className)}>
                <button
                    ref={triggerRef}
                    onClick={(e) => {
                        e.preventDefault();
                        setIsOpen(!isOpen);
                    }}
                    className={cn(
                        "w-full flex items-center justify-between bg-secondary/10 text-foreground",
                        "hover:bg-secondary/20",
                        "focus:ring-2 focus:ring-primary/50 focus:ring-offset-0",
                        "transition-all duration-200 ease-in-out",
                        "border border-white/10 focus:border-primary/50",
                        "h-11 px-3 rounded-xl",
                        isOpen && "bg-secondary/20",
                    )}
                    aria-expanded={isOpen}
                    aria-haspopup="true"
                    type="button"
                >
                    <div className="flex items-center gap-1.5 min-w-0 pr-1 truncate">
                        <span className="text-primary font-bold text-left shrink-0">{currentDetail.symbol}</span>
                        <span className="text-sm font-semibold truncate text-left shrink-0 px-1">{value}</span>
                        {!compact && (
                            <span className="text-secondary-foreground text-xs truncate ml-1">{currentDetail.name}</span>
                        )}
                    </div>
                    <motion.div
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-center justify-center shrink-0 w-4 h-4 ml-1"
                    >
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </motion.div>
                </button>

                {portalTarget && createPortal(
                    <AnimatePresence>
                        {isOpen && menuRect && (
                            <motion.div
                                ref={menuRef}
                                initial={{ opacity: 0, y: -8 }}
                                animate={{
                                    opacity: 1,
                                    y: 0,
                                    transition: { duration: 0.18, ease: [0.32, 0.725, 0.32, 1] },
                                }}
                                exit={{
                                    opacity: 0,
                                    y: -8,
                                    transition: { duration: 0.15, ease: [0.32, 0.725, 0.32, 1] },
                                }}
                                style={{
                                    position: "fixed",
                                    top: menuRect.top,
                                    left: menuRect.left,
                                    width: menuRect.width,
                                    zIndex: 9999,
                                    transformOrigin: "top",
                                }}
                                className="rounded-2xl border border-white/10 bg-[#0B0B12] ring-1 ring-white/[0.04] p-1 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.85)] overflow-y-auto max-h-[320px] scrollbar-hide"
                            >
                                <motion.div
                                    className="py-1 relative"
                                    variants={containerVariants}
                                    initial="hidden"
                                    animate="visible"
                                >
                                    {Object.entries(CURRENCY_DETAILS).map(([code, detail]) => (
                                        <motion.button
                                            key={code}
                                            onClick={() => handleSelect(code)}
                                            onHoverStart={() => setHoveredCode(code)}
                                            onHoverEnd={() => setHoveredCode(null)}
                                            className={cn(
                                                "relative flex w-full items-center px-3 py-2.5 text-sm rounded-lg",
                                                "transition-colors duration-150",
                                                "focus:outline-none focus:bg-white/5",
                                                value === code
                                                    ? "bg-primary/20 text-neutral-100"
                                                    : hoveredCode === code
                                                        ? "bg-white/5 text-neutral-200"
                                                        : "text-neutral-400",
                                            )}
                                            whileTap={{ scale: 0.98 }}
                                            variants={itemVariants}
                                            type="button"
                                        >
                                            <div className="relative z-10 flex items-center w-full gap-3">
                                                <span className="text-primary font-bold w-6 text-center shrink-0">{detail.symbol}</span>
                                                <span className="text-sm font-semibold w-8 text-left shrink-0">{code}</span>
                                                {!compact && (
                                                    <span className="text-sm text-neutral-400 truncate flex-1 text-left">{detail.name}</span>
                                                )}
                                                {value === code && (
                                                    <Check className="w-4 h-4 text-primary ml-auto shrink-0" />
                                                )}
                                            </div>
                                        </motion.button>
                                    ))}
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>,
                    portalTarget,
                )}
            </div>
        </MotionConfig>
    )
}
