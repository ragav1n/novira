'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { WaveLoader } from '@/components/ui/wave-loader';

interface DashboardTransactionsDrawerProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
    loading?: boolean;
}

export const DashboardTransactionsDrawer = React.memo(function DashboardTransactionsDrawer({
    isOpen,
    onOpenChange,
    children,
    loading = false
}: DashboardTransactionsDrawerProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [hasScrolled, setHasScrolled] = useState(false);
    const [isScrollable, setIsScrollable] = useState(false);
    const [isAtBottom, setIsAtBottom] = useState(false);

    const checkScrollable = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        const scrollable = el.scrollHeight > el.clientHeight + 20;
        setIsScrollable(scrollable);
        if (!scrollable) setIsAtBottom(true);
    }, []);

    const handleScroll = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;
        if (!hasScrolled && el.scrollTop > 10) setHasScrolled(true);
        setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
    }, [hasScrolled]);

    useEffect(() => {
        if (!isOpen) {
            setHasScrolled(false);
            setIsScrollable(false);
            setIsAtBottom(false);
            return;
        }
        // Wait for content to render before measuring
        const timer = setTimeout(checkScrollable, 300);
        return () => clearTimeout(timer);
    }, [isOpen, children, checkScrollable]);

    const showHint = isScrollable && !hasScrolled && !isAtBottom;
    const showFade = isScrollable && !isAtBottom;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent
                showCloseButton={false}
                aria-describedby={undefined}
                onInteractOutside={e => e.preventDefault()}
                onPointerDownOutside={e => e.preventDefault()}
                className="fixed inset-0 top-0 left-0 right-0 bottom-0 max-w-none w-full h-full bg-background border-none rounded-none p-0 overflow-hidden flex flex-col z-[110] translate-x-0 translate-y-0 shadow-none elevation-0"
            >
                <DialogHeader className="p-6 pt-12 pb-4 border-b border-white/5 shrink-0">
                    <div className="flex items-center justify-between">
                        <div>
                            <DialogTitle className="text-2xl font-black tracking-tight">All Transactions</DialogTitle>
                            <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest mt-0.5">Your complete history</p>
                        </div>
                        <button
                            onClick={() => onOpenChange(false)}
                            className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center hover:bg-secondary/40 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </DialogHeader>

                <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    className="flex-1 overflow-y-auto no-scrollbar relative min-h-0"
                >
                    {loading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
                            <WaveLoader bars={5} message="" />
                        </div>
                    ) : null}

                    <div className="w-full max-w-md mx-auto px-1 pb-20">
                        {children}
                    </div>

                    {/* Fade + hint — only rendered when content actually overflows */}
                    <AnimatePresence>
                        {showFade && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.3 }}
                                className="pointer-events-none sticky bottom-0 left-0 right-0 h-28 -mt-28"
                                style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 50%, transparent 100%)' }}
                            >
                                <AnimatePresence>
                                    {showHint && (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1, transition: { delay: 0.4 } }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="absolute bottom-4 left-0 right-0 flex flex-col items-center gap-0.5"
                                        >
                                            <motion.div
                                                animate={{ y: [0, 4, 0] }}
                                                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                                                className="flex flex-col items-center gap-0.5"
                                            >
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">Scroll for more</span>
                                                <ChevronDown className="w-4 h-4 text-white/50" />
                                            </motion.div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </DialogContent>
        </Dialog>
    );
});
