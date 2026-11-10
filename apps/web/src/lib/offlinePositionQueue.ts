// ========================================================
// Payanam Offline Position Queue (Feature B)
// Robust client-side IndexedDB persistent storage for GPS fixes
// ========================================================

export interface QueuedFix {
  id?: number;
  sessionId: string;
  userId: string;
  userName: string;
  lat: number;
  lng: number;
  speedKmh: number;
  heading: number;
  seq: number;
  timestamp: string;
  synced: 0 | 1;
}

export interface OfflineQueueState {
  isOnline: boolean;
  pendingCount: number;
  lastSyncedAt: string | null;
  isSyncing: boolean;
}

const DB_NAME = 'payanam_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'position_fixes';

class OfflinePositionQueue {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private seqCounters: Map<string, number> = new Map();
  private subscribers: Set<(state: OfflineQueueState) => void> = new Set();
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private isSyncing: boolean = false;
  private lastSyncedAt: string | null = null;
  private pendingCount: number = 0;

  // In-memory fallback if IndexedDB is blocked (e.g. strict sandboxed iframe/browser mode)
  private memoryFallback: QueuedFix[] = [];
  private useMemoryFallback = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.notifyState();
      });
      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.notifyState();
      });
    }
  }

  private async getDb(): Promise<IDBDatabase> {
    if (this.useMemoryFallback) {
      throw new Error('IndexedDB disabled; using memory fallback');
    }
    if (this.dbPromise) return this.dbPromise;

    if (typeof indexedDB === 'undefined') {
      this.useMemoryFallback = true;
      throw new Error('IndexedDB not supported on this platform');
    }

    this.dbPromise = new Promise((resolve, reject) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = (e.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
            store.createIndex('session_synced', ['sessionId', 'synced'], { unique: false });
            store.createIndex('session_user_seq', ['sessionId', 'userId', 'seq'], { unique: false });
            store.createIndex('session_id', 'sessionId', { unique: false });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          this.useMemoryFallback = true;
          reject(req.error);
        };
      } catch (err) {
        this.useMemoryFallback = true;
        reject(err);
      }
    });

    return this.dbPromise;
  }

  /**
   * Generates a strictly monotonically increasing sequence number per (sessionId, userId).
   * Restores from highest persisted seq in DB on first run so reloads never repeat sequence numbers.
   */
  public async getNextSequence(sessionId: string, userId: string): Promise<number> {
    const key = `${sessionId}:${userId}`;
    let currentSeq = this.seqCounters.get(key);

    if (currentSeq == null) {
      currentSeq = 0;
      try {
        const db = await this.getDb();
        currentSeq = await new Promise<number>((resolve) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const index = store.index('session_user_seq');
          const range = IDBKeyRange.bound([sessionId, userId, 0], [sessionId, userId, Number.MAX_SAFE_INTEGER]);
          const cursorReq = index.openCursor(range, 'prev'); // prev = highest first
          cursorReq.onsuccess = (e) => {
            const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor && cursor.value && typeof cursor.value.seq === 'number') {
              resolve(cursor.value.seq);
            } else {
              resolve(0);
            }
          };
          cursorReq.onerror = () => resolve(0);
        });
      } catch {
        // Fallback from in-memory
        for (const item of this.memoryFallback) {
          if (item.sessionId === sessionId && item.userId === userId && item.seq > currentSeq) {
            currentSeq = item.seq;
          }
        }
      }
    }

    const nextSeq = currentSeq + 1;
    this.seqCounters.set(key, nextSeq);
    return nextSeq;
  }

  /**
   * Step 1: Write fix to local phone DB BEFORE treating as saved.
   */
  public async enqueueFix(fix: Omit<QueuedFix, 'id' | 'synced'>): Promise<QueuedFix> {
    const record: QueuedFix = {
      ...fix,
      synced: 0,
    };

    try {
      const db = await this.getDb();
      const savedFix = await new Promise<QueuedFix>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.add(record);
        req.onsuccess = () => {
          record.id = req.result as number;
        };
        tx.oncomplete = () => resolve(record);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(new Error('Transaction aborted'));
      });
      await this.refreshPendingCount(fix.sessionId);
      return savedFix;
    } catch {
      // Memory fallback
      record.id = Date.now() + Math.floor(Math.random() * 1000);
      this.memoryFallback.push(record);
      await this.refreshPendingCount(fix.sessionId);
      return record;
    }
  }

  /**
   * Step 2 & 3: Retrieve pending unsynced fixes ordered by seq.
   */
  public async getPendingFixes(sessionId: string, limit = 50): Promise<QueuedFix[]> {
    try {
      const db = await this.getDb();
      return await new Promise<QueuedFix[]>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('session_synced');
        const range = IDBKeyRange.only([sessionId, 0]);
        const req = index.getAll(range, limit);
        req.onsuccess = () => {
          const list = (req.result || []) as QueuedFix[];
          list.sort((a, b) => a.seq - b.seq);
          resolve(list);
        };
        req.onerror = () => resolve([]);
      });
    } catch {
      return this.memoryFallback
        .filter((f) => f.sessionId === sessionId && f.synced === 0)
        .sort((a, b) => a.seq - b.seq)
        .slice(0, limit);
    }
  }

  /**
   * Step 3: Mark fixes as successfully synced.
   */
  public async markFixesSynced(sessionId: string, ids: number[]): Promise<void> {
    if (!ids || ids.length === 0) return;
    const idSet = new Set(ids);

    try {
      const db = await this.getDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        ids.forEach((id) => {
          const getReq = store.get(id);
          getReq.onsuccess = () => {
            if (getReq.result) {
              const updated = { ...getReq.result, synced: 1 as const };
              store.put(updated);
            }
          };
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      this.memoryFallback.forEach((f) => {
        if (f.id != null && idSet.has(f.id)) {
          f.synced = 1;
        }
      });
    }

    this.lastSyncedAt = new Date().toISOString();
    await this.refreshPendingCount(sessionId);
  }

  /**
   * Retrieves local recorded trail coordinates for this user.
   */
  public async getLocalTrail(sessionId: string, userId: string, maxPoints = 500): Promise<Array<[number, number]>> {
    try {
      const db = await this.getDb();
      return await new Promise<Array<[number, number]>>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('session_user_seq');
        const range = IDBKeyRange.bound([sessionId, userId, 0], [sessionId, userId, Number.MAX_SAFE_INTEGER]);
        const req = index.getAll(range, maxPoints);
        req.onsuccess = () => {
          const list = (req.result || []) as QueuedFix[];
          list.sort((a, b) => a.seq - b.seq);
          resolve(list.map((f) => [f.lat, f.lng]));
        };
        req.onerror = () => resolve([]);
      });
    } catch {
      return this.memoryFallback
        .filter((f) => f.sessionId === sessionId && f.userId === userId)
        .sort((a, b) => a.seq - b.seq)
        .slice(-maxPoints)
        .map((f) => [f.lat, f.lng]);
    }
  }

  /**
   * Count how many fixes are queued and pending sync.
   */
  public async refreshPendingCount(sessionId: string): Promise<number> {
    try {
      const db = await this.getDb();
      const count = await new Promise<number>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('session_synced');
        const range = IDBKeyRange.only([sessionId, 0]);
        const countReq = index.count(range);
        countReq.onsuccess = () => resolve(countReq.result);
        countReq.onerror = () => resolve(0);
      });
      this.pendingCount = count;
      this.notifyState();
      return count;
    } catch {
      const count = this.memoryFallback.filter((f) => f.sessionId === sessionId && f.synced === 0).length;
      this.pendingCount = count;
      this.notifyState();
      return count;
    }
  }

  public setSyncing(isSyncing: boolean) {
    this.isSyncing = isSyncing;
    this.notifyState();
  }

  public setOnlineStatus(isOnline: boolean) {
    this.isOnline = isOnline;
    this.notifyState();
  }

  public getState(): OfflineQueueState {
    return {
      isOnline: this.isOnline,
      pendingCount: this.pendingCount,
      lastSyncedAt: this.lastSyncedAt,
      isSyncing: this.isSyncing,
    };
  }

  public subscribe(cb: (state: OfflineQueueState) => void): () => void {
    this.subscribers.add(cb);
    cb(this.getState());
    return () => this.subscribers.delete(cb);
  }

  private notifyState() {
    const s = this.getState();
    this.subscribers.forEach((cb) => {
      try { cb(s); } catch { /* silent */ }
    });
  }
}

export const offlinePositionQueue = new OfflinePositionQueue();

