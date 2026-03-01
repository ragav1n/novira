'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';

export function SyncIndicator() {
    const [isSyncing, setIsSyncing] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        if (typeof window === 'undefined') return;

        // Intercept fetch requests to detect background syncs from the service worker
        const originalFetch = window.fetch;
        
        window.fetch = async (...args) => {
            const [resource, config] = args;
            let url = '';
            
            if (typeof resource === 'string') {
                url = resource;
            } else if (resource instanceof Request) {
                url = resource.url;
            } else if (resource instanceof URL) {
                url = resource.href;
            }

            // Look for non-auth Supabase GET requests which the service worker intercepts
            const isSupabaseDataRequest = 
                url.includes('supabase.co') && 
                !url.includes('/auth/v1/') && 
                (!config?.method || config.method.toUpperCase() === 'GET');

            let fetchPromise;
            
            if (isSupabaseDataRequest) {
                fetchPromise = originalFetch(...args);
                
                fetchPromise.then((response: Response) => {
                    // If the response came from the cache (our custom header),
                    // we show the sync indicator because the SW is fetching in the background.
                    const isFromCache = response.headers.get('X-From-Cache') === 'true';
                    
                    if (isFromCache) {
                        setIsSyncing(true);
                        // The background network fetch in the SW takes time.
                        // We simulate the finish by hiding it after a short delay or 
                        // when the network might reasonably finish. SWR guarantees the SW updates cache.
                        // For a pure PWA, listening to a broadcast channel is better, 
                        // but a timeout provides a good enough UX without complex SW messaging bridging.
                        setTimeout(() => setIsSyncing(false), 1500);
                    }
                }).catch(() => {
                    // Ignore errors for the indicator
                });
            } else {
                fetchPromise = originalFetch(...args);
            }

            return fetchPromise;
        };

        return () => {
            window.fetch = originalFetch;
        };
    }, []);

    // Don't show on auth pages
    const isAuthPage = ['/signin', '/signup', '/forgot-password', '/update-password'].includes(pathname);
    if (isAuthPage) return null;

    return (
        <AnimatePresence>
            {isSyncing && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className={cn(
                        "fixed top-safe left-1/2 -translate-x-1/2 z-50",
                        "mt-2 flex items-center justify-center pointer-events-none"
                    )}
                >
                    <div className="bg-background/80 backdrop-blur-md border border-white/10 shadow-lg rounded-full px-3 py-1.5 flex items-center gap-2">
                        <RefreshCcw className="w-3.5 h-3.5 text-primary animate-spin" />
                        <span className="text-xs font-medium text-muted-foreground">Syncing...</span>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
