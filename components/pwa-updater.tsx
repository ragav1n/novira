'use client';

import { useEffect, useRef, useState } from 'react';
import { PWAUpdateDialog } from '@/components/pwa-update-dialog';

export function PWAUpdater() {
    const [open, setOpen] = useState(false);
    const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
    const dismissedRef = useRef(false);

    useEffect(() => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

        const handleUpdate = (registration: ServiceWorkerRegistration) => {
            if (!registration.waiting) return;
            if (dismissedRef.current) return;
            registrationRef.current = registration;
            setOpen(true);
        };

        const checkUpdate = async () => {
            if (!navigator.serviceWorker.controller) return;

            try {
                const registration = await navigator.serviceWorker.getRegistration();
                if (registration) {
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

        const mountTimer = setTimeout(checkUpdate, 2000);

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkUpdate();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        const interval = setInterval(checkUpdate, 30 * 60 * 1000);

        let refreshing = false;
        const handleControllerChange = () => {
            if (!refreshing) {
                refreshing = true;
                window.location.reload();
            }
        };
        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

        return () => {
            clearTimeout(mountTimer);
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
        };
    }, []);

    const handleUpdateNow = () => {
        registrationRef.current?.waiting?.postMessage({ type: 'SKIP_WAITING' });
        setOpen(false);
    };

    const handleLater = () => {
        dismissedRef.current = true;
        setOpen(false);
    };

    return (
        <PWAUpdateDialog
            open={open}
            onUpdate={handleUpdateNow}
            onLater={handleLater}
        />
    );
}
