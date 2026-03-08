'use client';

import { useState, useEffect } from 'react';

/**
 * Returns true when the app is running inside a Capacitor native shell
 * (i.e. on a real iOS/Android device or simulator), false in a browser.
 *
 * Safe to use server-side (returns false during SSR).
 */
export function useIsNative(): boolean {
    const [isNative, setIsNative] = useState(false);

    useEffect(() => {
        // Capacitor injects this global when running in a native shell
        const cap = (window as any).Capacitor;

        if (cap) {
            const platform = cap.getPlatform?.();

            // In Capacitor 5+, isNative might be missing, but platform will be 'ios' or 'android'
            const native = platform === 'ios' || platform === 'android';
            setIsNative(native);
        } else {
            setIsNative(false);
        }
    }, []);

    return isNative;
}
