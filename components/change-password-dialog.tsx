'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Eye, EyeClosed, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { validatePassword } from '@/utils/password-validation';
import { PasswordRequirements } from './password-requirements';

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

interface ChangePasswordDialogProps {
    trigger: React.ReactNode;
    mode?: 'change' | 'set';
    onSuccess?: () => void;
}

export function ChangePasswordDialog({ trigger, mode = 'change', onSuccess }: ChangePasswordDialogProps) {
    const [open, setOpen] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [focusedInput, setFocusedInput] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if ((mode === 'change' && !currentPassword) || !password || !confirmPassword) {
            toast.error('Please fill in all fields');
            return;
        }

        if (password !== confirmPassword) {
            toast.error('New passwords do not match');
            return;
        }

        if (mode === 'change' && password === currentPassword) {
            toast.error('New password cannot be the same as the old password');
            return;
        }

        const { isValid, error: validationError } = validatePassword(password);
        if (!isValid) {
            toast.error(validationError || 'Invalid password');
            return;
        }

        setIsLoading(true);

        try {
            if (mode === 'change') {
                // First, re-authenticate to verify current password
                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email: (await supabase.auth.getUser()).data.user?.email || '',
                    password: currentPassword,
                });

                if (signInError) {
                    toast.error('Incorrect current password');
                    setIsLoading(false);
                    return;
                }
            }

            const { error } = await supabase.auth.updateUser({ password });

            if (error) throw error;

            // Refresh the session to ensure providers metadata is updated
            await supabase.auth.refreshSession();

            toast.success(mode === 'change' ? 'Password updated successfully' : 'Password set successfully');
            onSuccess?.();
            setOpen(false);
            setCurrentPassword('');
            setPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            toast.error(error.message || 'Failed to update password');
            console.error('Password update error:', error);
        } finally {
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
                    <DialogTitle>{mode === 'change' ? 'Change Password' : 'Set Password'}</DialogTitle>
                    <DialogDescription>
                        {mode === 'change' ? 'Enter your new password below to update your account security.' : 'Choose a secure password for your account.'}
                    </DialogDescription>
                </VisuallyHidden.Root>

                <div className="relative group">
                    {/* Card border glow - cosmic purple */}
                    <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-primary/10 via-primary/30 to-primary/10 opacity-70 blur-sm pointer-events-none" />

                    {/* Glass card background - cosmic theme */}
                    <div className="relative bg-black/80 backdrop-blur-xl rounded-2xl p-6 border border-white/10 shadow-2xl overflow-hidden">

                        {/* Close button */}
                        <button
                            onClick={() => setOpen(false)}
                            className="absolute top-4 right-4 p-1 rounded-full text-muted-foreground hover:text-white hover:bg-white/10 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        {/* Header */}
                        <div className="text-center space-y-1 mb-6">
                            <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-white/70">
                                {mode === 'change' ? 'Change Password' : 'Set Account Password'}
                            </h2>
                            <p className="text-white/50 text-xs">
                                {mode === 'change' ? 'Ensure your account stays secure' : 'Add a password to your account'}
                            </p>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-4">

                            {/* Current Password Input - Only shown in 'change' mode */}
                            {mode === 'change' && (
                                <motion.div
                                    className={`relative ${focusedInput === "currentPassword" ? 'z-10' : ''}`}
                                    whileFocus={{ scale: 1.02 }}
                                    whileHover={{ scale: 1.01 }}
                                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                >
                                    <div className="absolute -inset-[0.5px] bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none" />

                                    <div className="relative flex items-center overflow-hidden rounded-lg">
                                        <Lock className={`absolute left-3 w-4 h-4 transition-all duration-300 ${focusedInput === "currentPassword" ? 'text-primary' : 'text-muted-foreground'}`} />

                                        <Input
                                            type={showCurrentPassword ? "text" : "password"}
                                            placeholder="Current Password"
                                            value={currentPassword}
                                            onChange={(e) => setCurrentPassword(e.target.value)}
                                            onFocus={() => setFocusedInput("currentPassword")}
                                            onBlur={() => setFocusedInput(null)}
                                            className="w-full bg-white/5 border-transparent focus:border-primary/40 text-white placeholder:text-white/30 h-10 transition-all duration-300 pl-10 pr-10 focus:bg-white/10"
                                        />

                                        <div
                                            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                            className="absolute right-3 cursor-pointer"
                                        >
                                            {showCurrentPassword ? (
                                                <Eye className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors duration-300" />
                                            ) : (
                                                <EyeClosed className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors duration-300" />
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {/* New Password Input */}
                            <motion.div
                                className={`relative ${focusedInput === "password" ? 'z-10' : ''}`}
                                whileFocus={{ scale: 1.02 }}
                                whileHover={{ scale: 1.01 }}
                                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                            >
                                <div className="absolute -inset-[0.5px] bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none" />

                                <div className="relative flex items-center overflow-hidden rounded-lg">
                                    <Lock className={`absolute left-3 w-4 h-4 transition-all duration-300 ${focusedInput === "password" ? 'text-primary' : 'text-muted-foreground'}`} />

                                    <Input
                                        type={showPassword ? "text" : "password"}
                                        placeholder={mode === 'change' ? "New Password" : "Password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        onFocus={() => setFocusedInput("password")}
                                        onBlur={() => setFocusedInput(null)}
                                        className="w-full bg-white/5 border-transparent focus:border-primary/40 text-white placeholder:text-white/30 h-10 transition-all duration-300 pl-10 pr-10 focus:bg-white/10"
                                    />

                                    <div
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 cursor-pointer"
                                    >
                                        {showPassword ? (
                                            <Eye className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors duration-300" />
                                        ) : (
                                            <EyeClosed className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors duration-300" />
                                        )}
                                    </div>
                                </div>
                            </motion.div>

                            {/* Confirm Password Input */}
                            <motion.div
                                className={`relative ${focusedInput === "confirmPassword" ? 'z-10' : ''}`}
                                whileFocus={{ scale: 1.02 }}
                                whileHover={{ scale: 1.01 }}
                                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                            >
                                <div className="absolute -inset-[0.5px] bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none" />

                                <div className="relative flex items-center overflow-hidden rounded-lg">
                                    <Lock className={`absolute left-3 w-4 h-4 transition-all duration-300 ${focusedInput === "confirmPassword" ? 'text-primary' : 'text-muted-foreground'}`} />

                                    <Input
                                        type={showConfirmPassword ? "text" : "password"}
                                        placeholder="Confirm Password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        onFocus={() => setFocusedInput("confirmPassword")}
                                        onBlur={() => setFocusedInput(null)}
                                        className="w-full bg-white/5 border-transparent focus:border-primary/40 text-white placeholder:text-white/30 h-10 transition-all duration-300 pl-10 pr-10 focus:bg-white/10"
                                    />

                                    <div
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3 cursor-pointer"
                                    >
                                        {showConfirmPassword ? (
                                            <Eye className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors duration-300" />
                                        ) : (
                                            <EyeClosed className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors duration-300" />
                                        )}
                                    </div>
                                </div>
                            </motion.div>

                            {/* Update Button */}
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                type="submit"
                                disabled={isLoading}
                                className="w-full relative group/button mt-2"
                            >
                                <div className="absolute inset-0 bg-primary/20 rounded-lg blur-lg opacity-0 group-hover/button:opacity-70 transition-opacity duration-300" />

                                <div className="relative overflow-hidden bg-primary text-primary-foreground font-medium h-10 rounded-lg transition-all duration-300 flex items-center justify-center">
                                    <motion.div
                                        className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/40 to-primary/0 -z-10"
                                        animate={{ x: ['-100%', '100%'] }}
                                        transition={{ duration: 1.5, ease: "easeInOut", repeat: Infinity, repeatDelay: 1 }}
                                        style={{ opacity: isLoading ? 1 : 0, transition: 'opacity 0.3s ease' }}
                                    />

                                    <AnimatePresence mode="wait">
                                        {isLoading ? (
                                            <motion.div
                                                key="loading"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                className="flex items-center justify-center"
                                            >
                                                <div className="w-4 h-4 border-2 border-black/70 border-t-transparent rounded-full animate-spin" />
                                            </motion.div>
                                        ) : (
                                            <motion.span
                                                key="button-text"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                className="flex items-center justify-center gap-1 text-sm font-medium"
                                            >
                                                {mode === 'change' ? 'Update Password' : 'Set Account Password'}
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </motion.button>
                        </form>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
