'use client';

import { useEffect, useRef, useState } from 'react';
import { PWAUpdateDialog } from '@/components/pwa-update-dialog';

/** How long "Later" suppresses the update prompt before it may re-offer. */
const SNOOZE_MS = 60 * 60 * 1000;

export function PWAUpdater() {
    const [open, setOpen] = useState(false);
    const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
    // Timestamp, not a boolean: as a plain flag, "Later" suppressed the dialog for the
    // entire page session, so the 30-minute re-check below could never re-offer and the
    // update was silently never applied.
    const snoozedUntilRef = useRef(0);
    // Set once the user accepts, so the controllerchange reload below is expected.
    const updateAcceptedRef = useRef(false);

    useEffect(() => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

        const handleUpdate = (registration: ServiceWorkerRegistration) => {
            if (!registration.waiting) return;
            if (Date.now() < snoozedUntilRef.current) return;
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

        // Throttled: this fired on *every* return to the tab, so coming back from a
        // phone call could throw a full-screen modal over a half-filled /add form.
        let lastCheck = Date.now();
        const handleVisibilityChange = () => {
            if (document.visibilityState !== 'visible') return;
            if (Date.now() - lastCheck < SNOOZE_MS) return;
            lastCheck = Date.now();
            checkUpdate();
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        const interval = setInterval(() => { lastCheck = Date.now(); checkUpdate(); }, 30 * 60 * 1000);

        let refreshing = false;
        const handleControllerChange = () => {
            if (refreshing) return;
            // Another tab activating the update used to hard-reload this one with no
            // warning — even right after the user chose "Later". Only auto-reload when
            // this tab is the one that accepted.
            if (!updateAcceptedRef.current) return;
            refreshing = true;
            window.location.reload();
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
        updateAcceptedRef.current = true;
        registrationRef.current?.waiting?.postMessage({ type: 'SKIP_WAITING' });
        setOpen(false);
    };

    const handleLater = () => {
        snoozedUntilRef.current = Date.now() + SNOOZE_MS;
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
