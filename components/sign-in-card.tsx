'use client'
import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { Mail, Lock, Eye, EyeClosed, ArrowRight } from 'lucide-react';

import { useRouter } from 'next/navigation';
import { cn } from "@/lib/utils"
import { FallingPattern } from './ui/falling-pattern';
import { supabase } from '@/lib/supabase';
import { authRateLimiter } from '@/utils/auth-rate-limiter';
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

export function Component({ isSignUp = false }: { isSignUp?: boolean }) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);

  // For 3D card effect - increased rotation range for more pronounced 3D effect
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-300, 300], [10, -10]); // Increased from 5/-5 to 10/-10
  const rotateY = useTransform(mouseX, [-300, 300], [-10, 10]); // Increased from -5/5 to -10/10

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left - rect.width / 2);
    mouseY.set(e.clientY - rect.top - rect.height / 2);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Submission Lock to prevent double-firing
  const isSubmittingRef = React.useRef(false);

  // Rate Limiter Import (Dynamic import not needed if standard, but good to know context)
  // We'll use the imported utility

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    // 1. Check Submission Lock
    if (isSubmittingRef.current || isLoading) {
      return;
    }

    // 2. Check Rate Limit
    const action = isSignUp ? 'signup' : 'login';
    const remainingTime = authRateLimiter.check(action);
    if (remainingTime > 0) {
      const seconds = Math.ceil(remainingTime / 1000);
      setError(`Please wait ${seconds}s before trying again.`);
      return;
    }

    setError(null);
    setSuccess(null);

    // Validate inputs
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (isSignUp && (!name || !confirmPassword || password !== confirmPassword)) {
      setError('Please check your information');
      return;
    }

    // ... (Inside Component)

    if (isSignUp) {
      const { isValid, error: validationError } = validatePassword(password);
      if (!isValid) {
        setError(validationError || 'Invalid password');
        return;
      }
    }

    // 3. Set Lock & Loading
    isSubmittingRef.current = true;
    setIsLoading(true);
    authRateLimiter.recordOK(action); // Record attempt

    try {
      if (isSignUp) {
        // Sign Up
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
            emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || (typeof window !== 'undefined' ? window.location.origin : '')}/auth/callback`,
          },
        });

        if (error) throw error;

        setSuccess('Registration successful! Please check your email for verification.');
        // Optional: Redirect to login or handle session
      } else {
        // Sign In
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        // Successful login
        if (typeof window !== 'undefined') {
          // We can check data.session if needed, but router push is enough for now
          router.push('/');
        }
      }
    } catch (error: any) {
      console.error("Auth error:", error);

      // Better error handling for rate limits
      if (error.status === 429 || error.message?.toLowerCase().includes('rate limit')) {
        setError('Too many requests. Please wait a moment before trying again.');
      } else {
        setError(error.message || 'Authentication failed');
      }

      // Release lock on error only (on success we navigate away)
      isSubmittingRef.current = false;
    } finally {
      setIsLoading(false);
      // Ensure lock is released if we didn't navigate (e.g. error or signup success message)
      if (isSignUp || error) {
        isSubmittingRef.current = false;
      }
    }
  };

  // Force hydration sync
  return (
    <div className="w-full min-h-[100dvh] bg-background relative overflow-hidden flex items-center justify-center">
      <FallingPattern color="#6237A0" className="absolute inset-0 z-0" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
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
            {/* Card glow effect - reduced intensity */}
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

            {/* Traveling light beam effect - reduced opacity */}
            <div className="absolute -inset-[1px] rounded-2xl overflow-hidden">
              {/* Top light beam - enhanced glow */}
              <motion.div
                className="absolute top-0 left-0 h-[3px] w-[50%] bg-gradient-to-r from-transparent via-white to-transparent opacity-70"
                initial={{ filter: "blur(2px)" }}
                animate={{
                  left: ["-50%", "100%"],
                  opacity: [0.3, 0.7, 0.3],
                  filter: ["blur(1px)", "blur(2.5px)", "blur(1px)"]
                }}
                transition={{
                  left: {
                    duration: 2.5,
                    ease: "easeInOut",
                    repeat: Infinity,
                    repeatDelay: 1
                  },
                  opacity: {
                    duration: 1.2,
                    repeat: Infinity,
                    repeatType: "mirror"
                  },
                  filter: {
                    duration: 1.5,
                    repeat: Infinity,
                    repeatType: "mirror"
                  }
                }}
              />

              {/* Right light beam - enhanced glow */}
              <motion.div
                className="absolute top-0 right-0 h-[50%] w-[3px] bg-gradient-to-b from-transparent via-white to-transparent opacity-70"
                initial={{ filter: "blur(2px)" }}
                animate={{
                  top: ["-50%", "100%"],
                  opacity: [0.3, 0.7, 0.3],
                  filter: ["blur(1px)", "blur(2.5px)", "blur(1px)"]
                }}
                transition={{
                  top: {
                    duration: 2.5,
                    ease: "easeInOut",
                    repeat: Infinity,
                    repeatDelay: 1,
                    delay: 0.6
                  },
                  opacity: {
                    duration: 1.2,
                    repeat: Infinity,
                    repeatType: "mirror",
                    delay: 0.6
                  },
                  filter: {
                    duration: 1.5,
                    repeat: Infinity,
                    repeatType: "mirror",
                    delay: 0.6
                  }
                }}
              />

              {/* Password Requirements Checklist */}
              <AnimatePresence>
                {isSignUp && (focusedInput === "password" || password.length > 0) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-2 text-left"
                  >
                    <PasswordRequirements password={password} />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Bottom light beam - enhanced glow */}
              <motion.div
                className="absolute bottom-0 right-0 h-[3px] w-[50%] bg-gradient-to-r from-transparent via-white to-transparent opacity-70"
                initial={{ filter: "blur(2px)" }}
                animate={{
                  right: ["-50%", "100%"],
                  opacity: [0.3, 0.7, 0.3],
                  filter: ["blur(1px)", "blur(2.5px)", "blur(1px)"]
                }}
                transition={{
                  right: {
                    duration: 2.5,
                    ease: "easeInOut",
                    repeat: Infinity,
                    repeatDelay: 1,
                    delay: 1.2
                  },
                  opacity: {
                    duration: 1.2,
                    repeat: Infinity,
                    repeatType: "mirror",
                    delay: 1.2
                  },
                  filter: {
                    duration: 1.5,
                    repeat: Infinity,
                    repeatType: "mirror",
                    delay: 1.2
                  }
                }}
              />

              {/* Left light beam - enhanced glow */}
              <motion.div
                className="absolute bottom-0 left-0 h-[50%] w-[3px] bg-gradient-to-b from-transparent via-white to-transparent opacity-70"
                initial={{ filter: "blur(2px)" }}
                animate={{
                  bottom: ["-50%", "100%"],
                  opacity: [0.3, 0.7, 0.3],
                  filter: ["blur(1px)", "blur(2.5px)", "blur(1px)"]
                }}
                transition={{
                  bottom: {
                    duration: 2.5,
                    ease: "easeInOut",
                    repeat: Infinity,
                    repeatDelay: 1,
                    delay: 1.8
                  },
                  opacity: {
                    duration: 1.2,
                    repeat: Infinity,
                    repeatType: "mirror",
                    delay: 1.8
                  },
                  filter: {
                    duration: 1.5,
                    repeat: Infinity,
                    repeatType: "mirror",
                    delay: 1.8
                  }
                }}
              />

              {/* Subtle corner glow spots - reduced opacity */}
              <motion.div
                className="absolute top-0 left-0 h-[5px] w-[5px] rounded-full bg-white/40 blur-[1px]"
                animate={{
                  opacity: [0.2, 0.4, 0.2]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  repeatType: "mirror"
                }}
              />
              <motion.div
                className="absolute top-0 right-0 h-[8px] w-[8px] rounded-full bg-white/60 blur-[2px]"
                animate={{
                  opacity: [0.2, 0.4, 0.2]
                }}
                transition={{
                  duration: 2.4,
                  repeat: Infinity,
                  repeatType: "mirror",
                  delay: 0.5
                }}
              />
              <motion.div
                className="absolute bottom-0 right-0 h-[8px] w-[8px] rounded-full bg-white/60 blur-[2px]"
                animate={{
                  opacity: [0.2, 0.4, 0.2]
                }}
                transition={{
                  duration: 2.2,
                  repeat: Infinity,
                  repeatType: "mirror",
                  delay: 1
                }}
              />
              <motion.div
                className="absolute bottom-0 left-0 h-[5px] w-[5px] rounded-full bg-white/40 blur-[1px]"
                animate={{
                  opacity: [0.2, 0.4, 0.2]
                }}
                transition={{
                  duration: 2.3,
                  repeat: Infinity,
                  repeatType: "mirror",
                  delay: 1.5
                }}
              />
            </div>

            {/* Card border glow - cosmic purple */}
            <div className="absolute -inset-[0.5px] rounded-2xl bg-gradient-to-r from-primary/10 via-primary/20 to-primary/10 opacity-0 group-hover:opacity-70 transition-opacity duration-500" />

            {/* Glass card background - cosmic theme */}
            <div className="relative bg-card/60 backdrop-blur-xl rounded-2xl p-6 border border-primary/20 shadow-2xl overflow-hidden">
              {/* Subtle card inner patterns */}
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{
                  backgroundImage: `linear-gradient(135deg, white 0.5px, transparent 0.5px), linear-gradient(45deg, white 0.5px, transparent 0.5px)`,
                  backgroundSize: '30px 30px'
                }}
              />

              {/* Logo and header */}
              <div className="text-center space-y-1 mb-5">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", duration: 0.8 }}
                  className="mx-auto w-10 h-10 rounded-full border border-primary/30 flex items-center justify-center relative overflow-hidden"
                >
                  {/* Logo placeholder - would be an SVG in practice */}
                  <div className="relative w-full h-full p-2">
                    <img src="/Novira.png" alt="Novira Logo" className="w-full h-full object-contain drop-shadow-[0_0_10px_rgba(138,43,226,0.5)]" />
                  </div>

                  {/* Inner lighting effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent opacity-50" />
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/80"
                >
                  {isSignUp ? 'Create Account' : 'Welcome Back'}
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="text-foreground/60 text-xs"
                >
                  {isSignUp ? 'Start tracking your expenses today' : 'Sign in to Novira'}
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
                {success && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500 text-sm text-center font-medium"
                  >
                    {success}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Login form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <motion.div className="space-y-3">
                  {/* Name input for signup */}
                  {isSignUp && (
                    <motion.div
                      className={`relative ${focusedInput === "name" ? 'z-10' : ''}`}
                      whileFocus={{ scale: 1.02 }}
                      whileHover={{ scale: 1.01 }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    >
                      <div className="absolute -inset-[0.5px] bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300" />

                      <div className="relative flex items-center overflow-hidden rounded-lg">
                        <Input
                          type="text"
                          placeholder="Full Name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          onFocus={() => setFocusedInput("name" as any)}
                          onBlur={() => setFocusedInput(null)}
                          className="w-full bg-primary/10 border-transparent focus:border-primary/40 text-foreground placeholder:text-foreground/30 h-10 transition-all duration-300 pl-3 pr-3 focus:bg-primary/15"
                        />

                        {focusedInput === "name" && (
                          <motion.div
                            layoutId="input-highlight"
                            className="absolute inset-0 bg-primary/5 -z-10"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          />
                        )}
                      </div>
                    </motion.div>
                  )}

                  {/* Email input */}
                  <motion.div
                    className={`relative ${focusedInput === "email" ? 'z-10' : ''}`}
                    whileFocus={{ scale: 1.02 }}
                    whileHover={{ scale: 1.01 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  >
                    <div className="absolute -inset-[0.5px] bg-gradient-to-r from-white/10 via-white/5 to-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300" />

                    <div className="relative flex items-center overflow-hidden rounded-lg">
                      <Mail className={`absolute left-3 w-4 h-4 transition-all duration-300 ${focusedInput === "email" ? 'text-primary' : 'text-foreground/40'
                        }`} />

                      <Input
                        type="email"
                        placeholder="Email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onFocus={() => setFocusedInput("email" as any)}
                        onBlur={() => setFocusedInput(null)}
                        className="w-full bg-primary/10 border-transparent focus:border-primary/40 text-foreground placeholder:text-foreground/30 h-10 transition-all duration-300 pl-10 pr-3 focus:bg-primary/15"
                      />

                      {/* Input highlight effect */}
                      {focusedInput === "email" && (
                        <motion.div
                          layoutId="input-highlight"
                          className="absolute inset-0 bg-primary/5 -z-10"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        />
                      )}
                    </div>
                  </motion.div>

                  {/* Password input */}
                  <motion.div
                    className={`relative ${focusedInput === "password" ? 'z-10' : ''}`}
                    whileFocus={{ scale: 1.02 }}
                    whileHover={{ scale: 1.01 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  >
                    <div className="absolute -inset-[0.5px] bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300" />

                    <div className="relative flex items-center overflow-hidden rounded-lg">
                      <Lock className={`absolute left-3 w-4 h-4 transition-all duration-300 ${focusedInput === "password" ? 'text-primary' : 'text-foreground/40'
                        }`} />

                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onFocus={() => setFocusedInput("password" as any)}
                        onBlur={() => setFocusedInput(null)}
                        className="w-full bg-primary/10 border-transparent focus:border-primary/40 text-foreground placeholder:text-foreground/30 h-10 transition-all duration-300 pl-10 pr-10 focus:bg-primary/15"
                      />

                      {/* Toggle password visibility */}
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

                      {/* Input highlight effect */}
                      {focusedInput === "password" && (
                        <motion.div
                          layoutId="input-highlight"
                          className="absolute inset-0 bg-primary/5 -z-10"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        />
                      )}
                    </div>
                  </motion.div>

                  {/* Confirm password input for signup */}
                  {isSignUp && (
                    <motion.div
                      className={`relative ${focusedInput === "confirmPassword" ? 'z-10' : ''}`}
                      whileFocus={{ scale: 1.02 }}
                      whileHover={{ scale: 1.01 }}
                      transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    >
                      <div className="absolute -inset-[0.5px] bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300" />

                      <div className="relative flex items-center overflow-hidden rounded-lg">
                        <Lock className={`absolute left-3 w-4 h-4 transition-all duration-300 ${focusedInput === "confirmPassword" ? 'text-primary' : 'text-foreground/40'
                          }`} />

                        <Input
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Confirm Password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          onFocus={() => setFocusedInput("confirmPassword" as any)}
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

                        {focusedInput === "confirmPassword" && (
                          <motion.div
                            layoutId="input-highlight"
                            className="absolute inset-0 bg-primary/5 -z-10"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          />
                        )}
                      </div>
                    </motion.div>
                  )}
                </motion.div>

                {/* Remember me & Forgot password */}
                <div className="flex items-center justify-between pt-1 relative z-10">
                  <div className="flex items-center justify-between">
                    <Link href="/forgot-password" className="text-xs text-foreground/60 hover:text-foreground transition-colors duration-200">
                      Forgot password?
                    </Link>
                  </div>
                </div>

                {/* Sign in button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={isLoading}
                  className="w-full relative group/button mt-5"
                >
                  {/* Button glow effect - cosmic purple */}
                  <div className="absolute inset-0 bg-primary/20 rounded-lg blur-lg opacity-0 group-hover/button:opacity-70 transition-opacity duration-300" />

                  <div className="relative overflow-hidden bg-primary text-primary-foreground font-medium h-10 rounded-lg transition-all duration-300 flex items-center justify-center">
                    {/* Button background animation */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/40 to-primary/0 -z-10"
                      animate={{
                        x: ['-100%', '100%'],
                      }}
                      transition={{
                        duration: 1.5,
                        ease: "easeInOut",
                        repeat: Infinity,
                        repeatDelay: 1
                      }}
                      style={{
                        opacity: isLoading ? 1 : 0,
                        transition: 'opacity 0.3s ease'
                      }}
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
                          {isSignUp ? 'Create Account' : 'Sign In'}
                          <ArrowRight className="w-3 h-3 group-hover/button:translate-x-1 transition-transform duration-300" />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.button>

                {/* Divider */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-foreground/10"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or</span>
                  </div>
                </div>

                {/* Google Sign In Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  disabled={isLoading}
                  onClick={async () => {
                    setIsLoading(true);
                    try {
                      const { error } = await supabase.auth.signInWithOAuth({
                        provider: 'google',
                        options: {
                          redirectTo: `${window.location.origin}/auth/callback`,
                        },
                      });
                      if (error) throw error;
                    } catch (error: any) {
                      console.error("Google Auth error:", error);
                      setError(error.message || 'Authentication failed');
                      setIsLoading(false);
                    }
                  }}
                  className="w-full relative group/google-button"
                >
                  {/* Button glow effect */}
                  <div className="absolute inset-0 bg-white/5 rounded-lg blur-md opacity-0 group-hover/google-button:opacity-50 transition-opacity duration-300" />

                  <div className="relative overflow-hidden bg-white/5 backdrop-blur-md text-white font-medium h-10 rounded-lg transition-all duration-300 flex items-center justify-center border border-white/10 shadow-lg hover:bg-white/10 hover:border-white/20">
                    <div className="flex items-center justify-center gap-2">
                      {/* Google Icon */}
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
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
                      <span className="text-sm font-medium">Continue with Google</span>
                    </div>
                  </div>
                </motion.button>



                {/* Sign up link */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="text-center text-xs text-foreground/60 mt-4"
                >
                  Don't have an account?{" "}
                  <Link
                    href={isSignUp ? "/signin" : "/signup"}
                    className="relative inline-block group/signup"
                  >
                    <span className="relative z-10 text-foreground group-hover/signup:text-foreground/70 transition-colors duration-300 font-medium">
                      {isSignUp ? 'Sign in instead' : 'Sign up'}
                    </span>
                    <span className="absolute bottom-0 left-0 w-0 h-[1px] bg-foreground group-hover/signup:w-full transition-all duration-300" />
                  </Link>
                </motion.p>
              </form>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
