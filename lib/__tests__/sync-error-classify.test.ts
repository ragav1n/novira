import { describe, it, expect } from 'vitest';
import { classifyAddError, classifyPgError, isPermanentStatus } from '../sync-error-classify';

const pg = (o: Record<string, unknown>) =>
    ({ message: 'boom', details: null, hint: null, code: '', ...o }) as never;

describe('isPermanentStatus', () => {
    /**
     * The bug: every 4xx was permanent, so a 401 — an access token that had
     * expired in the moment — retired the change for good. Combined with the
     * failed state not being persisted, one token blip wedged the queue forever.
     */
    it.each([401, 408, 429])('treats %i as retryable', (s) => {
        expect(isPermanentStatus(s)).toBe(false);
    });

    it.each([400, 403, 404, 409, 422])('treats %i as permanent', (s) => {
        expect(isPermanentStatus(s)).toBe(true);
    });

    it('treats 5xx and a missing status as retryable', () => {
        expect(isPermanentStatus(500)).toBe(false);
        expect(isPermanentStatus(503)).toBe(false);
        expect(isPermanentStatus(undefined)).toBe(false);
    });
});

describe('classifyAddError', () => {
    it('retries an expired token', () => {
        expect(classifyAddError({ status: 401, message: 'JWT expired' }).permanent).toBe(false);
    });

    it('abandons a genuine authorisation failure', () => {
        expect(classifyAddError({ code: '42501', message: 'permission denied' }).permanent).toBe(true);
        expect(classifyAddError({ status: 403, message: 'forbidden' }).permanent).toBe(true);
    });

    /**
     * create_transaction_atomic catches internally and returns
     * `{ success: false, error }` with HTTP 200, so the service throws a plain
     * Error. No code, no status — must stay retryable rather than being written off.
     */
    it('retries a bare Error from the RPC result', () => {
        const r = classifyAddError(new Error('new row violates check constraint'));
        expect(r.permanent).toBe(false);
        expect(r.reason).toMatch(/check constraint/);
    });

    it('retries a network failure', () => {
        expect(classifyAddError(new TypeError('Failed to fetch')).permanent).toBe(false);
    });

    it('retries a non-object throw', () => {
        expect(classifyAddError('nope')).toEqual({ permanent: false, reason: 'nope' });
    });

    it('prefixes the reason with the code when there is one', () => {
        expect(classifyAddError({ code: '42501', message: 'denied' }).reason).toBe('42501: denied');
        expect(classifyAddError({ message: 'denied' }).reason).toBe('denied');
    });
});

describe('classifyPgError', () => {
    it('retries 401 and abandons 42501', () => {
        expect(classifyPgError(pg({ status: 401 })).permanent).toBe(false);
        expect(classifyPgError(pg({ code: '42501' })).permanent).toBe(true);
    });

    it('abandons a missing singular row', () => {
        expect(classifyPgError(pg({ code: 'PGRST116' })).permanent).toBe(true);
    });

    it('retries when there is no status and no known code', () => {
        expect(classifyPgError(pg({ code: '08006', message: 'connection failure' })).permanent).toBe(false);
    });
});
