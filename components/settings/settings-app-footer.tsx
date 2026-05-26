'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, ChevronRight, LogOut, Shield, Trash2, Wrench } from 'lucide-react';
import { DeleteAccountDialog } from '@/components/delete-account-dialog';
import { version as APP_VERSION } from '@/package.json';

interface Props {
    onSignOut: () => Promise<void> | void;
}

export function SettingsAppFooter({ onSignOut }: Props) {
    const router = useRouter();

    return (
        <>
            <div className="pt-2">
                <button
                    onClick={onSignOut}
                    className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-secondary/10 hover:bg-secondary/20 text-muted-foreground hover:text-foreground transition-colors duration-200 border border-white/5"
                >
                    <LogOut className="w-4 h-4" />
                    <span className="font-medium text-sm">Log Out</span>
                </button>
            </div>

            <div className="space-y-3 pt-2">
                <div className="bg-secondary/5 rounded-xl border border-white/5 overflow-hidden">
                    <button
                        onClick={() => router.push('/guide')}
                        className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors text-left outline-none group"
                    >
                        <div className="flex items-center gap-3">
                            <BookOpen className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">User Guide</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-all" />
                    </button>
                </div>
                <p className="text-[11px] text-muted-foreground px-1">
                    A complete walkthrough of every feature, with live animated demos.
                </p>
            </div>

            <div className="space-y-3 pt-2">
                <div className="bg-secondary/5 rounded-xl border border-white/5 overflow-hidden">
                    <button
                        onClick={() => router.push('/sw-reset')}
                        className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors text-left outline-none group"
                    >
                        <div className="flex items-center gap-3">
                            <Wrench className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">Reset App</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-all" />
                    </button>
                </div>
                <p className="text-[11px] text-muted-foreground px-1">
                    Clears cached data, the offline queue, and signs you out on this device. Your account stays intact.
                </p>
            </div>

            <div className="space-y-3 pt-2">
                <div className="bg-secondary/5 rounded-xl border border-white/5 overflow-hidden">
                    <DeleteAccountDialog
                        trigger={
                            <button className="w-full flex items-center justify-between p-3 hover:bg-destructive/5 transition-colors text-left outline-none group">
                                <div className="flex items-center gap-3">
                                    <Trash2 className="w-4 h-4 text-muted-foreground group-hover:text-destructive transition-colors" />
                                    <span className="text-sm font-medium text-muted-foreground group-hover:text-destructive transition-colors">Delete Account</span>
                                </div>
                                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-destructive/50 transition-colors" />
                            </button>
                        }
                    />
                </div>
                <p className="text-[11px] text-muted-foreground px-1">
                    Permanently delete your account and all associated data.
                </p>
            </div>

            <div className="text-center py-4 space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Novira v{APP_VERSION}</p>
                <div className="flex justify-center items-center gap-3 text-[11px] text-muted-foreground">
                    <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
                    <span className="w-1 h-1 rounded-full bg-white/10" />
                    <Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
                </div>
                <div className="flex justify-center items-center gap-2 text-[11px] text-muted-foreground">
                    <Shield className="w-3 h-3" />
                    <span>Secure &amp; Encrypted</span>
                </div>
            </div>
        </>
    );
}
