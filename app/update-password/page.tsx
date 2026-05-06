'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { Lock, Eye, EyeClosed, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from "@/lib/utils";
import { toast } from '@/utils/haptics';
import { validatePassword } from '@/utils/password-validation';
import { PasswordRequirements } from '@/components/password-requirements';

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

export default function UpdatePassword() {
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [focusedInput, setFocusedInput] = useState<string | null>(null);

    // For 3D card effect
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);
    const rotateX = useTransform(mouseY, [-300, 300], [10, -10]);
    const rotateY = useTransform(mouseX, [-300, 300], [-10, 10]);

    const handleMouseMove = (e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        mouseX.set(e.clientX - rect.left - rect.width / 2);
        mouseY.set(e.clientY - rect.top - rect.height / 2);
    };

    const handleMouseLeave = () => {
        mouseX.set(0);
        mouseY.set(0);
    };

    // ... (inside UpdatePassword)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!password || !confirmPassword) {
            setError('Please fill in both fields');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        const { isValid, error: validationError } = validatePassword(password);
        if (!isValid) {
            setError(validationError || 'Invalid password');
            return;
        }

        setIsLoading(true);

        try {
            const { error } = await supabase.auth.updateUser({ password });

            if (error) throw error;

            toast.success('Password updated successfully');
            router.push('/signin');
        } catch (error: unknown) {
            setError(error instanceof Error ? error.message : 'Failed to update password');
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <div className="w-full min-h-[100dvh] relative flex items-center justify-center bg-transparent">

            {/* Opacity intentionally omitted — template cross-fades pages,
                and double-fading caused a visible blink. */}
            <motion.div
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="w-full max-w-sm relative z-10"
                style={{ perspective: 1500 }}
            >
                <motion.div
                    className="relative"
                    style={{ rotateX, rotateY }}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                    whileHover={{ z: 10 }}
                >
                    <div className="relative group">
                        {/* Card glow effect */}
                        <motion.div
                            className="absolute -inset-[1px] rounded-2xl opacity-0 group-hover:opacity-70 transition-opacity duration-700"
                            animate={{
                                boxShadow: [
                                    "0 0 10px 2px rgba(255,255,255,0.03)",
                                    "0 0 15px 5px rgba(255,255,255,0.05)",
                                    "0 0 10px 2px rgba(255,255,255,0.03)"
                                ],
                                opacity: [0.2, 0.4, 0.2]
                            }}
                            transition={{
                                duration: 4,
                                repeat: Infinity,
                                ease: "easeInOut",
                                repeatType: "mirror"
                            }}
                        />

                        {/* Card border glow */}
                        <div className="absolute -inset-[0.5px] rounded-2xl bg-gradient-to-r from-primary/10 via-primary/20 to-primary/10 opacity-0 group-hover:opacity-70 transition-opacity duration-500" />

                        {/* Glass card background */}
                        <div className="relative bg-card/60 backdrop-blur-xl rounded-2xl p-6 border border-primary/20 shadow-2xl overflow-hidden">
                            {/* Subtle card inner patterns */}
                            <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                                style={{
                                    backgroundImage: `linear-gradient(135deg, white 0.5px, transparent 0.5px), linear-gradient(45deg, white 0.5px, transparent 0.5px)`,
                                    backgroundSize: '30px 30px'
                                }}
                            />

                            {/* Header */}
                            <div className="text-center space-y-1 mb-6">
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.8 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.1, type: "spring" }}
                                    className="mx-auto w-10 h-10 mb-4 rounded-full border border-primary/30 flex items-center justify-center relative overflow-hidden"
                                >
                                    <div className="relative w-full h-full p-2">
                                        <img src="/Novira.png" alt="Novira Logo" className="w-full h-full object-contain drop-shadow-[0_0_10px_rgba(138,43,226,0.5)]" />
                                    </div>
                                    <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent opacity-50" />
                                </motion.div>

                                <motion.h1
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                    className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/80"
                                >
                                    Set New Password
                                </motion.h1>
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.3 }}
                                    className="text-foreground/60 text-xs"
                                >
                                    Create a new secure password for your account
                                </motion.p>
                            </div>

                            {/* Inline Messages */}
                            <AnimatePresence>
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center font-medium"
                                    >
                                        {error}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Form */}
                            <form onSubmit={handleSubmit} className="space-y-4">
                                {/* New Password Input */}
                                <motion.div
                                    className={`relative ${focusedInput === "password" ? 'z-10' : ''}`}
                                    whileFocus={{ scale: 1.02 }}
                                    whileHover={{ scale: 1.01 }}
                                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                >
                                    <div className="absolute -inset-[0.5px] bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none" />

                                    <div className="relative flex items-center overflow-hidden rounded-lg">
                                        <Lock className={`absolute left-3 w-4 h-4 transition-all duration-300 ${focusedInput === "password" ? 'text-primary' : 'text-foreground/40'}`} />

                                        <Input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="New Password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            onFocus={() => setFocusedInput("password")}
                                            onBlur={() => setFocusedInput(null)}
                                            className="w-full bg-primary/10 border-transparent focus:border-primary/40 text-foreground placeholder:text-foreground/30 h-10 transition-all duration-300 pl-10 pr-10 focus:bg-primary/15"
                                        />
                                        <div
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 cursor-pointer"
                                        >
                                            {showPassword ? (
                                                <Eye className="w-4 h-4 text-foreground/40 hover:text-primary transition-colors duration-300" />
                                            ) : (
                                                <EyeClosed className="w-4 h-4 text-foreground/40 hover:text-primary transition-colors duration-300" />
                                            )}
                                        </div>
                                    </div>

                                    <AnimatePresence>
                                        {(focusedInput === "password" || password.length > 0) && (
                                            <div className="mt-2">
                                                <PasswordRequirements password={password} />
                                            </div>
                                        )}
                                    </AnimatePresence>
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
                                        <Lock className={`absolute left-3 w-4 h-4 transition-all duration-300 ${focusedInput === "confirmPassword" ? 'text-primary' : 'text-foreground/40'}`} />

                                        <Input
                                            type={showConfirmPassword ? "text" : "password"}
                                            placeholder="Confirm Password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            onFocus={() => setFocusedInput("confirmPassword")}
                                            onBlur={() => setFocusedInput(null)}
                                            className="w-full bg-primary/10 border-transparent focus:border-primary/40 text-foreground placeholder:text-foreground/30 h-10 transition-all duration-300 pl-10 pr-10 focus:bg-primary/15"
                                        />
                                        <div
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                            className="absolute right-3 cursor-pointer"
                                        >
                                            {showConfirmPassword ? (
                                                <Eye className="w-4 h-4 text-foreground/40 hover:text-primary transition-colors duration-300" />
                                            ) : (
                                                <EyeClosed className="w-4 h-4 text-foreground/40 hover:text-primary transition-colors duration-300" />
                                            )}
                                        </div>
                                    </div>
                                </motion.div>

                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full relative group/button mt-4"
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
                                                    Update Password
                                                    <ArrowRight className="w-3 h-3 group-hover/button:translate-x-1 transition-transform duration-300" />
                                                </motion.span>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </motion.button>
                            </form>

                            {/* Footer */}
                            <div className="mt-8 text-center space-y-3">
                                <div className="flex justify-center items-center gap-3 text-[11px] text-muted-foreground font-medium">
                                    <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
                                    <span className="w-1 h-1 rounded-full bg-white/10" />
                                    <Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
                                </div>
                                <p className="text-[10px] text-muted-foreground/50 font-medium tracking-wider">
                                    © 2026 NOVIRA. ALL RIGHTS RESERVED.
                                </p>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </div >
    );
}
