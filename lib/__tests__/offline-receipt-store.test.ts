import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    saveOfflineReceipt,
    getOfflineReceipt,
    ReceiptUnreadableError,
    ReceiptQuotaError,
} from '../offline-receipt-store';

// `vi.mock` is hoisted above the import above, and the factory is lazy, so `store`
// is initialised by the time any mocked function actually runs.
const store = new Map<string, unknown>();

vi.mock('idb-keyval', () => ({
    get: vi.fn(async (k: string) => store.get(k)),
    set: vi.fn(async (k: string, v: unknown) => { store.set(k, v); }),
    del: vi.fn(async (k: string) => { store.delete(k); }),
    keys: vi.fn(async () => Array.from(store.keys())),
}));

const KEY = 'novira-offline-receipt:q1';

beforeEach(() => {
    store.clear();
    vi.clearAllMocks();
});

describe('saveOfflineReceipt', () => {
    /**
     * The bug this pins down: a File from the photo picker is a handle to a file the OS
     * owns. On iOS the handle outlived the data — it survived IndexedDB and read back as
     * a zero-length Blob, so the upload went out with an empty body and Storage answered
     * "No content provided", minutes after the expense had been saved.
     */
    it('stores the bytes, not the caller\'s File handle', async () => {
        const handle = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/jpeg' });
        await saveOfflineReceipt('q1', handle);
        const stored = store.get(KEY) as Blob;
        expect(stored).not.toBe(handle);
        expect(stored.size).toBe(4);
        expect(stored.type).toBe('image/jpeg');
    });

    it('refuses a file that reads back empty', async () => {
        await expect(saveOfflineReceipt('q1', new Blob([], { type: 'image/jpeg' })))
            .rejects.toThrow(ReceiptUnreadableError);
        expect(store.has(KEY)).toBe(false);
    });

    it('refuses a file it cannot read at all', async () => {
        const unreadable = {
            type: 'image/jpeg',
            size: 2048,
            arrayBuffer: () => Promise.reject(new DOMException('NotReadableError')),
        } as unknown as Blob;
        await expect(saveOfflineReceipt('q1', unreadable)).rejects.toThrow(ReceiptUnreadableError);
        expect(store.has(KEY)).toBe(false);
    });

    it('still reports a full queue distinctly from an unreadable file', async () => {
        for (let i = 0; i < 50; i++) store.set(`novira-offline-receipt:x${i}`, new Blob(['x']));
        await expect(saveOfflineReceipt('q1', new Blob(['ok'], { type: 'image/jpeg' })))
            .rejects.toThrow(ReceiptQuotaError);
    });

    it('falls back to a generic type rather than storing an empty one', async () => {
        await saveOfflineReceipt('q1', new Blob([new Uint8Array([9])]));
        expect((store.get(KEY) as Blob).type).toBe('application/octet-stream');
    });
});

describe('getOfflineReceipt', () => {
    it('returns the stored photo', async () => {
        store.set(KEY, new Blob([new Uint8Array([7, 7])], { type: 'image/png' }));
        expect((await getOfflineReceipt('q1'))?.size).toBe(2);
    });

    it('treats a missing entry as gone', async () => {
        expect(await getOfflineReceipt('q1')).toBeNull();
    });

    /** Uploading either of these produces an empty request body. */
    it('rejects an empty blob rather than uploading nothing', async () => {
        store.set(KEY, new Blob([], { type: 'image/jpeg' }));
        expect(await getOfflineReceipt('q1')).toBeNull();
    });

    it('rejects a value that did not survive as a Blob', async () => {
        store.set(KEY, { notABlob: true });
        expect(await getOfflineReceipt('q1')).toBeNull();
    });
});
