/**
 * Strict Client-Side Rate Limiter for Authentication
 * 
 * Prevents spamming auth requests by enforcing a cooldown between attempts.
 * Uses sessionStorage to persist across page reloads in the same tab.
 */

const STORAGE_KEY_PREFIX = 'novira_auth_limit_';
const COOLDOWN_LOGIN = 3000; // 3 seconds for login
const COOLDOWN_SIGNUP = 60000; // 60 seconds for signup (email triggers)

type AuthAction = 'login' | 'signup';

export const authRateLimiter = {
    /**
     * Checks if the user is currently rate limited for a specific action.
     * @param action 'login' or 'signup'
     * @returns { number } The remaining time in ms, or 0 if allowed.
     */
    check: (action: AuthAction = 'login'): number => {
        if (typeof window === 'undefined') return 0;

        const key = `${STORAGE_KEY_PREFIX}${action}`;
        const storage = action === 'signup' ? localStorage : sessionStorage;

        const lastAttempt = storage.getItem(key);
        if (!lastAttempt) return 0;

        const cooldown = action === 'signup' ? COOLDOWN_SIGNUP : COOLDOWN_LOGIN;
        const timeSince = Date.now() - parseInt(lastAttempt, 10);

        if (timeSince < cooldown) {
            return cooldown - timeSince;
        }

        return 0;
    },

    /**
     * Records a new authentication attempt.
     * @param action 'login' or 'signup'
     */
    recordOK: (action: AuthAction = 'login') => {
        if (typeof window === 'undefined') return;

        const key = `${STORAGE_KEY_PREFIX}${action}`;
        const storage = action === 'signup' ? localStorage : sessionStorage;

        storage.setItem(key, Date.now().toString());
    },

    /**
     * Clears the rate limit
     */
    clear: () => {
        if (typeof window === 'undefined') return;
        sessionStorage.removeItem(`${STORAGE_KEY_PREFIX}login`);
        localStorage.removeItem(`${STORAGE_KEY_PREFIX}signup`);
    }
};
