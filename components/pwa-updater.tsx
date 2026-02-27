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
        navigator.serviceWorker.getRegistration().then((registration) => {
            if (registration) {
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
        });

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
