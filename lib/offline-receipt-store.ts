import { get, set, del, keys } from 'idb-keyval';

const RECEIPT_KEY_PREFIX = 'novira-offline-receipt:';
const MAX_OFFLINE_RECEIPTS = 50;

export class ReceiptQuotaError extends Error {
    constructor() {
        super(`Offline receipt storage is full (${MAX_OFFLINE_RECEIPTS}). Reconnect to sync.`);
        this.name = 'ReceiptQuotaError';
    }
}

function receiptKey(queueId: string): string {
    return RECEIPT_KEY_PREFIX + queueId;
}

async function countStoredReceipts(): Promise<number> {
    try {
        const all = await keys();
        return all.filter(k => typeof k === 'string' && k.startsWith(RECEIPT_KEY_PREFIX)).length;
    } catch {
        return 0;
    }
}

export async function saveOfflineReceipt(queueId: string, file: File | Blob): Promise<void> {
    const count = await countStoredReceipts();
    if (count >= MAX_OFFLINE_RECEIPTS) throw new ReceiptQuotaError();
    await set(receiptKey(queueId), file);
}

export async function getOfflineReceipt(queueId: string): Promise<Blob | null> {
    try {
        const blob = await get<Blob>(receiptKey(queueId));
        return blob ?? null;
    } catch {
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
