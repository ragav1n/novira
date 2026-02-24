'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
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
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="fixed inset-0 top-0 left-0 right-0 bottom-0 max-w-none w-full h-full bg-background border-none rounded-none p-0 overflow-hidden flex flex-col z-[9999]">
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
                
                <div className="flex-1 overflow-hidden relative">
                    {loading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
                            <WaveLoader bars={5} message="" />
                        </div>
                    ) : null}
                    
                    <div className="h-full w-full max-w-md mx-auto relative px-1">
                        {children}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
});
