// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authRateLimiter } from '../auth-rate-limiter';

describe('authRateLimiter', () => {
    beforeEach(() => {
        sessionStorage.clear();
        localStorage.clear();
        authRateLimiter.clear();
        vi.useRealTimers();
    });

    describe('check — no prior attempt', () => {
        it('returns 0 (allowed) when no attempt has been recorded for login', () => {
            expect(authRateLimiter.check('login')).toBe(0);
        });

        it('returns 0 (allowed) when no attempt has been recorded for signup', () => {
            expect(authRateLimiter.check('signup')).toBe(0);
        });

        it('returns 0 (allowed) when no attempt has been recorded for verify', () => {
            expect(authRateLimiter.check('verify')).toBe(0);
        });
    });

    describe('recordOK and check', () => {
        it('blocks login immediately after recording', () => {
            authRateLimiter.recordOK('login');
            const remaining = authRateLimiter.check('login');
            expect(remaining).toBeGreaterThan(0);
            expect(remaining).toBeLessThanOrEqual(3000);
        });

        it('blocks signup immediately after recording', () => {
            authRateLimiter.recordOK('signup');
            const remaining = authRateLimiter.check('signup');
            expect(remaining).toBeGreaterThan(0);
            expect(remaining).toBeLessThanOrEqual(60000);
        });

        it('blocks verify immediately after recording', () => {
            authRateLimiter.recordOK('verify');
            const remaining = authRateLimiter.check('verify');
            expect(remaining).toBeGreaterThan(0);
            expect(remaining).toBeLessThanOrEqual(60000);
        });
    });

    describe('cooldown expiry', () => {
        it('allows login after 3 seconds have passed', () => {
            vi.useFakeTimers();
            authRateLimiter.recordOK('login');
            vi.advanceTimersByTime(3001);
            expect(authRateLimiter.check('login')).toBe(0);
        });

        it('still blocks login before 3 seconds have passed', () => {
            vi.useFakeTimers();
            authRateLimiter.recordOK('login');
            vi.advanceTimersByTime(1000);
            expect(authRateLimiter.check('login')).toBeGreaterThan(0);
        });
    });

    describe('storage separation', () => {
        it('uses sessionStorage for login', () => {
            authRateLimiter.recordOK('login');
            expect(sessionStorage.getItem('novira_auth_limit_login')).not.toBeNull();
        });

        it('uses localStorage for signup', () => {
            authRateLimiter.recordOK('signup');
            expect(localStorage.getItem('novira_auth_limit_signup')).not.toBeNull();
        });

        it('uses localStorage for verify', () => {
            authRateLimiter.recordOK('verify');
            expect(localStorage.getItem('novira_auth_limit_verify')).not.toBeNull();
        });
    });

    describe('clear', () => {
        it('clears all rate limit records', () => {
            authRateLimiter.recordOK('login');
            authRateLimiter.recordOK('signup');
            authRateLimiter.recordOK('verify');
            authRateLimiter.clear();
            expect(authRateLimiter.check('login')).toBe(0);
            expect(authRateLimiter.check('signup')).toBe(0);
            expect(authRateLimiter.check('verify')).toBe(0);
        });
    });

    describe('default action', () => {
        it('defaults to login action', () => {
            authRateLimiter.recordOK();
            const remaining = authRateLimiter.check();
            expect(remaining).toBeGreaterThan(0);
        });
    });
});
