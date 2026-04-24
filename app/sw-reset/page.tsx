'use client';

import { useEffect, useState } from 'react';

export default function SWResetPage() {
    const [done, setDone] = useState(false);

    useEffect(() => {
        async function reset() {
            try {
                if ('serviceWorker' in navigator) {
                    const regs = await navigator.serviceWorker.getRegistrations();
                    await Promise.all(regs.map(r => r.unregister()));
                }
                if ('caches' in window) {
                    const keys = await caches.keys();
                    await Promise.all(keys.map(k => caches.delete(k)));
                }
                localStorage.clear();
            } catch (e) {
                console.warn('[sw-reset]', e);
            }
            setDone(true);
            window.location.replace('/');
        }
        reset();
    }, []);

    return (
        <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-3 bg-background text-foreground">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground font-medium">
                {done ? 'Done' : 'Resetting app...'}
            </p>
        </div>
    );
}
