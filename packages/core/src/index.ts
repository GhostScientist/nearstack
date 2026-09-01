// IndexedDB runtime, defineModel(), base Store interface

import type { StateListener, Unsubscribe } from './types.js';
import {
  StorageError,
  getDatabase,
  getIndexedDBFactory,
  getStorageConfig,
  isConnectionClosedError,
  invalidateConnection,
  registerStoreName,
} from './storage.js';
import type { StorageMode, StorageStatus } from './storage.js';

export type {
  Message,
  BaseProvider,
  StateListener,
  Unsubscribe,
} from './types.js';

export {
  StorageError,
  configureStorage,
  getStorageConfig,
  resetStorage,
} from './storage.js';
export type {
  StorageBackend,
  StorageConfig,
  StorageErrorCode,
  StorageMode,
  StorageStatus,
} from './storage.js';

export const DEFAULT_DATABASE = 'nearstack';

export interface Store<T = any> {
  get(id: string): Promise<T | undefined>;
  set(id: string, value: T): Promise<void>;
  delete(id: string): Promise<void>;
  getAll(): Promise<T[]>;
  insert(value: Omit<T, 'id'>): Promise<T>;
  update(id: string, value: Partial<T>): Promise<T | undefined>;
  /** Resolves once the backend is chosen, reporting whether it persists. */
  ready?(): Promise<StorageStatus>;
}

export interface Table<T = any> {
  insert(value: Omit<T, 'id'>): Promise<T>;
  update(id: string, value: Partial<T>): Promise<T | undefined>;
  delete(id: string): Promise<void>;
  get(id: string): Promise<T | undefined>;
  getAll(): Promise<T[]>;
  find(predicate: (item: T) => boolean): Promise<T[]>;
}

export interface Model<T = any> {
  name: string;
  store: Store<T>;
  table(): Table<T>;
  subscribe(callback: StateListener): Unsubscribe;
  /**
   * Resolves once storage is initialized. Rejects with a {@link StorageError}
   * when persistent storage is required but unavailable.
   */
  ready(): Promise<StorageStatus>;
}

export interface DefineModelOptions {
  /** Storage backend selection. Defaults to the configured global mode. */
  storage?: StorageMode;
  /** Database name. Defaults to `nearstack`. */
  database?: string;
}

function runRequest<R>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  make: (store: IDBObjectStore) => IDBRequest<R>
): Promise<R> {
  return new Promise<R>((resolve, reject) => {
    const transaction = db.transaction([storeName], mode);
    let result: R;
    const request = make(transaction.objectStore(storeName));
    request.onsuccess = () => {
      result = request.result;
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => resolve(result);
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('Transaction aborted'));
  });
}

class IndexedDBStore<T extends { id: string }> implements Store<T> {
  private fallbackStore?: InMemoryStore<T>;
  private status?: StorageStatus;
  private initPromise?: Promise<void>;

  constructor(
    private dbName: string,
    private storeName: string,
    private notifyChange: () => void,
    private mode: Exclude<StorageMode, 'memory'>
  ) {
    registerStoreName(dbName, storeName);
  }

  async ready(): Promise<StorageStatus> {
    await this.init();
    return this.status as StorageStatus;
  }

  private init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.resolveBackend().catch((error) => {
        // Allow a later retry (e.g. storage becomes available again).
        this.initPromise = undefined;
        throw error;
      });
    }
    return this.initPromise;
  }

  private async resolveBackend(): Promise<void> {
    if (this.status) return;

    try {
      if (!getIndexedDBFactory()) {
        throw new StorageError(
          'STORAGE_UNAVAILABLE',
          'IndexedDB is not available in this context.'
        );
      }
      await getDatabase(this.dbName);
      this.status = { backend: 'indexeddb', persistent: true };
    } catch (error) {
      if (this.mode !== 'auto') {
        throw error instanceof StorageError
          ? error
          : new StorageError(
              'STORAGE_UNAVAILABLE',
              `Persistent storage is unavailable for model "${this.storeName}".`,
              error
            );
      }

      const reason = error instanceof Error ? error.message : String(error);
      console.warn(
        `[nearstack] Model "${this.storeName}" fell back to non-persistent ` +
          `in-memory storage: ${reason}`
      );
      this.fallbackStore = new InMemoryStore<T>(this.notifyChange, {
        backend: 'memory',
        persistent: false,
        reason,
      });
      this.status = { backend: 'memory', persistent: false, reason };
    }
  }

  /** Runs `work` against a live connection, retrying once if it went stale. */
  private async withConnection<R>(
    work: (db: IDBDatabase) => Promise<R>
  ): Promise<R> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      const db = await getDatabase(this.dbName);
      try {
        return await work(db);
      } catch (error) {
        lastError = error;
        if (attempt === 0 && isConnectionClosedError(error)) {
          // The connection was closed by a schema upgrade — reopen and retry.
          invalidateConnection(this.dbName);
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  async get(id: string): Promise<T | undefined> {
    await this.init();
    if (this.fallbackStore) return this.fallbackStore.get(id);

    return this.withConnection((db) =>
      runRequest<T | undefined>(db, this.storeName, 'readonly', (store) =>
        store.get(id)
      )
    );
  }

  async set(id: string, value: T): Promise<void> {
    await this.init();
    if (this.fallbackStore) {
      await this.fallbackStore.set(id, value);
      return;
    }

    await this.withConnection((db) =>
      runRequest(db, this.storeName, 'readwrite', (store) => store.put(value))
    );
    this.notifyChange();
  }

  async delete(id: string): Promise<void> {
    await this.init();
    if (this.fallbackStore) {
      await this.fallbackStore.delete(id);
      return;
    }

    await this.withConnection((db) =>
      runRequest(db, this.storeName, 'readwrite', (store) => store.delete(id))
    );
    this.notifyChange();
  }

  async getAll(): Promise<T[]> {
    await this.init();
    if (this.fallbackStore) return this.fallbackStore.getAll();

    return this.withConnection((db) =>
      runRequest<T[]>(db, this.storeName, 'readonly', (store) => store.getAll())
    );
  }

  async insert(value: Omit<T, 'id'>): Promise<T> {
    await this.init();
    if (this.fallbackStore) return this.fallbackStore.insert(value);

    const id = crypto.randomUUID();
    const item = { ...value, id } as T;
    await this.set(id, item);
    return item;
  }

  async update(id: string, value: Partial<T>): Promise<T | undefined> {
    await this.init();
    if (this.fallbackStore) return this.fallbackStore.update(id, value);

    // Read-modify-write inside a single readwrite transaction. IndexedDB
    // serializes overlapping readwrite transactions, so concurrent updates to
    // the same record queue up instead of clobbering each other.
    const updated = await this.withConnection(
      (db) =>
        new Promise<T | undefined>((resolve, reject) => {
          const transaction = db.transaction([this.storeName], 'readwrite');
          const store = transaction.objectStore(this.storeName);
          let result: T | undefined;

          const getRequest = store.get(id);
          getRequest.onerror = () => reject(getRequest.error);
          getRequest.onsuccess = () => {
            const existing = getRequest.result as T | undefined;
            if (!existing) return;
            result = { ...existing, ...value, id } as T;
            const putRequest = store.put(result);
            putRequest.onerror = () => reject(putRequest.error);
          };

          transaction.oncomplete = () => resolve(result);
          transaction.onabort = () =>
            reject(transaction.error ?? new Error('Transaction aborted'));
        })
    );

    if (updated) this.notifyChange();
    return updated;
  }
}

class InMemoryStore<T extends { id: string }> implements Store<T> {
  private data: Map<string, T> = new Map();

  constructor(
    private notifyChange: () => void,
    private status: StorageStatus = {
      backend: 'memory',
      persistent: false,
      reason: 'In-memory storage was requested explicitly.',
    }
  ) {}

  async ready(): Promise<StorageStatus> {
    return this.status;
  }

  async get(id: string): Promise<T | undefined> {
    return this.data.get(id);
  }

  async set(id: string, value: T): Promise<void> {
    this.data.set(id, value);
    this.notifyChange();
  }

  async delete(id: string): Promise<void> {
    this.data.delete(id);
    this.notifyChange();
  }

  async getAll(): Promise<T[]> {
    return Array.from(this.data.values());
  }

  async insert(value: Omit<T, 'id'>): Promise<T> {
    const id = crypto.randomUUID();
    const item = { ...value, id } as T;
    await this.set(id, item);
    return item;
  }

  async update(id: string, value: Partial<T>): Promise<T | undefined> {
    const existing = await this.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...value, id } as T;
    await this.set(id, updated);
    return updated;
  }
}

class TableImpl<T extends { id: string }> implements Table<T> {
  constructor(private store: Store<T>) {}

  async insert(value: Omit<T, 'id'>): Promise<T> {
    return this.store.insert(value);
  }

  async update(id: string, value: Partial<T>): Promise<T | undefined> {
    return this.store.update(id, value);
  }

  async delete(id: string): Promise<void> {
    return this.store.delete(id);
  }

  async get(id: string): Promise<T | undefined> {
    return this.store.get(id);
  }

  async getAll(): Promise<T[]> {
    return this.store.getAll();
  }

  async find(predicate: (item: T) => boolean): Promise<T[]> {
    const all = await this.getAll();
    return all.filter(predicate);
  }
}

export function defineModel<T extends { id: string }>(
  name: string,
  options: DefineModelOptions = {}
): Model<T> {
  const listeners = new Set<StateListener>();
  const notify = () => {
    for (const callback of listeners) callback();
  };

  const dbName = options.database ?? DEFAULT_DATABASE;
  const mode = options.storage ?? getStorageConfig().mode;
  const store: Store<T> =
    mode === 'memory'
      ? new InMemoryStore<T>(notify)
      : new IndexedDBStore<T>(dbName, name, notify, mode);

  return {
    name,
    store,
    table() {
      return new TableImpl(store);
    },
    subscribe(callback: StateListener): Unsubscribe {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    ready(): Promise<StorageStatus> {
      return store.ready
        ? store.ready()
        : Promise.resolve({ backend: 'memory', persistent: false });
    },
  };
}

export { defineModule } from './legacy.js';
