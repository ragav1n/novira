'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Home, Plus, BarChart2, Search, Settings, Users } from 'lucide-react';
// Use the new components from ui folder
import { ExpandableTabs } from '@/components/ui/expandable-tabs';
import { Toaster } from 'sonner';
import { cn } from '@/lib/utils';
import { useUserPreferences } from '@/components/providers/user-preferences-provider';
import { WaveLoader } from '@/components/ui/wave-loader';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';

export function MobileLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();


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
    const isAuthPage = ['/signin', '/signup', '/forgot-password', '/update-password'].includes(pathname);
    const { isAuthenticated, isLoading, isNavigating, setIsNavigating } = useUserPreferences();

    // Reset navigation loading when pathname changes
    useEffect(() => {
        setIsNavigating(false);
    }, [pathname, setIsNavigating]);

    const handleTabChange = (index: number | null) => {
        if (index !== null) {
            const route = routes[index];
            if (route && route !== pathname) {
                setIsNavigating(true);
                router.push(route);
            }
        }
    };

    const showNav = !isAuthPage && isAuthenticated;

    if (isLoading) {
        return null;
    }

    return (
        <div className="min-h-screen w-full bg-background text-foreground relative overflow-hidden font-sans select-none flex flex-col">

            {/* Main Content Area */}
            <main className={cn(
                "flex-1 w-full overflow-y-auto no-scrollbar relative flex flex-col",
                showNav ? "pb-24" : "pb-0"
            )}>
                {children}
            </main>

            {/* Bottom Navigation */}
            {showNav && (
                <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4">
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
                {isNavigating && (
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
