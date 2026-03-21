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
