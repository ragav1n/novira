/**
 * Downscale a picked image before it is stored or sent to the scan API.
 *
 * A modern phone photo is 3-8 MB, which is far more than a receipt needs and
 * more than a mobile uplink reliably pushes inside an upload timeout. 1600px on
 * the longest edge at JPEG q0.85 is the size the receipt scanner already reads
 * successfully, so it is sized for legibility, not for archival fidelity.
 */

export const RECEIPT_MAX_EDGE = 1600;
export const RECEIPT_JPEG_QUALITY = 0.85;

/** PDFs (and anything not an image) must pass through untouched. */
function isDownscalable(file: File | Blob): boolean {
    return (file.type || '').startsWith('image/');
}

/**
 * Returns a downscaled JPEG, or the original file when it cannot be improved.
 *
 * Falls back to the original on any decode failure rather than throwing: HEIC
 * decodes in Safari but not in Chrome, and losing the receipt entirely is a
 * worse outcome than uploading it at full size. Also keeps the original when
 * re-encoding would make it bigger, which happens with small PNGs.
 */
export async function downscaleImage(
    file: File | Blob,
    maxEdge = RECEIPT_MAX_EDGE,
    quality = RECEIPT_JPEG_QUALITY,
): Promise<Blob> {
    if (typeof document === 'undefined') return file;
    if (!isDownscalable(file)) return file;

    let objectUrl: string | null = null;
    try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const el = new Image();
            objectUrl = URL.createObjectURL(file);
            el.onload = () => resolve(el);
            el.onerror = () => reject(new Error('decode failed'));
            el.src = objectUrl;
        });

        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);
        if (!width || !height) return file;

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return file;
        ctx.drawImage(img, 0, 0, width, height);

        const blob = await new Promise<Blob | null>(resolve =>
            canvas.toBlob(resolve, 'image/jpeg', quality)
        );
        if (!blob) return file;
        return blob.size < file.size ? blob : file;
    } catch (err) {
        console.warn('[image-downscale] falling back to the original file', err);
        return file;
    } finally {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
}

/** Bare base64 (no data-URL prefix), for the scan API payload. */
export async function blobToBase64(blob: Blob): Promise<string> {
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    const CHUNK = 0x8000; // chunked to stay clear of the argument-count limit
    for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
}
