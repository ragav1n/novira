'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { History, X, Clock } from 'lucide-react';
import { format } from 'date-fns';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { WaveLoader } from '@/components/ui/wave-loader';

interface AuditLog {
    id: string;
    action: 'INSERT' | 'UPDATE' | 'DELETE';
    old_data: any;
    new_data: any;
    created_at: string;
    changed_by_profile?: {
        full_name: string;
    };
}

interface TransactionHistoryDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    transaction: any | null;
    auditLogs: AuditLog[];
    isLoading: boolean;
}

export const TransactionHistoryDialog = React.memo(function TransactionHistoryDialog({
    isOpen,
    onOpenChange,
    transaction,
    auditLogs,
    isLoading
}: TransactionHistoryDialogProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md bg-card/95 backdrop-blur-xl border-white/10 rounded-[32px] overflow-hidden p-0 gap-0 shadow-2xl">
                <DialogHeader className="p-6 pb-4 border-b border-white/5 bg-secondary/10">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-10 h-10 rounded-2xl bg-primary/20 flex items-center justify-center border border-primary/20">
                            <History className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold">Transaction History</DialogTitle>
                            <DialogDescription className="text-xs text-muted-foreground font-medium">
                                Audit logs for "{transaction?.description || 'this transaction'}"
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-0">
                    <ScrollArea className="h-[400px] w-full">
                        <div className="p-6 space-y-6">
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center py-20 gap-4">
                                    <WaveLoader bars={3} />
                                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest animate-pulse">Fetching Logs...</p>
                                </div>
                            ) : auditLogs.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-center space-y-3 opacity-40">
                                    <Clock className="w-12 h-12 text-muted-foreground/20" />
                                    <p className="text-sm font-medium">No history available for this transaction.</p>
                                </div>
                            ) : (
                                <div className="relative border-l-2 border-primary/10 ml-3 pl-6 space-y-8">
                                    {auditLogs.map((log, idx) => (
                                        <div key={log.id} className="relative">
                                            {/* Timeline dot */}
                                            <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-background border-2 border-primary shadow-sm z-10" />
                                            
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <span className={cn(
                                                        "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md",
                                                        log.action === 'INSERT' ? "bg-emerald-500/10 text-emerald-500" :
                                                        log.action === 'UPDATE' ? "bg-amber-500/10 text-amber-500" :
                                                        "bg-rose-500/10 text-rose-500"
                                                    )}>
                                                        {log.action === 'INSERT' ? 'Created' : log.action === 'UPDATE' ? 'Updated' : 'Deleted'}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground font-mono">
                                                        {format(new Date(log.created_at), 'MMM d, h:mm a')}
                                                    </span>
                                                </div>
                                                
                                                <p className="text-sm font-bold text-white/90">
                                                    By {log.changed_by_profile?.full_name?.split(' ')[0] || 'Unknown'}
                                                </p>

                                                {log.action === 'UPDATE' && log.new_data && (
                                                    <div className="mt-2 p-3 rounded-2xl bg-white/5 border border-white/5 text-[11px] space-y-1.5">
                                                        {Object.keys(log.new_data).map(key => {
                                                            if (key === 'updated_at' || key === 'id' || JSON.stringify(log.new_data[key]) === JSON.stringify(log.old_data?.[key])) return null;
                                                            return (
                                                                <div key={key} className="flex flex-col">
                                                                    <span className="text-muted-foreground capitalize font-bold text-[9px] uppercase tracking-wider">{key}</span>
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <span className="text-rose-400/70 line-through decoration-rose-400/30 truncate max-w-[100px]">{String(log.old_data?.[key] || 'None')}</span>
                                                                        <span className="text-white/40">→</span>
                                                                        <span className="text-emerald-400 font-bold truncate max-w-[120px]">{String(log.new_data[key])}</span>
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    );
});

// Helper for classes (added here if not imported)
function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(' ');
}
