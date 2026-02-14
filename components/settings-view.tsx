'use client';

import React from 'react';
import { ChevronLeft, User, Download, Cloud, FolderPlus, Moon, Bell, AlertTriangle, Shield, CreditCard, Lock, HelpCircle, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function SettingsView() {
    const router = useRouter();

    return (
        <div className="p-5 space-y-6 max-w-md mx-auto relative pb-24">
            {/* Header */}
            <div className="flex items-center justify-between">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-full bg-secondary/30 hover:bg-secondary/50 transition-colors"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-lg font-semibold">Settings</h2>
                <div className="w-9" /> {/* Spacer */}
            </div>

            {/* Profile Section */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <User className="w-4 h-4" />
                    <span>Profile</span>
                </div>

                <div className="flex gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-xl font-bold shadow-lg shadow-primary/20">
                        SA
                    </div>
                    <div className="flex-1 space-y-3">
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Full Name</label>
                            <Input defaultValue="Sarah Anderson" className="bg-secondary/10 border-white/5 h-9" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Monthly Budget</label>
                            <Input defaultValue="$3,500" className="bg-secondary/10 border-white/5 h-9" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Export Data */}
            <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <Download className="w-4 h-4" />
                    <span>Export Data</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" className="h-16 flex flex-col items-center justify-center gap-1 bg-secondary/5 border-primary/20 hover:bg-primary/10 hover:border-primary/50 transition-all group">
                        <Download className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-medium">Export CSV</span>
                    </Button>
                    <Button variant="outline" className="h-16 flex flex-col items-center justify-center gap-1 bg-secondary/5 border-primary/20 hover:bg-primary/10 hover:border-primary/50 transition-all group">
                        <Download className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-medium">Export PDF</span>
                    </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">Export your expense data for backup or analysis in other tools.</p>
            </div>


            {/* Preferences */}
            <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <SlidersHorizontal className="w-4 h-4" />
                    <span>Preferences</span>
                </div>

                <div className="bg-secondary/5 rounded-xl border border-white/5 divide-y divide-white/5">
                    <div className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3">
                            <Bell className="w-4 h-4 text-muted-foreground" />
                            <div>
                                <p className="text-sm font-medium">Push Notifications</p>
                                <p className="text-[10px] text-muted-foreground">Get notified about expenses</p>
                            </div>
                        </div>
                        <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                            <div>
                                <p className="text-sm font-medium">Budget Alerts</p>
                                <p className="text-[10px] text-muted-foreground">Alert when overspending</p>
                            </div>
                        </div>
                        <Switch defaultChecked />
                    </div>
                </div>
            </div>

            {/* Security */}
            <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <Shield className="w-4 h-4" />
                    <span>Security & Privacy</span>
                </div>

                <div className="bg-secondary/5 rounded-xl border border-white/5 divide-y divide-white/5">
                    <button className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors text-left">
                        <div className="flex items-center gap-3">
                            <Lock className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm font-medium">Change Password</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </button>
                </div>
            </div>

            {/* Footer Info */}
            <div className="text-center py-4 space-y-2">
                <p className="text-xs text-muted-foreground font-medium">ExpenseTracker v1.0.0</p>
                <div className="flex justify-center gap-4 text-[10px] text-primary">
                    <button>Terms</button>
                    <button>Privacy</button>
                    <button>Help</button>
                </div>
            </div>
        </div>
    );
}
