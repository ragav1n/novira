"use client"

import * as React from "react"
import { motion, AnimatePresence, MotionConfig } from "framer-motion"
import { ChevronDown, Shirt, Briefcase, Smartphone, Home, Layers } from "lucide-react"
import { cn } from "@/lib/utils"

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

// Button component
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "outline"
    children: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, children, ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={cn(
                    "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                    "disabled:pointer-events-none disabled:opacity-50",
                    variant === "outline" && "border border-neutral-700 bg-transparent",
                    className
                )}
                {...props}
            >
                {children}
            </button>
        )
    }
)
Button.displayName = "Button"

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

// Icon wrapper with animation
const IconWrapper = ({
    icon: Icon,
    isHovered,
    color,
}: { icon: React.ElementType; isHovered: boolean; color: string }) => (
    <motion.div
        className="w-4 h-4 mr-2 relative"
        initial={false}
        animate={isHovered ? { scale: 1.2 } : { scale: 1 }}
    >
        <Icon className="w-4 h-4" />
        {isHovered && (
            <motion.div
                className="absolute inset-0"
                style={{ color }}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
            >
                <Icon className="w-4 h-4" strokeWidth={2} />
            </motion.div>
        )}
    </motion.div>
)

// Animation variants
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            when: "beforeChildren",
            staggerChildren: 0.1,
        },
    },
}

const itemVariants = {
    hidden: { opacity: 0, y: -10 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.3,
            ease: [0.25, 0.1, 0.25, 1],
        },
    },
}

interface FluidDropdownProps {
    items?: Category[];
    onSelect?: (category: Category) => void;
    className?: string;
}

// Main component
export function FluidDropdown({ items = categories, onSelect, className }: FluidDropdownProps) {
    const [isOpen, setIsOpen] = React.useState(false)
    const [selectedCategory, setSelectedCategory] = React.useState<Category>(items[0])
    const [hoveredCategory, setHoveredCategory] = React.useState<string | null>(null)
    const dropdownRef = React.useRef<HTMLDivElement>(null)

    // Explicit typing for useClickAway handler to match hook expectation if needed, 
    // but using 'as any' in the hook call or matching types is better.
    // The hook defined above expects RefObject<HTMLElement>. HTMLDivElement inherits from HTMLElement.
    useClickAway(dropdownRef as React.RefObject<HTMLElement>, () => setIsOpen(false))

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Escape") {
            setIsOpen(false)
        }
    }

    const handleSelect = (category: Category) => {
        setSelectedCategory(category);
        setIsOpen(false);
        onSelect?.(category);
    }

    return (
        <MotionConfig reducedMotion="user">
            <div
                className={cn("w-full max-w-md relative", className)}
                ref={dropdownRef}
            >
                <Button
                    variant="outline"
                    onClick={() => setIsOpen(!isOpen)}
                    className={cn(
                        "w-full justify-between bg-secondary/10 text-foreground", // Match input background
                        "hover:bg-secondary/20",
                        "focus:ring-2 focus:ring-primary/50 focus:ring-offset-0",
                        "transition-all duration-200 ease-in-out",
                        "border border-white/10 focus:border-primary/50",
                        "h-14 px-4 rounded-xl", // Match input height and radius
                        isOpen && "bg-secondary/20",
                    )}
                    aria-expanded={isOpen}
                    aria-haspopup="true"
                    type="button"
                >
                    <span className="flex items-center">
                        <IconWrapper
                            icon={selectedCategory.icon}
                            isHovered={false}
                            color={selectedCategory.color}
                        />
                        {selectedCategory.label}
                    </span>
                    <motion.div
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-center justify-center w-5 h-5"
                    >
                        <ChevronDown className="w-4 h-4" />
                    </motion.div>
                </Button>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 1, y: 0, height: 0 }}
                            animate={{
                                opacity: 1,
                                y: 0,
                                height: "auto",
                                transition: {
                                    type: "spring",
                                    stiffness: 500,
                                    damping: 30,
                                    mass: 1,
                                },
                            }}
                            exit={{
                                opacity: 0,
                                y: 0,
                                height: 0,
                                transition: {
                                    type: "spring",
                                    stiffness: 500,
                                    damping: 30,
                                    mass: 1,
                                },
                            }}
                            className="absolute left-0 right-0 top-full mt-2 z-50"
                            onKeyDown={handleKeyDown}
                        >
                            <motion.div
                                className="w-full rounded-xl border border-white/10 bg-card p-1 shadow-xl shadow-black/50 overflow-hidden backdrop-blur-xl"
                                initial={{ borderRadius: 12 }}
                                animate={{
                                    borderRadius: 16,
                                    transition: { duration: 0.2 },
                                }}
                                style={{ transformOrigin: "top" }}
                            >
                                <motion.div
                                    className="py-2 relative"
                                    variants={containerVariants}
                                    initial="hidden"
                                    animate="visible"
                                >
                                    <motion.div
                                        layoutId="hover-highlight"
                                        className="absolute inset-x-1 bg-primary/20 rounded-lg"
                                        animate={{
                                            y: items.findIndex((c) => (hoveredCategory || selectedCategory.id) === c.id) * 40 +
                                                (items.findIndex((c) => (hoveredCategory || selectedCategory.id) === c.id) > 0 ? 20 : 0),
                                            height: 40,
                                        }}
                                        transition={{
                                            type: "spring",
                                            bounce: 0.15,
                                            duration: 0.5,
                                        }}
                                    />
                                    {items.map((category, index) => (
                                        <React.Fragment key={category.id}>
                                            {index === 1 && (
                                                <motion.div
                                                    className="mx-4 my-2.5 border-t border-neutral-700"
                                                    variants={itemVariants}
                                                />
                                            )}
                                            <motion.button
                                                onClick={() => handleSelect(category)}
                                                onHoverStart={() => setHoveredCategory(category.id)}
                                                onHoverEnd={() => setHoveredCategory(null)}
                                                className={cn(
                                                    "relative flex w-full items-center px-4 py-2.5 text-sm rounded-md",
                                                    "transition-colors duration-150",
                                                    "focus:outline-none",
                                                    selectedCategory.id === category.id || hoveredCategory === category.id
                                                        ? "text-neutral-200"
                                                        : "text-neutral-400",
                                                )}
                                                whileTap={{ scale: 0.98 }}
                                                variants={itemVariants}
                                                type="button"
                                            >
                                                <IconWrapper
                                                    icon={category.icon}
                                                    isHovered={hoveredCategory === category.id}
                                                    color={category.color}
                                                />
                                                {category.label}
                                            </motion.button>
                                        </React.Fragment>
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
