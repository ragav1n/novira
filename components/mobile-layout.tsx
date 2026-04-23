'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Home, Plus, BarChart2, Search, Settings, Users, Calendar, Target } from 'lucide-react';
import Image from 'next/image';
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

// ─── Desktop Sidebar ──────────────────────────────────────────────────────────

const DESKTOP_NAV = [
    { title: 'Home',          icon: Home,     route: '/' },
    { title: 'Analytics',     icon: BarChart2, route: '/analytics' },
    { title: 'Groups',        icon: Users,    route: '/groups' },
    { title: 'Subscriptions', icon: Calendar, route: '/subscriptions' },
    { title: 'Goals',         icon: Target,   route: '/goals' },
    { title: 'Search',        icon: Search,   route: '/search' },
];

function DesktopSidebar({
    pathname,
    onNavigate,
    isCoupleWorkspace,
    isHomeWorkspace,
}: {
    pathname: string;
    onNavigate: (route: string) => void;
    isCoupleWorkspace: boolean;
    isHomeWorkspace: boolean;
}) {
    const activeText = isCoupleWorkspace ? 'text-rose-400' : isHomeWorkspace ? 'text-amber-400' : 'text-primary';
    const activeBg   = isCoupleWorkspace ? 'bg-rose-500/10' : isHomeWorkspace ? 'bg-amber-500/10' : 'bg-primary/10';
    const addBg      = isCoupleWorkspace
        ? 'bg-rose-600 hover:bg-rose-500'
        : isHomeWorkspace
            ? 'bg-amber-600 hover:bg-amber-500'
            : 'bg-primary hover:bg-primary/90';

    return (
        <aside className="fixed left-0 top-0 bottom-0 w-[240px] z-40 flex flex-col border-r border-white/5 bg-background">
            {/* Logo */}
            <div className="flex items-center gap-2.5 px-5 py-5">
                <Image
                    src="/Novira.png"
                    alt="Novira"
                    width={26}
                    height={26}
                    className="drop-shadow-[0_0_8px_rgba(138,43,226,0.6)]"
                />
                <span className="font-bold text-[15px] tracking-tight">Novira</span>
            </div>

            {/* Add Expense */}
            <div className="px-4 mb-3">
                <button
                    onClick={() => onNavigate('/add')}
                    className={cn(
                        'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white transition-colors',
                        addBg
                    )}
                >
                    <Plus className="w-4 h-4" />
                    Add Expense
                </button>
            </div>

            {/* Nav items */}
            <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
                {DESKTOP_NAV.map(({ title, icon: Icon, route }) => {
                    const isActive = pathname === route;
                    return (
                        <button
                            key={route}
                            onClick={() => onNavigate(route)}
                            className={cn(
                                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                                isActive
                                    ? cn(activeBg, activeText)
                                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                            )}
                        >
                            <Icon className="w-[18px] h-[18px] shrink-0" />
                            {title}
                        </button>
                    );
                })}
            </nav>

            {/* Settings */}
            <div className="px-3 pb-5 pt-2 border-t border-white/5">
                <button
                    onClick={() => onNavigate('/settings')}
                    className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                        pathname === '/settings'
                            ? cn(activeBg, activeText)
                            : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                    )}
                >
                    <Settings className="w-[18px] h-[18px] shrink-0" />
                    Settings
                </button>
            </div>
        </aside>
    );
}

// ─── Main Layout ──────────────────────────────────────────────────────────────

export function MobileLayout({ children, defaultIsDesktop = false }: { children: React.ReactNode; defaultIsDesktop?: boolean }) {
    const router = useRouter();
    const isNative = useIsNative();
    const [isDesktop, setIsDesktop] = useState(defaultIsDesktop);

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
                        setTimeout(() => { router.push(path); }, 100);
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
                        setTimeout(() => { router.push(path); }, 500);
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

    // Desktop breakpoint detection
    useEffect(() => {
        const mq = window.matchMedia('(min-width: 1024px)');
        setIsDesktop(mq.matches);
        const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

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

    const activeWorkspace = groups.find(g => g.id === activeWorkspaceId);
    const isCoupleWorkspace = activeWorkspace?.type === 'couple';
    const isHomeWorkspace = activeWorkspace?.type === 'home';

    useEffect(() => {
        setIsNavigating(false);
    }, [pathname, setIsNavigating]);

    useEffect(() => {
        if (!isAuthenticated) return;
        const navRoutes = ['/add', '/analytics', '/groups', '/subscriptions', '/goals', '/search', '/settings'];
        navRoutes.forEach(route => router.prefetch(route));

        import('@/components/analytics-view').catch(() => {});
        import('@/components/search-view').catch(() => {});
    }, [isAuthenticated, router]);

    useEffect(() => {
        const handleGlobalError = (event: ErrorEvent | PromiseRejectionEvent) => {
            const error = 'error' in event ? event.error : event.reason;
            if (error && (
                error.name === 'ChunkLoadError' ||
                error?.message?.includes('Loading chunk') ||
                error?.message?.includes('Failed to fetch')
            )) {
                console.error('Global ChunkLoadError detected:', error);

                setTimeout(() => {
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

    const handleDesktopNavigate = (route: string) => {
        if (route !== pathname) {
            setIsNavigating(true);
            router.push(route);
        }
    };

    const showNav = !isAuthPage && !isPublicPage && isAuthenticated;
    const showDesktop = isDesktop && !isNative && showNav;

    return (
        <MotionConfig reducedMotion="user">
        <div className={cn(
            "min-h-[100dvh] w-full bg-background text-foreground relative overflow-hidden font-sans select-none flex flex-col",
            isNative && "pt-[env(safe-area-inset-top)]",
            isCoupleWorkspace && "theme-couple",
            isHomeWorkspace && "theme-home"
        )}>
            {/* Global Background Glows */}
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

            {/* Desktop Sidebar */}
            {showDesktop && (
                <DesktopSidebar
                    pathname={pathname}
                    onNavigate={handleDesktopNavigate}
                    isCoupleWorkspace={isCoupleWorkspace ?? false}
                    isHomeWorkspace={isHomeWorkspace ?? false}
                />
            )}

            {/* Main Content */}
            <main id="main-content" tabIndex={-1} className={cn(
                "flex-1 w-full overflow-y-auto no-scrollbar relative flex flex-col",
                showDesktop ? "pl-[240px]" : (showNav ? "pb-24" : "pb-0")
            )}>
                <UIBoundary>
                    <AnimatePresence mode="wait" initial={false}>
                        {children}
                    </AnimatePresence>
                </UIBoundary>
            </main>

            {/* Bottom Navigation (mobile only) */}
            {showNav && !showDesktop && (
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
