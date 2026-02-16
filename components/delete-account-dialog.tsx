'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Eye, EyeClosed, X, AlertTriangle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { deleteAccount } from '@/app/actions/delete-account';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

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
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [focusedInput, setFocusedInput] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!password) {
            toast.error('Please enter your password to confirm');
            return;
        }

        setIsLoading(true);

        try {
            // Get current user email locally to pass to server action
            const { data: { user } } = await supabase.auth.getUser();
            if (!user?.email) {
                toast.error('Could not identify user account');
                setIsLoading(false);
                return;
            }

            const result = await deleteAccount(user.email, password);

            if (result.error) {
                toast.error(result.error);
                setIsLoading(false);
                return;
            }

            // Success case
            toast.success('Account deleted successfully');
            setOpen(false);

            // Sign out locally. This might throw a 403 because the user is already deleted, 
            // but we want to clear the local session/cookies anyway.
            try {
                await supabase.auth.signOut();
            } catch (signOutError) {
                console.warn('Sign out during deletion failed (expected):', signOutError);
            }

            router.push('/signin');

        } catch (error: any) {
            toast.error('An unexpected error occurred');
            console.error('Delete account error:', error);
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
                    {/* Card border glow - destructive red */}
                    <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-destructive/10 via-destructive/30 to-destructive/10 opacity-70 blur-sm pointer-events-none" />

                    {/* Glass card background */}
                    <div className="relative bg-black/80 backdrop-blur-xl rounded-2xl p-6 border border-white/10 shadow-2xl overflow-hidden">

                        {/* Close button */}
                        <button
                            onClick={() => setOpen(false)}
                            className="absolute top-4 right-4 p-1 rounded-full text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        {/* Header */}
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

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Password Input */}
                            <motion.div
                                className={`relative ${focusedInput === "password" ? 'z-10' : ''}`}
                                whileFocus={{ scale: 1.02 }}
                                whileHover={{ scale: 1.01 }}
                                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                            >
                                <div className="absolute -inset-[0.5px] bg-gradient-to-r from-destructive/20 via-destructive/10 to-destructive/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none" />

                                <div className="relative flex items-center overflow-hidden rounded-lg">
                                    <Lock className={`absolute left-3 w-4 h-4 transition-all duration-300 ${focusedInput === "password" ? 'text-destructive' : 'text-muted-foreground'}`} />

                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Confirm Password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        onFocus={() => setFocusedInput("password")}
                                        onBlur={() => setFocusedInput(null)}
                                        className="w-full bg-white/5 border-transparent focus:border-destructive/40 text-white placeholder:text-white/30 h-10 transition-all duration-300 pl-10 pr-10 focus:bg-white/10"
                                    />

                                    <div
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 cursor-pointer"
                                    >
                                        {showPassword ? (
                                            <Eye className="w-4 h-4 text-muted-foreground hover:text-destructive transition-colors duration-300" />
                                        ) : (
                                            <EyeClosed className="w-4 h-4 text-muted-foreground hover:text-destructive transition-colors duration-300" />
                                        )}
                                    </div>
                                </div>
                            </motion.div>

                            {/* Delete Button */}
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                type="submit"
                                disabled={isLoading}
                                className="w-full relative group/button mt-4"
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
                                                <Trash2 className="w-4 h-4" />
                                                Permanently Delete
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </motion.button>

                            <p className="text-[10px] text-center text-muted-foreground pt-2">
                                By clicking delete, you agree to our Terms of Service.
                            </p>
                        </form>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

