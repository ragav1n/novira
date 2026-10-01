'use client';

import { useState, useEffect } from 'react';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray.buffer;
}

// Detach this browser's push channel from the signed-in user. Called before
// sign-out: the subscription and its server row otherwise outlive the session,
// so the previous user's bills and split requests keep arriving on a device
// someone else is now signed into. Must run while the session is still valid
// (the DELETE is authenticated). The browser subscription is dropped even if
// the request fails — the next send to it then 410s and the server prunes the row.
export async function detachPushSubscription(): Promise<void> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager?.getSubscription();
        if (!sub) return;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3000);
        try {
            await fetch('/api/push/subscribe', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ endpoint: sub.endpoint }),
                signal: controller.signal,
            });
        } catch (err) {
            console.error('[Push] Detach request failed:', err);
        } finally {
            clearTimeout(timer);
        }
        await sub.unsubscribe();
    } catch (err) {
        console.error('[Push] Detach failed:', err);
    }
}

export type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported';

export function usePushNotifications() {
    const [permission, setPermission] = useState<PushPermission>('default');
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [loading, setLoading] = useState(false);

    const isSupported = typeof window !== 'undefined' &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        !!VAPID_PUBLIC_KEY;

    useEffect(() => {
        if (!isSupported) {
            setPermission('unsupported');
            return;
        }
        setPermission(Notification.permission as PushPermission);

        // Check current subscription state
        navigator.serviceWorker.ready.then(reg =>
            reg.pushManager.getSubscription()
        ).then(sub => {
            setIsSubscribed(!!sub);
        });
    }, [isSupported]);

    const subscribe = async (): Promise<boolean> => {
        if (!isSupported || !VAPID_PUBLIC_KEY) return false;
        setLoading(true);
        try {
            const perm = await Notification.requestPermission();
            setPermission(perm as PushPermission);
            if (perm !== 'granted') return false;

            const reg = await navigator.serviceWorker.ready;
            const subscription = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            });

            const res = await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(subscription.toJSON()),
            });

            if (res.ok) {
                setIsSubscribed(true);
                return true;
            }
            return false;
        } catch (err) {
            console.error('[Push] Subscribe failed:', err);
            return false;
        } finally {
            setLoading(false);
        }
    };

    const unsubscribe = async (): Promise<boolean> => {
        if (!isSupported) return false;
        setLoading(true);
        try {
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.getSubscription();
            if (!sub) { setIsSubscribed(false); return true; }

            await fetch('/api/push/subscribe', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ endpoint: sub.endpoint }),
            });
            await sub.unsubscribe();
            setIsSubscribed(false);
            return true;
        } catch (err) {
            console.error('[Push] Unsubscribe failed:', err);
            return false;
        } finally {
            setLoading(false);
        }
    };

    return { isSupported, permission, isSubscribed, loading, subscribe, unsubscribe };
}
