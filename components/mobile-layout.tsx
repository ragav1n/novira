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
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import { useIsNative } from '@/hooks/use-native';
import { useGroups } from '@/components/providers/groups-provider';
import { PWAUpdater } from '@/components/pwa-updater';
import { toast, ImpactStyle } from '@/utils/haptics';

export function MobileLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const isNative = useIsNative();

    // Configure the native status bar to overlay (transparent) and handle deep links
    useEffect(() => {
        if (!isNative) return;
        
        const initNative = async () => {
            try {
                const [{ StatusBar, Style }] = await Promise.all([
                    import('@capacitor/status-bar'),
                ]);
                StatusBar.setStyle({ style: Style.Dark });
                StatusBar.setOverlaysWebView({ overlay: true });

                // Handle Deep Linking
                const { App } = await import('@capacitor/app');
                
                App.addListener('appUrlOpen', (data) => {
                    let path = '';
                    if (data.url.includes('novira://')) {
                        path = '/' + data.url.replace('novira://', '').replace(/^\//, '');
                    } else {
                        try {
                            const url = new URL(data.url);
                            path = url.pathname + url.search;
                        } catch (e) {
                            console.warn('[MobileLayout] Failed to parse deep link URL:', e);
                        }
                    }

                    if (path) {
                        setTimeout(() => {
                            router.push(path);
                        }, 100);
                    }
                });

                const launchUrl = await App.getLaunchUrl();
                if (launchUrl && launchUrl.url) {
                    const url = launchUrl.url;
                    let path = '';
                    if (url.includes('novira://')) {
                        path = '/' + url.replace('novira://', '').replace(/^\//, '');
                    } else {
                        try {
                            const parsed = new URL(url);
                            path = parsed.pathname + parsed.search;
                        } catch (e) {
                            console.warn('[MobileLayout] Failed to parse launch URL:', e);
                        }
                    }

                    if (path && path !== '/') {
                        setTimeout(() => {
                            router.push(path);
                        }, 500);
                    }
                }
            } catch (error) {
                console.error('[MobileLayout] Native initialization failed:', error);
            }
        };

        initNative();

        return () => {
            import('@capacitor/app').then(({ App }) => App.removeAllListeners()).catch((e) => {
                console.warn('[MobileLayout] Failed to remove App listeners:', e);
            });
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
    const isPublicPage = ['/privacy', '/terms', '/landing'].includes(pathname);
    const isAuthPage = ['/signin', '/signup', '/forgot-password', '/update-password'].includes(pathname);
    const { isAuthenticated, isLoading, isNavigating, setIsNavigating, activeWorkspaceId } = useUserPreferences();
    const { groups } = useGroups();
    
    // Check if the current workspace is a specific group type
    const activeWorkspace = groups.find(g => g.id === activeWorkspaceId);
    const isCoupleWorkspace = activeWorkspace?.type === 'couple';
    const isHomeWorkspace = activeWorkspace?.type === 'home';

    // Reset navigation loading when pathname changes
    useEffect(() => {
        setIsNavigating(false);
    }, [pathname, setIsNavigating]);

    // Prefetch all nav routes once authenticated so first navigation is instant
    useEffect(() => {
        if (!isAuthenticated) return;
        const navRoutes = ['/add', '/analytics', '/groups', '/subscriptions', '/goals', '/search', '/settings'];
        navRoutes.forEach(route => router.prefetch(route));

        // Also prefetch the view components that are dynamically imported inside their routes.
        // router.prefetch() covers the route chunk but not nested dynamic() imports.
        import('@/components/analytics-view').catch(() => {});
        import('@/components/search-view').catch(() => {});
    }, [isAuthenticated, router]);

    // Global error handler for ChunkLoadErrors
    useEffect(() => {
        const handleGlobalError = (event: ErrorEvent | PromiseRejectionEvent) => {
            const error = 'error' in event ? event.error : event.reason;
            if (error && (
                error.name === 'ChunkLoadError' || 
                error?.message?.includes('Loading chunk') || 
                error?.message?.includes('Failed to fetch')
            )) {
                console.error('Global ChunkLoadError detected:', error);
                
                // If we detect a chunk error globally, it's often best to just reload 
                // but we'll wait a brief moment to see if an ErrorBoundary catches it first
                setTimeout(() => {
                    // Only reload if the user hasn't already been presented with an error boundary
                    // Simple check: is there a "Display Error" or "Update Available" heading?
                    const hasErrorUI = document.body.innerText.includes('Display Error') || 
                                     document.body.innerText.includes('Update Available');
                    
                    if (!hasErrorUI) {
                        window.location.reload();
                    }
                }, 1000);
            }
        };

        window.addEventListener('error', handleGlobalError);
        window.addEventListener('unhandledrejection', handleGlobalError);

        return () => {
            window.removeEventListener('error', handleGlobalError);
            window.removeEventListener('unhandledrejection', handleGlobalError);
        };
    }, []);

    const handleTabChange = async (index: number | null) => {
        if (index !== null) {
            // Trigger haptic feedback on tap
            if (isNative) {
                toast.haptic(ImpactStyle.Light);
            }

            const route = routes[index];
            if (route && route !== pathname) {
                setIsNavigating(true);
                router.push(route);
            }
        }
    };

    const showNav = !isAuthPage && !isPublicPage && isAuthenticated;

    return (
        <MotionConfig reducedMotion="user">
        <div className={cn(
            "min-h-[100dvh] w-full bg-background text-foreground relative overflow-hidden font-sans select-none flex flex-col",
            isNative && "pt-[env(safe-area-inset-top)]",
            isCoupleWorkspace && "theme-couple",
            isHomeWorkspace && "theme-home"
        )}>
            {/* Global Background Glows - Matching Dashboard exactly */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 transition-colors duration-500 gpu">
                <div className={cn(
                    "absolute top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full opacity-10 gpu transition-colors duration-500 glow-optimized",
                    isCoupleWorkspace ? "bg-rose-500" : isHomeWorkspace ? "bg-yellow-500" : "bg-primary"
                )} />
                <div className={cn(
                    "absolute bottom-[20%] -left-[10%] w-[40%] h-[40%] rounded-full opacity-5 gpu transition-colors duration-500 glow-optimized",
                    isCoupleWorkspace ? "bg-rose-500" : isHomeWorkspace ? "bg-amber-500" : "bg-primary/40"
                )} />
            </div>

            <div className={cn(
                "fixed inset-0 pointer-events-none z-0 transition-colors duration-500",
                isCoupleWorkspace 
                    ? "bg-gradient-to-br from-rose-950/10 via-transparent to-transparent" 
                    : isHomeWorkspace
                        ? "bg-gradient-to-br from-amber-950/10 via-transparent to-transparent"
                        : "bg-gradient-to-br from-primary/10 via-transparent to-transparent"
            )} />

            {/* Main Content Area */}
            <main id="main-content" tabIndex={-1} className={cn(
                "flex-1 w-full overflow-y-auto no-scrollbar relative flex flex-col",
                (showNav) ? "pb-24" : "pb-0"
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



            <Toaster
                toastOptions={{
                    style: { zIndex: 99999 },
                    duration: 3000,
                }}
                duration={3000}
            />
        </div>
        </MotionConfig>
    );
}
