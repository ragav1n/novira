import { supabase } from '@/lib/supabase';
import { validateReceiptFile, extFromMime } from '@/lib/receipt-file';

// The file rules live in lib/receipt-file.ts so they can be unit-tested without
// pulling in the Supabase client. Re-exported here so existing importers are
// unaffected.
export {
    validateReceiptFile,
    isPdf,
    RECEIPT_ACCEPT,
    RECEIPT_MIME_TYPES,
    type ReceiptValidation,
} from '@/lib/receipt-file';

const BUCKET = 'receipts';
const SIGNED_URL_TTL = 60 * 60; // 1 hour

/**
 * Upload a receipt against an existing transaction. Returns the storage path
 * (NOT a URL — bucket is private; sign on read via getReceiptSignedUrl).
 */
export async function uploadReceipt(
    userId: string,
    txId: string,
    file: File | Blob,
): Promise<{ path: string }> {
    const v = validateReceiptFile(file);
    if (!v.valid) throw new Error(v.reason);

    const mime = (file as File).type || 'application/octet-stream';
    const path = `${userId}/${txId}.${extFromMime(mime)}`;

    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true, contentType: mime });

    if (error) throw error;
    return { path };
}

/**
 * Generate a short-lived signed URL the client can render. The bucket is
 * private — never expose getPublicUrl for receipts.
 */
export async function getReceiptSignedUrl(path: string): Promise<string> {
    const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL);
    if (error) throw error;
    return data.signedUrl;
}

/**
 * Batch variant — one round-trip per call vs N for the singular form. Returns
 * a Map keyed by path. Missing/failed paths are silently omitted; callers
 * should treat absence as "couldn't sign" and fall back accordingly.
 */
export async function getReceiptSignedUrls(paths: string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    if (paths.length === 0) return out;
    const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(paths, SIGNED_URL_TTL);
    if (error) throw error;
    for (const row of data || []) {
        if (row.path && row.signedUrl) out.set(row.path, row.signedUrl);
    }
    return out;
}

/** Best-effort delete; callers may want to ignore failures (e.g. on tx delete). */
export async function deleteReceipt(path: string): Promise<void> {
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) throw error;
}
