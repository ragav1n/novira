'use client';

import { useEffect, useRef, useState } from 'react';
import { PWAUpdateDialog } from '@/components/pwa-update-dialog';
import { updateAction, shouldOffer } from '@/lib/pwa-update';

/** How long "Later" suppresses the update prompt before it may re-offer. */
const SNOOZE_MS = 60 * 60 * 1000;
/** How often to ask the server whether a newer service worker exists. */
const CHECK_INTERVAL_MS = 30 * 60 * 1000;
/**
 * Grace period for a parked worker to take over after SKIP_WAITING before reloading
 * anyway. `controllerchange` normally lands first; this is the backstop so "Update
 * now" can never end in nothing happening.
 */
const ACTIVATION_GRACE_MS = 1500;

export function PWAUpdater() {
    const [open, setOpen] = useState(false);
    const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
    // Timestamp, not a boolean: as a plain flag, "Later" suppressed the dialog for the
    // entire page session, so the periodic re-check could never re-offer and the
    // update was silently never applied.
    const snoozedUntilRef = useRef(0);
    // Set once the user accepts, so the controllerchange reload below is expected.
    const updateAcceptedRef = useRef(false);
    // Guards a double reload (controllerchange racing the grace timer) and stops the
    // prompt re-opening over a reload that is already committed.
    const reloadingRef = useRef(false);
    // Whether this page was already under a worker's control. A first-ever install
    // claims the page and fires controllerchange too, which is not an update.
    const hadControllerRef = useRef(false);

    const reload = () => {
        if (reloadingRef.current) return;
        reloadingRef.current = true;
        window.location.reload();
    };

    useEffect(() => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

        let disposed = false;
        hadControllerRef.current = !!navigator.serviceWorker.controller;

        const offer = (registration: ServiceWorkerRegistration | null) => {
            if (disposed) return;
            if (!shouldOffer({
                now: Date.now(),
                snoozedUntil: snoozedUntilRef.current,
                reloading: reloadingRef.current,
                hadController: hadControllerRef.current,
            })) return;
            // Keep the registration so "Update now" can find a parked worker if there
            // is one. There usually isn't — see lib/pwa-update.ts.
            if (registration) registrationRef.current = registration;
            setOpen(true);
        };

        /**
         * Watch an incoming worker to the point where its assets are on disk, then
         * offer. Deliberately not gated on `registration.waiting`: sw.js skips waiting
         * during install, so by the time anything observable happens the worker has
         * already moved past `waiting` and that gate rejected every real update.
         */
        const watch = (registration: ServiceWorkerRegistration) => {
            const incoming = registration.installing || registration.waiting;
            if (!incoming) return;
            if (incoming.state === 'installed' || incoming.state === 'activated') {
                offer(registration);
                return;
            }
            const onStateChange = () => {
                if (incoming.state === 'installed' || incoming.state === 'activated') {
                    incoming.removeEventListener('statechange', onStateChange);
                    offer(registration);
                } else if (incoming.state === 'redundant') {
                    incoming.removeEventListener('statechange', onStateChange);
                }
            };
            incoming.addEventListener('statechange', onStateChange);
        };

        const onUpdateFound = (event: Event) => {
            watch(event.target as ServiceWorkerRegistration);
        };

        const checkUpdate = async () => {
            try {
                const registration = await navigator.serviceWorker.getRegistration();
                if (!registration || disposed) return;
                registrationRef.current = registration;
                try {
                    // Fires `updatefound` when the fetched sw.js differs. The cache name
                    // is randomised per build by scripts/inject-sw-version.js, so every
                    // deploy is byte-different and this reliably detects one.
                    await registration.update();
                } catch (e) {
                    console.warn('PWA: Service worker update check failed:', e);
                }
                // Covers a worker that installed before the listener was attached.
                watch(registration);
            } catch (err) {
                console.error('PWA: Failed to get registration:', err);
            }
        };

        navigator.serviceWorker.getRegistration().then((registration) => {
            if (!registration || disposed) return;
            registrationRef.current = registration;
            registration.addEventListener('updatefound', onUpdateFound);
            watch(registration);
        });

        const mountTimer = setTimeout(checkUpdate, 2000);

        // Throttled: this fired on *every* return to the tab, so coming back from a
        // phone call could throw a full-screen modal over a half-filled /add form.
        let lastCheck = Date.now();
        const handleVisibilityChange = () => {
            if (document.visibilityState !== 'visible') return;
            if (Date.now() - lastCheck < CHECK_INTERVAL_MS) return;
            lastCheck = Date.now();
            checkUpdate();
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        const interval = setInterval(() => { lastCheck = Date.now(); checkUpdate(); }, CHECK_INTERVAL_MS);

        const handleControllerChange = () => {
            // We asked for this — finish the job.
            if (updateAcceptedRef.current) {
                reload();
                return;
            }
            const wasControlled = hadControllerRef.current;
            hadControllerRef.current = !!navigator.serviceWorker.controller;
            if (!wasControlled) return;
            // A new worker claimed the page without being asked, which is the normal
            // path here because sw.js skips waiting at install. Its assets are live but
            // this document is still running the old bundle, so offer the restart rather
            // than yanking the page out from under a half-filled form.
            offer(registrationRef.current);
        };
        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

        return () => {
            disposed = true;
            clearTimeout(mountTimer);
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
            // Was never removed before, so a remount stacked a second listener and the
            // dialog could open twice for one update.
            registrationRef.current?.removeEventListener('updatefound', onUpdateFound);
        };
    }, []);

    const handleUpdateNow = () => {
        updateAcceptedRef.current = true;
        setOpen(false);
        const waiting = registrationRef.current?.waiting;
        if (updateAction(!!waiting) === 'activate-then-reload') {
            waiting!.postMessage({ type: 'SKIP_WAITING' });
            // controllerchange normally reloads first; this is the backstop.
            window.setTimeout(reload, ACTIVATION_GRACE_MS);
            return;
        }
        reload();
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
