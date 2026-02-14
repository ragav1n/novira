'use client';

import React, { useEffect, useState } from 'react';
import { ChevronLeft, User, Download, AlertTriangle, Shield, Lock, ChevronRight, SlidersHorizontal, LogOut, Banknote } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { WaveLoader } from '@/components/ui/wave-loader';
import { AlertBanner } from '@/components/ui/alert-banner';
import { AnimatePresence } from 'framer-motion';
import { generateCSV, generatePDF } from '@/utils/export-utils';

export function SettingsView() {
    const router = useRouter();
    const budgetInputRef = React.useRef<HTMLInputElement>(null);
    const [fullName, setFullName] = useState('');
    const [budget, setBudget] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [userEmail, setUserEmail] = useState('');
    const [budgetAlertsEnabled, setBudgetAlertsEnabled] = useState(false);
    const [showAlert, setShowAlert] = useState(false);
    const [loadingExport, setLoadingExport] = useState(false);
    const { currency, setCurrency, formatCurrency, convertAmount } = useUserPreferences();

    useEffect(() => {
        getProfile();
    }, []);

    const getProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/signin');
                return;
            }
            setUserEmail(user.email || '');

            const { data, error } = await supabase
                .from('profiles')
                .select('full_name, monthly_budget')
                .eq('id', user.id)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Error fetching profile:', error);
            }

            if (data) {
                setFullName(data.full_name || '');
                setBudget(data.monthly_budget?.toString() || '3000');
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateProfile = async () => {
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const updates = {
                id: user.id,
                full_name: fullName,
                monthly_budget: parseFloat(budget),
                updated_at: new Date().toISOString(),
            };

            const { error } = await supabase
                .from('profiles')
                .upsert(updates);

            if (error) throw error;
            toast.success('Profile updated successfully');
        } catch (error: any) {
            toast.error('Error updating profile: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleExport = async (type: 'csv' | 'pdf') => {
        setLoadingExport(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: transactions, error } = await supabase
                .from('transactions')
                .select('*')
                .order('date', { ascending: false });

            if (error) throw error;

            if (!transactions || transactions.length === 0) {
                toast.error('No transactions to export');
                return;
            }

            if (type === 'csv') {
                generateCSV(transactions, currency, convertAmount, formatCurrency);
                toast.success('CSV Exported successfully');
            } else {
                generatePDF(transactions, currency, convertAmount, formatCurrency);
                toast.success('PDF Exported successfully');
            }
        } catch (error: any) {
            console.error('Export failed:', error);
            toast.error('Failed to export data');
        } finally {
            setLoadingExport(false);
        }
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/signin');
    };

    if (loading) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center min-h-[50vh]">
                <WaveLoader bars={5} message="Loading settings..." />
            </div>
        );
    }

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
                <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        <span>Profile</span>
                    </div>
                </div>

                <div className="flex gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-xl font-bold shadow-lg shadow-primary/20 text-white uppercase">
                        {fullName ? fullName.substring(0, 2) : userEmail.substring(0, 2)}
                    </div>
                    <div className="flex-1 space-y-3">
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Full Name</label>
                            <Input
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                className="bg-secondary/10 border-white/5 h-9"
                                placeholder="e.g. John Doe"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Monthly Budget</label>
                            <Input
                                ref={budgetInputRef}
                                value={budget}
                                onChange={(e) => setBudget(e.target.value)}
                                className="bg-secondary/10 border-white/5 h-9"
                                placeholder="e.g. 3000"
                                type="number"
                            />
                        </div>
                        <Button
                            onClick={updateProfile}
                            disabled={saving}
                            className="w-full h-8 text-xs bg-primary/20 text-primary hover:bg-primary/30 border border-primary/20"
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </Button>
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
                    <Button
                        variant="outline"
                        onClick={() => handleExport('csv')}
                        disabled={loadingExport}
                        className="h-16 flex flex-col items-center justify-center gap-1 bg-secondary/5 border-primary/20 hover:bg-primary/10 hover:border-primary/50 transition-all group"
                    >
                        <Download className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-medium">{loadingExport ? 'Exporting...' : 'Export CSV'}</span>
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => handleExport('pdf')}
                        disabled={loadingExport}
                        className="h-16 flex flex-col items-center justify-center gap-1 bg-secondary/5 border-primary/20 hover:bg-primary/10 hover:border-primary/50 transition-all group"
                    >
                        <Download className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-medium">{loadingExport ? 'Exporting...' : 'Export PDF'}</span>
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
                            <Banknote className="w-4 h-4 text-muted-foreground" />
                            <div>
                                <p className="text-sm font-medium">Currency</p>
                                <p className="text-[10px] text-muted-foreground">Select your preferred currency</p>
                            </div>
                        </div>
                        <div className="flex items-center bg-secondary/20 rounded-lg p-0.5">
                            <button
                                onClick={() => setCurrency('USD')}
                                className={cn(
                                    "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                    currency === 'USD' ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                USD
                            </button>
                            <button
                                onClick={() => setCurrency('EUR')}
                                className={cn(
                                    "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                    currency === 'EUR' ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                EUR
                            </button>
                            <button
                                onClick={() => setCurrency('INR')}
                                className={cn(
                                    "px-3 py-1 text-xs font-medium rounded-md transition-all",
                                    currency === 'INR' ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                INR
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="w-4 h-4 text-muted-foreground" />
                            <div>
                                <p className="text-sm font-medium">Budget Alerts</p>
                                <p className="text-[10px] text-muted-foreground">Alert when overspending</p>
                            </div>
                        </div>
                        <Switch
                            checked={budgetAlertsEnabled}
                            onCheckedChange={(checked) => {
                                setBudgetAlertsEnabled(checked);
                                if (checked) {
                                    setShowAlert(true);
                                    setTimeout(() => setShowAlert(false), 5000);
                                } else {
                                    setShowAlert(false);
                                }
                            }}
                        />
                    </div>
                </div>
            </div>

            <AnimatePresence>
                {showAlert && (
                    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-[90%] max-w-md z-50">
                        <AlertBanner
                            variant="warning"
                            title="Budget Alerts Enabled"
                            description="You'll be notified when you exceed 80% of your budget."
                            onDismiss={() => setShowAlert(false)}
                            primaryAction={{
                                label: "Configure",
                                onClick: () => {
                                    setShowAlert(false);
                                    budgetInputRef.current?.focus();
                                    budgetInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                },
                            }}
                        />
                    </div>
                )}
            </AnimatePresence>

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

            {/* Logout */}
            <div className="pt-2">
                <button
                    onClick={handleSignOut}
                    className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors duration-200 border border-destructive/20"
                >
                    <LogOut className="w-4 h-4" />
                    <span className="font-medium text-sm">Log Out</span>
                </button>
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
