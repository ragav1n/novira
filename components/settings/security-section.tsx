'use client';

import { Lock, Shield, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ChangePasswordDialog } from '@/components/change-password-dialog';

interface Props {
    userEmail: string;
    hasPassword: boolean;
    hasGoogleIdentity: boolean;
    onPasswordChangeSuccess: () => void;
}

export function SecuritySection({ userEmail, hasPassword, hasGoogleIdentity, onPasswordChangeSuccess }: Props) {
    return (
        <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Shield className="w-4 h-4" />
                <span>Security & Privacy</span>
            </div>

            <div className="bg-secondary/5 rounded-xl border border-white/5 divide-y divide-white/5 min-h-[144px]">
                <div className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                        <Lock className="w-4 h-4 text-muted-foreground" />
                        <div>
                            <p className="text-sm font-medium">Account Email</p>
                            <p className="text-[11px] text-muted-foreground">{userEmail}</p>
                        </div>
                    </div>
                    <div className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-white/5 text-muted-foreground border border-white/10">
                        Primary
                    </div>
                </div>

                {hasPassword && (
                    <ChangePasswordDialog
                        mode="change"
                        onSuccess={onPasswordChangeSuccess}
                        trigger={
                            <button className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors text-left outline-none group/btn">
                                <div className="flex items-center gap-3">
                                    <Lock className="w-4 h-4 text-muted-foreground group-hover/btn:text-primary transition-colors" />
                                    <span className="text-sm font-medium text-muted-foreground group-hover/btn:text-foreground transition-colors">Change Password</span>
                                </div>
                                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover/btn:translate-x-0.5 transition-all" />
                            </button>
                        }
                    />
                )}

                {hasGoogleIdentity && (
                    <div className={cn(
                        "flex items-center justify-between p-3",
                        hasPassword ? "bg-transparent border-t border-white/5" : "bg-white/[0.02]"
                    )}>
                        <div className="flex items-center gap-3">
                            <svg className="w-4 h-4" viewBox="0 0 24 24">
                                <path
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    fill="#4285F4"
                                />
                                <path
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    fill="#34A853"
                                />
                                <path
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    fill="#FBBC05"
                                />
                                <path
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    fill="#EA4335"
                                />
                            </svg>
                            <span className="text-sm font-medium text-muted-foreground">
                                {hasPassword ? "Google Account Linked" : "Connected via Google"}
                            </span>
                        </div>
                        {hasPassword && (
                            <div className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-primary/10 text-primary border border-primary/20">
                                Linked
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
