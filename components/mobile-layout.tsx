'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Home, Plus, BarChart2, Search, Settings, Users } from 'lucide-react';
import { ExpandableTabs } from '@/components/ui/expandable-tabs';
import { Toaster } from 'sonner';
import { cn } from '@/lib/utils';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { WaveLoader } from '@/components/ui/wave-loader';
import { AnimatePresence, motion } from 'framer-motion';
import { useIsNative } from '@/hooks/use-native';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { App } from '@capacitor/app';

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
        { type: "separator" } as const,
        { title: "Search", icon: Search },
        { title: "Settings", icon: Settings },
    ];

    const routes = ['/', '/add', '/analytics', '/groups', null, '/search', '/settings'];

    const pathname = usePathname();
    const isPublicPage = ['/privacy', '/terms'].includes(pathname);
    const isAuthPage = ['/signin', '/signup', '/forgot-password', '/update-password'].includes(pathname);
    const { isAuthenticated, isLoading, isNavigating, setIsNavigating } = useUserPreferences();

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

    // Navigation Loading State with slight delay to prevent flashing
    const [showLoader, setShowLoader] = React.useState(false);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isNavigating) {
            timer = setTimeout(() => setShowLoader(true), 200);
        } else {
            setShowLoader(false);
        }
        return () => clearTimeout(timer);
    }, [isNavigating]);

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
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute -top-[10%] -left-[10%] w-[70%] h-[70%] rounded-full blur-[120px] bg-purple-600 opacity-[0.25]" />
                <div className="absolute -bottom-[10%] -right-[10%] w-[60%] h-[60%] rounded-full blur-[100px] bg-purple-900 opacity-[0.2]" />
            </div>

            <div className="fixed inset-0 pointer-events-none bg-gradient-to-br from-purple-950/10 via-transparent to-transparent z-0" />

            {/* Main Content Area */}
            <main className={cn(
                "flex-1 w-full overflow-y-auto no-scrollbar relative flex flex-col",
                showNav ? "pb-24" : "pb-0"
            )}>
                {children}
            </main>

            {/* Bottom Navigation */}
            {showNav && (
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
            )}

            {/* Navigation Loading Overlay */}
            <AnimatePresence>
                {(isNavigating && showLoader) && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/40 backdrop-blur-md"
                    >
                        <WaveLoader bars={5} />
                    </motion.div>
                )}
            </AnimatePresence>

            <Toaster />
        </div>
    );
}
