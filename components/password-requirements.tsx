import React from 'react';
import { Check, X } from 'lucide-react';
import { PasswordStrength, validatePassword } from '@/utils/password-validation';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface PasswordRequirementsProps {
    password?: string;
    showIfEmpty?: boolean; // If true, shows requirements even if password is empty (all red/gray)
}

export function PasswordRequirements({ password = '', showIfEmpty = false }: PasswordRequirementsProps) {
    // If we shouldn't show when empty and it IS empty, return null
    if (!showIfEmpty && !password) return null;

    const strength = validatePassword(password);

    const RequirementItem = ({ met, label }: { met: boolean; label: string }) => (
        <div className={cn("flex items-center gap-2.5 text-[11px] font-medium transition-all duration-300", met ? "text-emerald-400" : "text-muted-foreground/40")}>
            <div className={cn("w-4.5 h-4.5 rounded-full flex items-center justify-center border transition-all duration-500",
                met ? "bg-emerald-500/20 border-emerald-500/50 scale-110 shadow-[0_0_10px_rgba(16,185,129,0.2)]" : "bg-white/5 border-white/5"
            )}>
                {met ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : <X className="w-2 h-2 opacity-50" />}
            </div>
            <span className={cn("transition-all duration-300", met ? "translate-x-0" : "-translate-x-1")}>{label}</span>
        </div>
    );

    return (
        <AnimatePresence>
            {(showIfEmpty || password) && (
                <motion.div
                    initial={{ opacity: 0, y: -10, filter: 'blur(10px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, y: -10, filter: 'blur(10px)' }}
                    transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                    className="space-y-3 p-4 rounded-2xl bg-card/40 backdrop-blur-xl border border-white/10 shadow-xl overflow-hidden relative"
                >
                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary/50 to-transparent" />
                    
                    <div className="flex items-center justify-between mb-1">
                        <p className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/70">Security Protocol</p>
                        <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div 
                                    key={i} 
                                    className={cn(
                                        "w-2.5 h-1 rounded-full transition-all duration-500",
                                        Object.values(strength).filter(Boolean).length >= i 
                                            ? "bg-primary shadow-[0_0_8px_rgba(138,43,226,0.6)]" 
                                            : "bg-white/5"
                                    )} 
                                />
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                        <RequirementItem met={strength.length} label="8+ Characters" />
                        <RequirementItem met={strength.uppercase} label="Uppercase" />
                        <RequirementItem met={strength.lowercase} label="Lowercase" />
                        <RequirementItem met={strength.number} label="Number" />
                        <RequirementItem met={strength.symbol} label="Special Symbol" />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
