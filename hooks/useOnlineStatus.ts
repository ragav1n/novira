import { useEffect, useState } from 'react';

export function useOnlineStatus(): boolean {
    // Always initialize as `true` on both server and client first render so SSR
    // markup matches client hydration markup. The actual value is read in useEffect
    // after mount — this avoids React hydration error #418 when the SW serves cached
    // HTML to an offline user (server says online=true, client sees navigator.onLine=false).
    const [online, setOnline] = useState<boolean>(true);

    useEffect(() => {
        // Sync to actual network state once mounted
        if (typeof navigator !== 'undefined' && navigator.onLine !== online) {
            setOnline(navigator.onLine);
        }
        const goOnline = () => setOnline(true);
        const goOffline = () => setOnline(false);
        window.addEventListener('online', goOnline);
        window.addEventListener('offline', goOffline);
        return () => {
            window.removeEventListener('online', goOnline);
            window.removeEventListener('offline', goOffline);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return online;
}
