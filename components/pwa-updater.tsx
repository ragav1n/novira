'use client';

import { useEffect } from 'react';
import { toast } from '@/utils/haptics';
import { RefreshCcw } from 'lucide-react';

export function PWAUpdater() {
    useEffect(() => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

        const handleUpdate = (registration: ServiceWorkerRegistration) => {
            if (!registration.waiting) return;

            // Notify user that a new version is available
            toast('New Version Available', {
                description: 'Refresh to see the latest updates and features.',
                duration: Infinity,
                action: {
                    label: 'Update Now',
                    onClick: () => {
                        registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
                    },
                },
            });
        };

        // Check for updates on load
        const checkUpdate = async () => {
            if (!navigator.serviceWorker.controller) return; // Only check if we are controlled by a SW
            
            try {
                const registration = await navigator.serviceWorker.getRegistration();
                if (registration) {
                    console.log('PWA: Checking for updates...');
                    try {
                        await registration.update();
                    } catch (e) {
                        console.warn('PWA: Service worker update check failed:', e);
                    }

                    if (registration.waiting) {
                        handleUpdate(registration);
                    }
                }
            } catch (err) {
                console.error('PWA: Failed to get registration:', err);
            }
        };

        // Listen for new service worker finding an update
        navigator.serviceWorker.getRegistration().then((registration) => {
            if (registration) {
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                handleUpdate(registration);
                            }
                        });
                    }
                });
            }
        });

        // 1. Check on mount (after a short delay)
        const mountTimer = setTimeout(checkUpdate, 2000);

        // 2. Check every time the app comes into focus (foreground)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkUpdate();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // 3. Periodic check every 30 minutes
        const interval = setInterval(checkUpdate, 30 * 60 * 1000);

        return () => {
            clearTimeout(mountTimer);
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };

        // Reload the page once the new service worker takes over
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                refreshing = true;
                window.location.reload();
            }
        });
    }, []);

    return null;
}
