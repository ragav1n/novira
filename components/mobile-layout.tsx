'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Home, Plus, BarChart2, Search, Settings } from 'lucide-react';
// Use the new components from ui folder
import { FallingPattern } from '@/components/ui/falling-pattern';
import { ExpandableTabs } from '@/components/ui/expandable-tabs';
import { Toaster } from 'sonner';

export function MobileLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();


    const tabs = [
        { title: "Home", icon: Home },
        { title: "Add", icon: Plus },
        { title: "Analytics", icon: BarChart2 },
        { type: "separator" } as const,
        { title: "Search", icon: Search },
        { title: "Settings", icon: Settings },
    ];

    const routes = ['/', '/add', '/analytics', null, '/search', '/settings'];

    const handleTabChange = (index: number | null) => {
        if (index !== null) {
            const route = routes[index];
            if (route) {
                router.push(route);
            }
        }
    };

    const pathname = usePathname();
    const isAuthPage = ['/signin', '/signup'].includes(pathname);

    return (
        <div className="min-h-screen w-full bg-background text-foreground relative overflow-hidden font-sans select-none">

            {/* Main Content Area */}
            <main className="h-full w-full pb-24 overflow-y-auto no-scrollbar relative z-10">
                {children}
            </main>

            {/* Bottom Navigation */}
            {!isAuthPage && (
                <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4">
                    <ExpandableTabs
                        tabs={tabs}
                        className="bg-background/80 backdrop-blur-xl border-white/10 shadow-2xl shadow-primary/20"
                        activeColor="text-primary bg-primary/10"
                        onChange={handleTabChange}
                    />
                </div>
            )}

            <Toaster />
        </div>
    );
}
