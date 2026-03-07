'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Home, Plus, BarChart2, Search, Settings, Users, Calendar, Target } from 'lucide-react';
import { ExpandableTabs } from '@/components/ui/expandable-tabs';
import { Toaster } from 'sonner';
import { cn } from '@/lib/utils';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { WaveLoader } from '@/components/ui/wave-loader';
import { UIBoundary } from '@/components/boundaries/ui-boundary';
import { AnimatePresence, motion } from 'framer-motion';
import { useIsNative } from '@/hooks/use-native';
import { useGroups } from '@/components/providers/groups-provider';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { App } from '@capacitor/app';
import { PWAUpdater } from '@/components/pwa-updater';

export function MobileLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const isNative = useIsNative();

    // Configure the native status bar to overlay (transparent)
    useEffect(() => {
        if (!isNative) return;
        import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
            StatusBar.setStyle({ style: Style.Dark });
            StatusBar.setOverlaysWebView({ overlay: true });
        }).catch(() => { });

        // Handle Deep Linking
        const setupDeepLinks = async () => {
            // 1. Handle URL events when the app is already open
            App.addListener('appUrlOpen', (data) => {
                console.log('[DeepLink] Received URL (open):', data.url);
                let path = '';
                if (data.url.includes('novira://')) {
                    path = '/' + data.url.replace('novira://', '').replace(/^\//, '');
                } else {
                    try {
                        const url = new URL(data.url);
                        path = url.pathname + url.search;
                    } catch (e) {
                        console.error('[DeepLink] Failed to parse URL:', data.url, e);
                    }
                }

                console.log('[DeepLink] Calculated path:', path);
                if (path) {
                    setTimeout(() => {
                        console.log('[DeepLink] Navigating to:', path);
                        router.push(path);
                    }, 100);
                }
            });

            // 2. Handle the URL that launched the app (cold start)
            const launchUrl = await App.getLaunchUrl();
            console.log('[DeepLink] Launch URL check:', launchUrl);

            if (launchUrl && launchUrl.url) {
                const url = launchUrl.url;
                console.log('[DeepLink] Received URL (launch):', url);
                let path = '';
                if (url.includes('novira://')) {
                    path = '/' + url.replace('novira://', '').replace(/^\//, '');
                } else {
                    try {
                        const parsed = new URL(url);
                        path = parsed.pathname + parsed.search;
                    } catch (e) { }
                }

                console.log('[DeepLink] Calculated path (launch):', path);
                // Navigate if it's not the default root (unless explicit)
                if (path && path !== '/') {
                    setTimeout(() => {
                        console.log('[DeepLink] Navigating (launch) to:', path);
                        router.push(path);
                    }, 500); // Slightly more delay for cold starts
                }
            }
        };

        setupDeepLinks();

        return () => {
            App.removeAllListeners();
        };
    }, [isNative, router]);

    const tabs = [
        { title: "Home", icon: Home },
        { title: "Add", icon: Plus },
        { title: "Analytics", icon: BarChart2 },
        { title: "Groups", icon: Users },
        { title: "Subs", icon: Calendar },
        { title: "Goals", icon: Target },
        { title: "Search", icon: Search },
        { type: "separator" } as const,
        { title: "Settings", icon: Settings },
    ];

    const routes = ['/', '/add', '/analytics', '/groups', '/subscriptions', '/goals', '/search', null, '/settings'];

    const pathname = usePathname();
    const isPublicPage = ['/privacy', '/terms'].includes(pathname);
    const isAuthPage = ['/signin', '/signup', '/forgot-password', '/update-password'].includes(pathname);
    const { isAuthenticated, isLoading, isNavigating, setIsNavigating, activeWorkspaceId } = useUserPreferences();
    const { groups } = useGroups();
    
    // Check if the current workspace is a romantic couple workspace AND we are on the dashboard
    const isCoupleWorkspace = groups.find(g => g.id === activeWorkspaceId)?.type === 'couple' && pathname === '/';

    // Reset navigation loading when pathname changes
    useEffect(() => {
        setIsNavigating(false);
    }, [pathname, setIsNavigating]);

    const handleTabChange = async (index: number | null) => {
        if (index !== null) {
            // Trigger haptic feedback on tap
            if (isNative) {
                Haptics.impact({ style: ImpactStyle.Light }).catch(() => { });
            }

            const route = routes[index];
            if (route && route !== pathname) {
                setIsNavigating(true);
                router.push(route);
            }
        }
    };

    const showNav = !isAuthPage && !isPublicPage && isAuthenticated;

    if (isLoading && !isPublicPage && !isAuthPage) {
        return null;
    }

    return (
        <div className={cn(
            "min-h-screen w-full bg-background text-foreground relative overflow-hidden font-sans select-none flex flex-col",
            isNative && "pt-[env(safe-area-inset-top)]"
        )}>
            {/* Global Background Glows */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 transition-colors duration-1000">
                <div className={cn(
                    "absolute -top-[10%] -left-[10%] w-[70%] h-[70%] rounded-full blur-[60px] opacity-[0.25] transition-colors duration-1000",
                    isCoupleWorkspace ? "bg-rose-600" : "bg-purple-600"
                )} />
                <div className={cn(
                    "absolute -bottom-[10%] -right-[10%] w-[60%] h-[60%] rounded-full blur-[50px] opacity-[0.2] transition-colors duration-1000",
                    isCoupleWorkspace ? "bg-rose-900" : "bg-purple-900"
                )} />
            </div>

            <div className={cn(
                "fixed inset-0 pointer-events-none z-0 transition-colors duration-1000",
                isCoupleWorkspace 
                    ? "bg-gradient-to-br from-rose-950/20 via-transparent to-transparent" 
                    : "bg-gradient-to-br from-purple-950/10 via-transparent to-transparent"
            )} />

            {/* Main Content Area */}
            <main className={cn(
                "flex-1 w-full overflow-y-auto no-scrollbar relative flex flex-col",
                showNav ? "pb-24" : "pb-0"
            )}>
                <UIBoundary>
                    <AnimatePresence mode="wait" initial={false}>
                        {children}
                    </AnimatePresence>
                </UIBoundary>
            </main>

            {/* Bottom Navigation */}
            {showNav && (
                <>
                    <PWAUpdater />
                    <div className={cn(
                        "fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4",
                        isNative && "bottom-[calc(1.5rem+env(safe-area-inset-bottom))]"
                    )}>
                        <ExpandableTabs
                            tabs={tabs}
                            className="bg-background/80 backdrop-blur-xl border-white/10 shadow-2xl shadow-primary/20"
                            activeColor="text-primary bg-primary/10"
                            onChange={handleTabChange}
                        />
                    </div>
                </>
            )}



            <Toaster />
        </div>
    );
}
