import { OUTBOX_DB_NAME, OUTBOX_DB_VERSION, OUTBOX_STORE } from "./constants";
import type { FeedbackOutboxEntry } from "./types";

type OutboxRow = FeedbackOutboxEntry & { audioBlob?: Blob };

/**
 * Some phone browsers refuse IndexedDB: private mode, QR-scanner and WhatsApp in-app
 * browsers, or a phone low on storage ("The user denied permission to access the database").
 * The outbox must never block a submission, so on the first failure it switches to an
 * in-memory store for the rest of the session. Submitting still works; only the offline
 * queue (surviving a page reload) is lost on those browsers.
 */
const memoryStore = new Map<string, OutboxRow>();
let indexedDbUnavailable = typeof indexedDB === "undefined";

/** Some browsers never answer indexedDB.open in private mode; do not wait forever. */
const OPEN_TIMEOUT_MS = 3000;

function openOutboxDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("Opening the outbox database timed out"));
    }, OPEN_TIMEOUT_MS);
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      fn();
    };

    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(OUTBOX_DB_NAME, OUTBOX_DB_VERSION);
    } catch (err) {
      finish(() => reject(err));
      return;
    }
    req.onerror = () => finish(() => reject(req.error ?? new Error("Could not open outbox database")));
    req.onblocked = () => finish(() => reject(new Error("Outbox database is blocked")));
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        const store = db.createObjectStore(OUTBOX_STORE, { keyPath: "id" });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };
    req.onsuccess = () => {
      // A late success after the timeout: close it, the session already uses memory.
      if (settled) {
        req.result.close();
        return;
      }
      finish(() => resolve(req.result));
    };
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

/** Runs `idbOp` against IndexedDB, or `memoryOp` once IndexedDB has proved unusable. */
async function withStore<T>(
  idbOp: (db: IDBDatabase) => Promise<T>,
  memoryOp: () => T
): Promise<T> {
  if (!indexedDbUnavailable) {
    let db: IDBDatabase | null = null;
    try {
      db = await openOutboxDb();
      return await idbOp(db);
    } catch (err) {
      indexedDbUnavailable = true;
      console.warn("[feedback-outbox] IndexedDB unavailable, keeping submissions in memory:", err);
    } finally {
      db?.close();
    }
  }
  return memoryOp();
}

export async function putOutboxRecord(entry: FeedbackOutboxEntry, audioBlob?: Blob | null): Promise<void> {
  const row: OutboxRow = { ...entry, audioBlob: audioBlob ?? undefined };
  await withStore(
    async (db) => {
      const tx = db.transaction(OUTBOX_STORE, "readwrite");
      tx.objectStore(OUTBOX_STORE).put(row);
      await txDone(tx);
    },
    () => {
      memoryStore.set(row.id, row);
    }
  );
}

export async function getOutboxRecord(id: string): Promise<OutboxRow | null> {
  return withStore(
    async (db) => {
      const tx = db.transaction(OUTBOX_STORE, "readonly");
      const row = await new Promise<OutboxRow | undefined>((resolve, reject) => {
        const req = tx.objectStore(OUTBOX_STORE).get(id);
        req.onsuccess = () => resolve(req.result as OutboxRow | undefined);
        req.onerror = () => reject(req.error);
      });
      await txDone(tx);
      return row ?? null;
    },
    () => memoryStore.get(id) ?? null
  );
}

export async function deleteOutboxRecord(id: string): Promise<void> {
  await withStore(
    async (db) => {
      const tx = db.transaction(OUTBOX_STORE, "readwrite");
      tx.objectStore(OUTBOX_STORE).delete(id);
      await txDone(tx);
    },
    () => {
      memoryStore.delete(id);
    }
  );
}

export async function listOutboxRecords(): Promise<OutboxRow[]> {
  const rows = await withStore(
    async (db) => {
      const tx = db.transaction(OUTBOX_STORE, "readonly");
      const result = await new Promise<OutboxRow[]>((resolve, reject) => {
        const req = tx.objectStore(OUTBOX_STORE).getAll();
        req.onsuccess = () => resolve((req.result as OutboxRow[]) ?? []);
        req.onerror = () => reject(req.error);
      });
      await txDone(tx);
      return result;
    },
    () => [...memoryStore.values()]
  );
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

export async function countPendingOutbox(): Promise<number> {
  const rows = await listOutboxRecords();
  return rows.filter((r) =>
    ["pending_sync", "text_synced", "syncing", "draft"].includes(r.status)
  ).length;
}
