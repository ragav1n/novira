/**
 * Haptic feedback utility for PWA tactile responses.
 *
 * Wraps Sonner's `toast` to automatically trigger `navigator.vibrate` on
 * every `toast.success` call. Works natively on Android Chrome; gracefully
 * degrades on iOS Safari (which doesn't support the Vibration API).
 *
 * Usage: replace `import { toast } from 'sonner'`
 *        with    `import { toast } from '@/utils/haptics'`
 */

import { toast as sonnerToast } from 'sonner';
import type { ExternalToast } from 'sonner';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

// ---------------------------------------------------------------------------
// Vibration / Haptic Logic
// ---------------------------------------------------------------------------

/**
 * Executes a haptic impact based on the platform.
 * Supports Capacitor Haptics (Native) and Vibration API (Web/Android).
 */
async function triggerHaptic(style: ImpactStyle = ImpactStyle.Light) {
    try {
        // Native Capacitor Haptics (Priority)
        if (typeof window !== 'undefined') {
             await Haptics.impact({ style });
        }
    } catch {
        // Fallback to Web Vibration API for Android/Web browsers if Capacitor fails or is not available
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
            const pattern = style === ImpactStyle.Heavy ? [20] : [10];
            try {
                navigator.vibrate(pattern);
            } catch {
                // Silently ignore
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Drop-in replacement for Sonner's `toast`
// ---------------------------------------------------------------------------
type MessageArg = Parameters<typeof sonnerToast>[0];

function toastFn(message: MessageArg, options?: ExternalToast) {
    return sonnerToast(message, options);
}

// Forward all static methods from Sonner, override `success`
toastFn.success = (message: MessageArg, options?: ExternalToast) => {
    triggerHaptic(ImpactStyle.Light);
    return sonnerToast.success(message, { duration: 3000, ...options });
};

toastFn.error = (message: MessageArg, options?: ExternalToast) => {
    triggerHaptic(ImpactStyle.Heavy);
    return sonnerToast.error(message, { duration: 4000, ...options });
};

// Custom haptic triggers
toastFn.haptic = (style: ImpactStyle = ImpactStyle.Light) => {
    triggerHaptic(style);
};

toastFn.warning = sonnerToast.warning.bind(sonnerToast);
toastFn.info = sonnerToast.info.bind(sonnerToast);
toastFn.loading = sonnerToast.loading.bind(sonnerToast);
toastFn.promise = sonnerToast.promise.bind(sonnerToast);
toastFn.dismiss = sonnerToast.dismiss.bind(sonnerToast);
toastFn.custom = sonnerToast.custom.bind(sonnerToast);
toastFn.message = sonnerToast.message.bind(sonnerToast);

export { ImpactStyle };
export { toastFn as toast };
