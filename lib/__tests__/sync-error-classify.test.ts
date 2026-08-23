import { describe, it, expect } from 'vitest';
import { classifyAddError, classifyPgError, isPermanentStatus, RPC_REJECTED } from '../sync-error-classify';

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

    /**
     * create_transaction_atomic answers HTTP 200 with `{ success: false, error: SQLERRM }`,
     * so a constraint violation used to arrive with no code and burn five retries before
     * the reason was overwritten with 'Max retries exceeded'. The service now tags it.
     */
    it('abandons a rejection the RPC returned as HTTP 200', () => {
        const err = Object.assign(new Error('violates check constraint "positive_amount_check"'), { code: RPC_REJECTED });
        const { permanent, reason } = classifyAddError(err);
        expect(permanent).toBe(true);
        // The synthetic code is a marker, not something to show the user.
        expect(reason).toBe('violates check constraint "positive_amount_check"');
    });

    it('abandons a deterministic SQLSTATE but retries a contended one', () => {
        expect(classifyAddError({ code: '23514', message: 'check violation' }).permanent).toBe(true);
        expect(classifyAddError({ code: '22P02', message: 'invalid input syntax' }).permanent).toBe(true);
        expect(classifyAddError({ code: 'P0001', message: 'raised by a trigger' }).permanent).toBe(true);
        expect(classifyAddError({ code: '40001', message: 'serialization failure' }).permanent).toBe(false);
        expect(classifyAddError({ code: '40P01', message: 'deadlock detected' }).permanent).toBe(false);
        expect(classifyAddError({ code: '55P03', message: 'lock not available' }).permanent).toBe(false);
    });

    /**
     * Retiring a queued expense because Supabase restarted the database would be a
     * worse bug than the misclassification this whole path exists to fix.
     */
    it('retries an unavailable server rather than retiring the change', () => {
        expect(classifyAddError({ code: '57P01', message: 'terminating connection due to administrator command' }).permanent).toBe(false);
        expect(classifyAddError({ code: '57P03', message: 'cannot connect now' }).permanent).toBe(false);
        expect(classifyAddError({ code: '08006', message: 'connection failure' }).permanent).toBe(false);
        expect(classifyAddError({ code: '53300', message: 'too many connections' }).permanent).toBe(false);
    });

    it('does not mistake a PostgREST code for a SQLSTATE', () => {
        expect(classifyAddError({ code: 'PGRST116', message: 'no rows' }).permanent).toBe(true);
        // Eight characters, so the SQLSTATE rule must not fire; PostgREST sends these
        // with a real HTTP status, which is what decides them.
        expect(classifyAddError({ code: 'PGRST202', status: 404, message: 'no function matches' }).permanent).toBe(true);
    });

    /** StorageApiError reports its status as a string, which the numeric check missed. */
    it('reads the string statusCode Supabase Storage errors carry', () => {
        expect(classifyAddError({ statusCode: '403', message: 'new row violates row-level security policy' }).permanent).toBe(true);
        expect(classifyAddError({ statusCode: '413', message: 'payload too large' }).permanent).toBe(true);
        expect(classifyAddError({ statusCode: '429', message: 'slow down' }).permanent).toBe(false);
        expect(classifyAddError({ statusCode: '500', message: 'upstream' }).permanent).toBe(false);
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
