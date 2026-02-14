/**
 * Strict Client-Side Rate Limiter for Authentication
 * 
 * Prevents spamming auth requests by enforcing a cooldown between attempts.
 * Uses sessionStorage to persist across page reloads in the same tab.
 */

const STORAGE_KEY = 'novira_auth_last_attempt';
const COOLDOWN_MS = 3000; // 3 seconds cooldown

export const authRateLimiter = {
    /**
     * Checks if the user is currently rate limited.
     * @returns { number } The remaining time in ms, or 0 if allowed.
     */
    check: (): number => {
        if (typeof window === 'undefined') return 0;

        const lastAttempt = sessionStorage.getItem(STORAGE_KEY);
        if (!lastAttempt) return 0;

        const timeSince = Date.now() - parseInt(lastAttempt, 10);
        if (timeSince < COOLDOWN_MS) {
            return COOLDOWN_MS - timeSince;
        }

        return 0;
    },

    /**
     * Records a new authentication attempt.
     */
    recordOK: () => {
        if (typeof window === 'undefined') return;
        sessionStorage.setItem(STORAGE_KEY, Date.now().toString());
    },

    /**
     * Clears the rate limit (optional, e.g. on successful login if desired, 
     * though keeping it strict is safer)
     */
    clear: () => {
        if (typeof window === 'undefined') return;
        sessionStorage.removeItem(STORAGE_KEY);
    }
};
