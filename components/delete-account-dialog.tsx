'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, Eye, EyeClosed, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { supabase } from '@/lib/supabase';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
    return (
        <input
            type={type}
            data-slot="input"
            className={cn(
                "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
                "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
                "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
                className
            )}
            {...props}
        />
    )
}

interface DeleteAccountDialogProps {
    trigger: React.ReactNode;
}

export function DeleteAccountDialog({ trigger }: DeleteAccountDialogProps) {
    const [open, setOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const { user } = useUserPreferences();

    const isGoogleUser = user?.app_metadata?.provider === 'google' ||
        user?.identities?.some(id => id.provider === 'google');

    const handleSubmit = async () => {
        setIsLoading(true);
        try {
            if (isGoogleUser) {
                const { error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                        queryParams: { prompt: 'select_account' },
                        redirectTo: `${window.location.origin}/confirm-delete`
                    }
                });
                if (error) throw error;
            } else {
                // Email/Password verification
                if (!password) {
                    throw new Error('Please enter your password to confirm deletion');
                }

                // Verify password by re-signing in
                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email: user?.email || '',
                    password: password,
                });

                if (signInError) {
                    throw new Error('Incorrect password. Please try again.');
                }

                // If password is correct, call the delete action
                const { deleteAccount } = await import('@/app/actions/delete-account');
                const result = await deleteAccount(user?.email || '');

                if (result.error) {
                    throw new Error(result.error);
                }

                // Success
                await supabase.auth.signOut();
                toast.success('Account deleted successfully');
                window.location.href = '/signin?message=Account+deleted';
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to initiate deletion');
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger}
            </DialogTrigger>
            <DialogContent showCloseButton={false} className="sm:max-w-md bg-transparent border-none p-0 shadow-none">
                <VisuallyHidden.Root>
                    <DialogTitle>Delete Account</DialogTitle>
                    <DialogDescription>Permanently delete your account and all associated data.</DialogDescription>
                </VisuallyHidden.Root>

                <div className="relative group">
                    <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-destructive/10 via-destructive/30 to-destructive/10 opacity-70 blur-sm pointer-events-none" />

                    <div className="relative bg-black/80 backdrop-blur-xl rounded-2xl p-6 border border-white/10 shadow-2xl overflow-hidden">
                        <button
                            onClick={() => setOpen(false)}
                            className="absolute top-4 right-4 p-1 rounded-full text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        <div className="text-center space-y-2 mb-6">
                            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
                                <AlertTriangle className="w-6 h-6 text-destructive" />
                            </div>
                            <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-white/70">
                                Delete Account
                            </h2>
                            <div className="text-white/60 text-[13px] px-2 leading-relaxed space-y-2">
                                <p>You are about to <span className="text-destructive font-bold uppercase tracking-tight">permanently delete</span> your account.</p>
                                <div className="bg-destructive/10 rounded-lg p-3 border border-destructive/20 text-destructive-foreground/90 text-xs text-left">
                                    <p className="font-bold mb-1 decoration-destructive/30">What will happen:</p>
                                    <ul className="list-disc list-inside space-y-1 opacity-90 font-medium">
                                        <li>You will be <span className="font-bold text-destructive">removed from all groups</span></li>
                                        <li>Your <span className="font-bold text-destructive">friendships will be deleted</span></li>
                                        <li>All your <span className="font-bold text-destructive">expense data will vanish</span></li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
                                <p className="text-xs text-primary/80 leading-relaxed font-medium">
                                    {isGoogleUser
                                        ? "To securely delete your account, we need to verify your identity with Google."
                                        : "To securely delete your account, please enter your password for verification."}
                                </p>
                            </div>

                            {!isGoogleUser && (
                                <div className="space-y-2">
                                    <div className="relative flex items-center overflow-hidden rounded-lg group/input">
                                        <Lock className="absolute left-3 w-4 h-4 text-foreground/40 group-focus-within/input:text-primary transition-colors" />
                                        <Input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="Enter your password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full bg-primary/10 border-transparent focus:border-primary/40 text-foreground placeholder:text-foreground/30 h-10 transition-all duration-300 pl-10 pr-10 focus:bg-primary/15"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 cursor-pointer p-1 rounded-md hover:bg-white/5 transition-colors"
                                        >
                                            {showPassword ? (
                                                <Eye className="w-4 h-4 text-foreground/40 hover:text-primary transition-colors" />
                                            ) : (
                                                <EyeClosed className="w-4 h-4 text-foreground/40 hover:text-primary transition-colors" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleSubmit}
                                disabled={isLoading}
                                className="w-full relative group/button mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <div className="absolute inset-0 bg-destructive/20 rounded-lg blur-lg opacity-0 group-hover/button:opacity-70 transition-opacity duration-300" />
                                <div className="relative overflow-hidden bg-destructive text-destructive-foreground font-medium h-10 rounded-lg transition-all duration-300 flex items-center justify-center">
                                    <AnimatePresence mode="wait">
                                        {isLoading ? (
                                            <motion.div
                                                key="loading"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                className="flex items-center justify-center"
                                            >
                                                <div className="w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
                                            </motion.div>
                                        ) : (
                                            <motion.span
                                                key="button-text"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                className="flex items-center justify-center gap-2 text-sm font-bold"
                                            >
                                                {isGoogleUser ? "Continue with Google" : "Confirm Deletion"}
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </motion.button>

                            <p className="text-[10px] text-center text-muted-foreground pt-2">
                                By clicking continue, you agree to our Terms of Service.
                            </p>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

