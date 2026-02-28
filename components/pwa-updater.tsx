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
            try {
                const registration = await navigator.serviceWorker.getRegistration();
                if (registration) {
                    // Try to update, but catch potential "script not found" or "unknown" errors
                    // especially during rapid development/HMR
                    try {
                        await registration.update();
                    } catch (e) {
                        console.warn('PWA: Service worker update check failed (likely transient):', e);
                    }

                    if (registration.waiting) {
                        handleUpdate(registration);
                    }

                    // Listen for new service worker finding an update
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
            } catch (err) {
                console.error('PWA: Failed to get registration:', err);
            }
        };

        // Delay the check slightly to avoid race conditions with initial page load
        const timer = setTimeout(checkUpdate, 2000);
        return () => clearTimeout(timer);

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
