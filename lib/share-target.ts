// Mirrors the IDB names used by the service worker's share-target handler in
// public/sw.js. Keep in sync if either side changes.
const DB_NAME = 'novira-share-target';
const STORE = 'files';
const KEY = 'pending';

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function takePendingSharedFile(): Promise<Blob | null> {
    if (typeof indexedDB === 'undefined') return null;
    try {
        const db = await openDB();
        const blob = await new Promise<Blob | null>((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            const store = tx.objectStore(STORE);
            const getReq = store.get(KEY);
            getReq.onsuccess = () => {
                const value = getReq.result as Blob | undefined;
                if (value) store.delete(KEY);
                resolve(value || null);
            };
            getReq.onerror = () => reject(getReq.error);
        });
        db.close();
        return blob;
    } catch (err) {
        console.error('[share-target] read failed', err);
        return null;
    }
}
