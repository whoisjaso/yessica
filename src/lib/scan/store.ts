/**
 * Scanned pages, kept on her device (IndexedDB): photos are too big for
 * the browser's small key-value store, and the papers carry the buyer's
 * details, so they stay on the phone that took them until she uploads
 * them to webDEALER.
 */

export type ScanDoc = {
  /** `${saleId}:${docKey}` */
  id: string;
  saleId: string;
  docKey: string;
  /** JPEG pages, in order. */
  pages: Blob[];
  updatedAt: string;
};

const DB = "titledesk-scans";
const STORE = "docs";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" }).createIndex("saleId", "saleId");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function scansFor(saleId: string): Promise<ScanDoc[]> {
  try {
    const db = await open();
    return await done(db.transaction(STORE).objectStore(STORE).index("saleId").getAll(saleId) as IDBRequest<ScanDoc[]>);
  } catch {
    return [];
  }
}

export async function saveScan(doc: ScanDoc): Promise<void> {
  const db = await open();
  await done(db.transaction(STORE, "readwrite").objectStore(STORE).put(doc));
}

/** Clearing one paper to scan it again: she asked for it, one record. */
export async function clearScan(id: string): Promise<void> {
  const db = await open();
  await done(db.transaction(STORE, "readwrite").objectStore(STORE).delete(id));
}
