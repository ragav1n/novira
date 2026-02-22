"use client"

import * as React from "react"
import { motion, AnimatePresence, MotionConfig } from "framer-motion"
import { ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { useUserPreferences } from "@/components/providers/user-preferences-provider"

// Custom hook for click outside detection
function useClickAway(ref: React.RefObject<HTMLElement>, handler: (event: MouseEvent | TouchEvent) => void) {
    React.useEffect(() => {
        const listener = (event: MouseEvent | TouchEvent) => {
            if (!ref.current || ref.current.contains(event.target as Node)) {
                return
            }
            handler(event)
        }

        document.addEventListener("mousedown", listener)
        document.addEventListener("touchstart", listener)

        return () => {
            document.removeEventListener("mousedown", listener)
            document.removeEventListener("touchstart", listener)
        }
    }, [ref, handler])
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
}

export function CurrencyDropdown({ value, onValueChange, className }: CurrencyDropdownProps) {
    const [isOpen, setIsOpen] = React.useState(false)
    const [hoveredCode, setHoveredCode] = React.useState<string | null>(null)
    const dropdownRef = React.useRef<HTMLDivElement>(null)
    const { CURRENCY_DETAILS } = useUserPreferences()

    useClickAway(dropdownRef as React.RefObject<HTMLElement>, () => setIsOpen(false))

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
            setIsOpen(false)
        }
    }

    const handleSelect = (code: string) => {
        onValueChange(code);
        setIsOpen(false);
    }

    const currentDetail = CURRENCY_DETAILS[value as keyof typeof CURRENCY_DETAILS] || { symbol: '$', name: value };

    return (
        <MotionConfig reducedMotion="user">
            <div
                className={cn("w-full relative", className)}
                ref={dropdownRef}
            >
                <button
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
                        "h-11 px-4 rounded-xl",
                        isOpen && "bg-secondary/20",
                    )}
                    aria-expanded={isOpen}
                    aria-haspopup="true"
                    type="button"
                >
                    <div className="flex items-center gap-2">
                        <span className="text-primary font-bold w-12 text-left">{currentDetail.symbol}</span>
                        <span className="text-sm font-semibold w-12 text-left">{value}</span>
                        <span className="text-xs text-muted-foreground ml-2 truncate">{currentDetail.name}</span>
                    </div>
                    <motion.div
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-center justify-center w-5 h-5 ml-2"
                    >
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </motion.div>
                </button>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: -10, height: 0 }}
                            animate={{
                                opacity: 1,
                                y: 0,
                                height: "auto",
                                transition: {
                                    duration: 0.5,
                                    ease: [0.32, 0.725, 0.32, 1],
                                },
                            }}
                            exit={{
                                opacity: 0,
                                y: -10,
                                height: 0,
                                transition: {
                                    duration: 0.4,
                                    ease: [0.32, 0.725, 0.32, 1],
                                },
                            }}
                            className="absolute left-0 right-0 top-full mt-2 z-50 overflow-hidden"
                            onKeyDown={handleKeyDown}
                        >
                            <motion.div
                                className="w-full rounded-xl border border-white/10 bg-card p-1 shadow-xl shadow-black/50 backdrop-blur-xl overflow-y-auto max-h-[300px] scrollbar-hide"
                                initial={{ borderRadius: 12 }}
                                animate={{
                                    borderRadius: 16,
                                    transition: { duration: 0.2 },
                                }}
                                style={{ transformOrigin: "top" }}
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
                                                "focus:outline-none focus:bg-primary/20",
                                                value === code || hoveredCode === code
                                                    ? "text-neutral-200"
                                                    : "text-neutral-400",
                                            )}
                                            whileTap={{ scale: 0.98 }}
                                            variants={itemVariants}
                                            type="button"
                                        >
                                            {/* Highlight Background */}
                                            {(value === code || hoveredCode === code) && (
                                                <motion.div
                                                    layoutId="currency-highlight"
                                                    className="absolute inset-0 bg-primary/20 rounded-lg -z-0"
                                                    transition={{
                                                        type: "spring",
                                                        bounce: 0.15,
                                                        duration: 0.5,
                                                    }}
                                                />
                                            )}

                                            <div className="relative z-10 flex items-center w-full gap-2">
                                                <span className="text-primary font-bold w-12 text-left">{detail.symbol}</span>
                                                <span className="text-sm font-semibold w-12 text-left">{code}</span>
                                                <span className="text-xs text-muted-foreground ml-2 truncate">{detail.name}</span>
                                                {value === code && (
                                                    <Check className="w-4 h-4 text-primary ml-auto" />
                                                )}
                                            </div>
                                        </motion.button>
                                    ))}
                                </motion.div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </MotionConfig>
    )
}
