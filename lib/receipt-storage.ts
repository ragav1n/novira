import { supabase } from '@/lib/supabase';

const BUCKET = 'receipts';
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_MIME = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/;
const SIGNED_URL_TTL = 60 * 60; // 1 hour

export type ReceiptValidation = { valid: true } | { valid: false; reason: string };

export function validateReceiptFile(file: File | Blob): ReceiptValidation {
    if (file.size > MAX_BYTES) {
        return { valid: false, reason: `File is too large (max ${Math.round(MAX_BYTES / 1024 / 1024)}MB).` };
    }
    const mime = (file as File).type || '';
    if (!ALLOWED_MIME.test(mime)) {
        return { valid: false, reason: 'Unsupported file type. Use JPEG, PNG, WebP, HEIC, or PDF.' };
    }
    return { valid: true };
}

function extFromMime(mime: string): string {
    if (mime === 'application/pdf') return 'pdf';
    if (mime === 'image/jpeg') return 'jpg';
    if (mime === 'image/png') return 'png';
    if (mime === 'image/webp') return 'webp';
    if (mime === 'image/heic') return 'heic';
    if (mime === 'image/heif') return 'heif';
    return 'bin';
}

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

/** Best-effort delete; callers may want to ignore failures (e.g. on tx delete). */
export async function deleteReceipt(path: string): Promise<void> {
    const { error } = await supabase.storage.from(BUCKET).remove([path]);
    if (error) throw error;
}
