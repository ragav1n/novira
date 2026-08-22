import { describe, it, expect } from 'vitest';
import {
    RECEIPT_ACCEPT,
    RECEIPT_MIME_TYPES,
    validateReceiptFile,
    isPdf,
    extFromMime,
} from '../receipt-file';

const blobOf = (type: string, size = 1024) =>
    new Blob([new Uint8Array(size)], { type });

/**
 * The bug this guards: the gallery input was a hand-written `accept="image/*"`
 * while the validator and the viewer both supported PDFs. Nothing errored — the
 * option simply never existed, so PDF support was dead code for months.
 */
describe('RECEIPT_ACCEPT stays in step with the validator', () => {
    it('offers every type the validator accepts', () => {
        const offered = RECEIPT_ACCEPT.split(',');
        expect(offered.sort()).toEqual([...RECEIPT_MIME_TYPES].sort());
    });

    it('offers nothing the validator would reject', () => {
        for (const mime of RECEIPT_ACCEPT.split(',')) {
            expect(validateReceiptFile(blobOf(mime)), mime).toEqual({ valid: true });
        }
    });

    it('includes PDF, since the viewer has a PDF branch', () => {
        expect(RECEIPT_ACCEPT).toContain('application/pdf');
    });

    it('uses no wildcard — a wildcard is what allowed the drift', () => {
        expect(RECEIPT_ACCEPT).not.toContain('*');
    });

    it('maps every accepted type to a real extension', () => {
        for (const mime of RECEIPT_MIME_TYPES) {
            expect(extFromMime(mime), mime).not.toBe('bin');
        }
    });
});

describe('validateReceiptFile', () => {
    it('rejects an unsupported type', () => {
        const r = validateReceiptFile(blobOf('image/gif'));
        expect(r.valid).toBe(false);
    });

    it('rejects a typeless blob', () => {
        expect(validateReceiptFile(new Blob([new Uint8Array(8)])).valid).toBe(false);
    });

    it('rejects anything over 8 MB', () => {
        const r = validateReceiptFile(blobOf('image/jpeg', 8 * 1024 * 1024 + 1));
        expect(r.valid).toBe(false);
        if (!r.valid) expect(r.reason).toMatch(/too large/i);
    });

    it('accepts exactly 8 MB', () => {
        expect(validateReceiptFile(blobOf('image/jpeg', 8 * 1024 * 1024)).valid).toBe(true);
    });
});

describe('isPdf', () => {
    it('identifies PDFs and nothing else', () => {
        expect(isPdf(blobOf('application/pdf'))).toBe(true);
        expect(isPdf(blobOf('image/jpeg'))).toBe(false);
        expect(isPdf(new Blob([]))).toBe(false);
    });
});
