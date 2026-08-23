import { get, set, del, keys } from 'idb-keyval';

const RECEIPT_KEY_PREFIX = 'novira-offline-receipt:';
const MAX_OFFLINE_RECEIPTS = 50;

export class ReceiptQuotaError extends Error {
    constructor() {
        super(`Offline receipt storage is full (${MAX_OFFLINE_RECEIPTS}). Reconnect to sync.`);
        this.name = 'ReceiptQuotaError';
    }
}

/**
 * The picked file could not be read into memory, so there is nothing to queue.
 * Distinct from ReceiptQuotaError because the user-facing advice differs: retake the
 * photo, rather than wait for the queue to drain.
 */
export class ReceiptUnreadableError extends Error {
    constructor(message = "That photo couldn't be read from the device.") {
        super(message);
        this.name = 'ReceiptUnreadableError';
    }
}

function receiptKey(queueId: string): string {
    return RECEIPT_KEY_PREFIX + queueId;
}

async function countStoredReceipts(): Promise<number> {
    try {
        const all = await keys();
        return all.filter(k => typeof k === 'string' && k.startsWith(RECEIPT_KEY_PREFIX)).length;
    } catch (err) {
        console.error('[offline-receipt-store] countStoredReceipts failed', err);
        return 0;
    }
}

/**
 * Store the receipt's *bytes*, not the picked File.
 *
 * A File from a camera or photo-picker input is a handle to a file the OS owns, and on
 * iOS that handle can outlive the data: the entry survives the trip through IndexedDB
 * and reads back as a Blob of length zero. The upload then goes out with an empty body
 * and Storage answers "No content provided" — a permanent failure raised minutes after
 * the expense was saved, with the photo already gone.
 *
 * Reading the bytes here, while the handle is still fresh, both materialises them and
 * turns an unreadable file into an error the user can act on immediately.
 */
export async function saveOfflineReceipt(queueId: string, file: File | Blob): Promise<void> {
    const count = await countStoredReceipts();
    if (count >= MAX_OFFLINE_RECEIPTS) throw new ReceiptQuotaError();

    let bytes: ArrayBuffer;
    try {
        bytes = await file.arrayBuffer();
    } catch (err) {
        console.error('[offline-receipt-store] could not read the picked file', err);
        throw new ReceiptUnreadableError();
    }
    if (bytes.byteLength === 0) {
        throw new ReceiptUnreadableError('That photo came back empty — retake it.');
    }

    await set(receiptKey(queueId), new Blob([bytes], { type: file.type || 'application/octet-stream' }));
}

/**
 * Returns null for anything that cannot be uploaded — missing, not a Blob, or empty.
 * Callers treat null as "the photo is gone" and surface it, which is far better than
 * handing an empty body to Storage and getting an opaque rejection back.
 */
export async function getOfflineReceipt(queueId: string): Promise<Blob | null> {
    try {
        const stored = await get<Blob>(receiptKey(queueId));
        if (!stored) return null;
        if (!(stored instanceof Blob) || stored.size === 0) {
            console.error('[offline-receipt-store] stored receipt is unusable', {
                queueId,
                isBlob: stored instanceof Blob,
                size: (stored as Blob)?.size,
            });
            return null;
        }
        return stored;
    } catch (err) {
        console.error('[offline-receipt-store] getOfflineReceipt failed', err);
        return null;
    }
}

export async function deleteOfflineReceipt(queueId: string): Promise<void> {
    try {
        await del(receiptKey(queueId));
    } catch {
        // Best-effort cleanup — a leaked entry isn't worth surfacing.
    }
}
