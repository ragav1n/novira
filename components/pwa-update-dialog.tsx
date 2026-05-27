'use client';

import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, RefreshCcw } from 'lucide-react';
import { LATEST_FEATURE_ANNOUNCEMENT } from '@/lib/feature-flags';
import { version } from '@/package.json';

interface PWAUpdateDialogProps {
    open: boolean;
    onUpdate: () => void;
    onLater: () => void;
}

export function PWAUpdateDialog({ open, onUpdate, onLater }: PWAUpdateDialogProps) {
    const bullets = LATEST_FEATURE_ANNOUNCEMENT.features.slice(0, 4);

    return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) onLater(); }}>
            <DialogContent
                showCloseButton={false}
                className="max-w-[420px] w-[95vw] p-0 overflow-hidden border-white/10 bg-[#0A0A0B]/98 backdrop-blur-xl rounded-[2rem] shadow-[0_0_50px_-12px_rgba(138,43,226,0.3)]"
            >
                <div className="pointer-events-none absolute -top-24 -left-24 w-56 h-56 rounded-full bg-primary/20 blur-[80px] opacity-50" />
                <div className="pointer-events-none absolute -bottom-24 -right-24 w-56 h-56 rounded-full bg-purple-600/20 blur-[80px] opacity-50" />
                <div className="pointer-events-none absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

                <div className="relative p-6 space-y-5">
                    <div className="flex items-start gap-3">
                        <div className="shrink-0 w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                            <Download className="w-4.5 h-4.5 text-primary" aria-hidden="true" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary mb-1">
                                Update
                            </div>
                            <DialogTitle className="text-lg font-bold text-white leading-tight">
                                New version ready
                            </DialogTitle>
                            <DialogDescription className="text-[12.5px] text-white/60 leading-relaxed mt-1">
                                Restart to apply. Drafts and offline queue are kept.
                            </DialogDescription>
                        </div>
                    </div>

                    <ul className="space-y-2 rounded-2xl border border-white/5 bg-white/[0.02] p-3">
                        {bullets.map((b) => (
                            <li key={b.title} className="flex items-start gap-2.5 text-[12px] text-white/80 leading-snug">
                                <span className="mt-1.5 w-1 h-1 rounded-full bg-primary shrink-0" aria-hidden="true" />
                                <span><span className="font-semibold text-white">{b.title}.</span> {b.description}</span>
                            </li>
                        ))}
                    </ul>

                    <div className="flex items-center justify-between gap-3">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-white/35">
                            on v{version}
                        </span>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                onClick={onLater}
                                className="h-10 px-4 rounded-xl text-[12px] font-semibold text-white/70 hover:text-white hover:bg-white/5"
                            >
                                Later
                            </Button>
                            <Button
                                onClick={onUpdate}
                                className="h-10 px-4 rounded-xl bg-white text-black hover:bg-white/90 font-bold text-[12px] inline-flex items-center gap-1.5"
                            >
                                <RefreshCcw className="w-3.5 h-3.5" aria-hidden="true" />
                                Update now
                            </Button>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
