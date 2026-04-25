'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Home, Plus, BarChart2, Search, Settings, Users, Calendar, Target, Menu } from 'lucide-react';
import Image from 'next/image';
import { ExpandableTabs } from '@/components/ui/expandable-tabs';
import { Toaster } from 'sonner';
import { cn } from '@/lib/utils';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { WaveLoader } from '@/components/ui/wave-loader';
import { UIBoundary } from '@/components/boundaries/ui-boundary';
import { AnimatePresence, motion, MotionConfig, useScroll, useMotionValueEvent } from 'framer-motion';
import { useIsNative } from '@/hooks/use-native';
import { useGroups } from '@/components/providers/groups-provider';
import { PWAUpdater } from '@/components/pwa-updater';
import { toast, ImpactStyle } from '@/utils/haptics';

// ─── Desktop Top Nav ──────────────────────────────────────────────────────────

const DESKTOP_NAV = [
    { title: 'Home',     icon: Home,     route: '/' },
    { title: 'Add',      icon: Plus,     route: '/add' },
    { title: 'Analytics',icon: BarChart2, route: '/analytics' },
    { title: 'Groups',   icon: Users,    route: '/groups' },
    { title: 'Subs',     icon: Calendar, route: '/subscriptions' },
    { title: 'Goals',    icon: Target,   route: '/goals' },
    { title: 'Search',   icon: Search,   route: '/search' },
    { title: 'Settings', icon: Settings, route: '/settings' },
];

const containerVariants = {
    hidden: { y: -80, opacity: 0 },
    expanded: {
        y: 0,
        opacity: 1,
        width: 'auto',
        transition: {
            y: { type: 'spring' as const, damping: 28, stiffness: 200, mass: 0.9 },
            opacity: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
            width: { type: 'spring' as const, damping: 28, stiffness: 200, mass: 0.9 },
            staggerChildren: 0.05,
            delayChildren: 0.08,
        },
    },
    collapsed: {
        y: 0,
        opacity: 1,
        width: '2.75rem',
        transition: {
            y: { type: 'spring' as const, damping: 28, stiffness: 200, mass: 0.9 },
            opacity: { duration: 0.3, ease: [0.4, 0, 0.2, 1] as const },
            width: { type: 'spring' as const, damping: 28, stiffness: 200, mass: 0.9 },
            when: 'afterChildren' as const,
            staggerChildren: 0.035,
            staggerDirection: -1,
        },
    },
};

const expandedChildVariants = {
    expanded: { opacity: 1, x: 0, scale: 1, transition: { type: 'spring' as const, damping: 22, stiffness: 220, mass: 0.8 } },
    collapsed: { opacity: 0, x: -10, scale: 0.96, transition: { duration: 0.22, ease: [0.4, 0, 0.2, 1] as const } },
};

const burgerVariants = {
    expanded: { opacity: 0, scale: 0.7, transition: { duration: 0.22, ease: [0.4, 0, 0.2, 1] as const } },
    collapsed: { opacity: 1, scale: 1, transition: { type: 'spring' as const, damping: 22, stiffness: 240, mass: 0.8, delay: 0.14 } },
};

function DesktopTopNav({
    pathname,
    onNavigate,
    isCoupleWorkspace,
    isHomeWorkspace,
    scrollContainerRef,
}: {
    pathname: string;
    onNavigate: (route: string) => void;
    isCoupleWorkspace: boolean;
    isHomeWorkspace: boolean;
    scrollContainerRef: React.RefObject<HTMLElement | null>;
}) {
    const [isExpanded, setExpanded] = useState(true);
    const lastScrollY = useRef(0);
    const scrollPositionOnCollapse = useRef(0);

    const activeText = isCoupleWorkspace ? 'text-rose-400' : isHomeWorkspace ? 'text-amber-400' : 'text-primary';
    const activeBg   = isCoupleWorkspace ? 'bg-rose-500/10' : isHomeWorkspace ? 'bg-amber-500/10' : 'bg-primary/10';

    const { scrollY } = useScroll({ container: scrollContainerRef as React.RefObject<HTMLElement> });

    useMotionValueEvent(scrollY, 'change', (latest) => {
        const previous = lastScrollY.current;
        if (isExpanded && latest > previous && latest > 150) {
            setExpanded(false);
            scrollPositionOnCollapse.current = latest;
        } else if (!isExpanded && latest < previous && scrollPositionOnCollapse.current - latest > 80) {
            setExpanded(true);
        }
        lastScrollY.current = latest;
    });

    return (
        // MotionConfig override: the outer layout wraps everything in reducedMotion="user"
        // which would kill these animations — we opt the nav out of that.
        <MotionConfig reducedMotion="never">
            <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
                <motion.nav
                    initial="hidden"
                    animate={isExpanded ? 'expanded' : 'collapsed'}
                    variants={containerVariants}
                    whileHover={!isExpanded ? { scale: 1.06 } : {}}
                    whileTap={!isExpanded ? { scale: 0.96 } : {}}
                    onClick={() => !isExpanded && setExpanded(true)}
                    style={{ borderRadius: 999 }}
                    className={cn(
                        'relative flex items-center border border-white/10 bg-background/80 shadow-lg shadow-black/20 backdrop-blur-md h-11 overflow-hidden',
                        !isExpanded && 'cursor-pointer justify-center'
                    )}
                >
                    {/* Logo */}
                    <motion.div
                        variants={expandedChildVariants}
                        className="flex-shrink-0 flex items-center gap-2 pl-4 pr-3"
                    >
                        <Image
                            src="/Novira.png"
                            alt="Novira"
                            width={18}
                            height={18}
                            className="drop-shadow-[0_0_6px_rgba(138,43,226,0.6)]"
                        />
                        <span className="font-bold text-sm tracking-tight">Novira</span>
                    </motion.div>

                    <motion.div variants={expandedChildVariants} className="h-4 w-px bg-white/10 flex-shrink-0" />

                    {/* Nav items */}
                    <motion.div
                        className={cn(
                            'flex items-center gap-0.5 px-2',
                            !isExpanded && 'pointer-events-none'
                        )}
                    >
                        {DESKTOP_NAV.map(({ title, icon: Icon, route }) => {
                            const isActive = pathname === route;
                            return (
                                <motion.button
                                    key={route}
                                    variants={expandedChildVariants}
                                    onClick={(e) => { e.stopPropagation(); onNavigate(route); }}
                                    className={cn(
                                        'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
                                        isActive
                                            ? cn(activeBg, activeText)
                                            : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                                    )}
                                >
                                    <Icon className="w-3.5 h-3.5 shrink-0" />
                                    <span>{title}</span>
                                </motion.button>
                            );
                        })}
                    </motion.div>

                    <motion.div variants={expandedChildVariants} className="w-2 flex-shrink-0" />

                    {/* Burger icon — fades in when collapsed */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <motion.div variants={burgerVariants} animate={isExpanded ? 'expanded' : 'collapsed'}>
                            <Menu className="h-5 w-5" />
                        </motion.div>
                    </div>
                </motion.nav>
            </div>
        </MotionConfig>
    );
}

// ─── Main Layout ──────────────────────────────────────────────────────────────

export function MobileLayout({ children, defaultIsDesktop = false }: { children: React.ReactNode; defaultIsDesktop?: boolean }) {
    const router = useRouter();
    const isNative = useIsNative();
    const [isDesktop, setIsDesktop] = useState(defaultIsDesktop);
    const mainRef = useRef<HTMLElement>(null);

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
            // h-[100dvh] (not min-h) so <main> is the scroll container — required for the
            // desktop nav's useScroll(mainRef) to fire collapse on scroll-down.
            "h-[100dvh] w-full bg-background text-foreground relative overflow-hidden font-sans select-none flex flex-col",
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

            {/* Desktop Top Nav */}
            {showDesktop && (
                <DesktopTopNav
                    pathname={pathname}
                    onNavigate={handleDesktopNavigate}
                    isCoupleWorkspace={isCoupleWorkspace ?? false}
                    isHomeWorkspace={isHomeWorkspace ?? false}
                    scrollContainerRef={mainRef}
                />
            )}

            {/* Main Content */}
            <main ref={mainRef} id="main-content" tabIndex={-1} className={cn(
                "flex-1 w-full overflow-y-auto no-scrollbar relative flex flex-col",
                showDesktop ? "pt-20" : (showNav ? "pb-24" : "pb-0")
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
