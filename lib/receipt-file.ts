/**
 * Pure receipt-file rules: what may be attached, and how a picker should be
 * configured to match. Deliberately separate from receipt-storage.ts, which
 * imports the Supabase client and so cannot be loaded in a unit test.
 */

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

/** The single source of truth for accepted receipt types. */
export const RECEIPT_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'application/pdf',
] as const;

/**
 * `accept` for any receipt file input, derived from the list above rather than
 * written out by hand. The gallery input used to be a hand-written `image/*`,
 * which silently made the PDF support in the validator *and* in the viewer
 * unreachable — nothing failed, the option just never appeared.
 */
export const RECEIPT_ACCEPT = RECEIPT_MIME_TYPES.join(',');

export type ReceiptValidation = { valid: true } | { valid: false; reason: string };

export function validateReceiptFile(file: File | Blob): ReceiptValidation {
    if (file.size > MAX_BYTES) {
        return { valid: false, reason: `File is too large (max ${Math.round(MAX_BYTES / 1024 / 1024)}MB).` };
    }
    const mime = (file as File).type || '';
    if (!(RECEIPT_MIME_TYPES as readonly string[]).includes(mime)) {
        return { valid: false, reason: 'Unsupported file type. Use JPEG, PNG, WebP, HEIC, or PDF.' };
    }
    return { valid: true };
}

/** PDFs are stored and viewed, but never downscaled or sent to the scanner. */
export function isPdf(file: File | Blob): boolean {
    return (file.type || '') === 'application/pdf';
}

export function extFromMime(mime: string): string {
    if (mime === 'application/pdf') return 'pdf';
    if (mime === 'image/jpeg') return 'jpg';
    if (mime === 'image/png') return 'png';
    if (mime === 'image/webp') return 'webp';
    if (mime === 'image/heic') return 'heic';
    if (mime === 'image/heif') return 'heif';
    return 'bin';
}
