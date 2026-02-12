// IndexedDB runtime, defineModel(), base Store interface

import type { BaseProvider, Message, StateListener, Unsubscribe } from './types.js';

export type { Message, BaseProvider, StateListener, Unsubscribe } from './types.js';

export interface Store<T = any> {
  get(id: string): Promise<T | undefined>;
  set(id: string, value: T): Promise<void>;
  delete(id: string): Promise<void>;
  getAll(): Promise<T[]>;
  insert(value: Omit<T, 'id'>): Promise<T>;
  update(id: string, value: Partial<T>): Promise<T | undefined>;
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
}

// ─── Shared DB connection manager ──────────────────────────────────
// Tracks all registered store names per database and shares a single
// connection, upgrading the schema when new stores are discovered.
// All defineModel() calls must happen at module import time (before
// any store operations) so that every store is registered before the
// shared connection is opened.

const _dbStoreNames = new Map<string, Set<string>>();
const _dbConnections = new Map<string, Promise<IDBDatabase>>();

function registerStoreName(dbName: string, storeName: string): void {
  let stores = _dbStoreNames.get(dbName);
  if (!stores) {
    stores = new Set();
    _dbStoreNames.set(dbName, stores);
  }
  stores.add(storeName);
  // Invalidate cached connection so the next access checks for missing stores
  _dbConnections.delete(dbName);
}

function getDatabase(dbName: string): Promise<IDBDatabase> {
  const cached = _dbConnections.get(dbName);
  if (cached) return cached;

  const promise = openOrUpgrade(dbName);
  _dbConnections.set(dbName, promise);
  return promise;
}

function openOrUpgrade(dbName: string): Promise<IDBDatabase> {
  const neededStores = _dbStoreNames.get(dbName) ?? new Set<string>();

  return new Promise<IDBDatabase>((resolve, reject) => {
    // Open without an explicit version to discover the current state
    const probeReq = indexedDB.open(dbName);

    probeReq.onerror = () => reject(probeReq.error);

    probeReq.onsuccess = () => {
      const db = probeReq.result;
      const missing = [...neededStores].filter(
        (s) => !db.objectStoreNames.contains(s)
      );

      if (missing.length === 0) {
        resolve(db);
        return;
      }

      // Upgrade needed — bump version and create missing stores
      const newVersion = db.version + 1;
      db.close();

      const upgradeReq = indexedDB.open(dbName, newVersion);
      upgradeReq.onerror = () => reject(upgradeReq.error);
      upgradeReq.onsuccess = () => resolve(upgradeReq.result);
      upgradeReq.onupgradeneeded = (event) => {
        const udb = (event.target as IDBOpenDBRequest).result;
        for (const store of neededStores) {
          if (!udb.objectStoreNames.contains(store)) {
            udb.createObjectStore(store, { keyPath: 'id' });
          }
        }
      };
    };

    // DB doesn't exist yet — create fresh with all registered stores
    probeReq.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      for (const store of neededStores) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'id' });
        }
      }
    };
  });
}

class IndexedDBStore<T extends { id: string }> implements Store<T> {
  private db: IDBDatabase | null = null;
  private fallbackStore?: InMemoryStore<T>;
  private isInitialized = false;

  constructor(
    private dbName: string,
    private storeName: string,
    private notifyChange: () => void
  ) {
    registerStoreName(dbName, storeName);
  }

  private async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      if (typeof window === 'undefined' || !window.indexedDB) {
        throw new Error('IndexedDB not available');
      }

      this.db = await getDatabase(this.dbName);
      this.isInitialized = true;
    } catch (error) {
      console.warn('IndexedDB unavailable, falling back to in-memory storage:', error);
      this.fallbackStore = new InMemoryStore<T>(this.notifyChange);
      this.isInitialized = true;
    }
  }

  private async getObjectStore(mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');
    const transaction = this.db.transaction([this.storeName], mode);
    return transaction.objectStore(this.storeName);
  }

  async get(id: string): Promise<T | undefined> {
    await this.init();

    if (this.fallbackStore) {
      return this.fallbackStore.get(id);
    }

    const store = await this.getObjectStore('readonly');
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async set(id: string, value: T): Promise<void> {
    await this.init();

    if (this.fallbackStore) {
      await this.fallbackStore.set(id, value);
      return;
    }

    const store = await this.getObjectStore('readwrite');
    await new Promise<void>((resolve, reject) => {
      const request = store.put(value);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });

    this.notifyChange();
  }

  async delete(id: string): Promise<void> {
    await this.init();

    if (this.fallbackStore) {
      await this.fallbackStore.delete(id);
      return;
    }

    const store = await this.getObjectStore('readwrite');
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });

    this.notifyChange();
  }

  async getAll(): Promise<T[]> {
    await this.init();

    if (this.fallbackStore) {
      return this.fallbackStore.getAll();
    }

    const store = await this.getObjectStore('readonly');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async insert(value: Omit<T, 'id'>): Promise<T> {
    await this.init();

    if (this.fallbackStore) {
      return this.fallbackStore.insert(value);
    }

    const id = crypto.randomUUID();
    const item = { ...value, id } as T;
    await this.set(id, item);
    return item;
  }

  async update(id: string, value: Partial<T>): Promise<T | undefined> {
    await this.init();

    if (this.fallbackStore) {
      return this.fallbackStore.update(id, value);
    }

    const existing = await this.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...value };
    await this.set(id, updated);
    return updated;
  }
}

class InMemoryStore<T extends { id: string }> implements Store<T> {
  private data: Map<string, T> = new Map();

  constructor(private notifyChange: () => void) {}

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
    const updated = { ...existing, ...value };
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

export function defineModel<T extends { id: string }>(name: string): Model<T> {
  const listeners = new Set<StateListener>();
  const notify = () => {
    for (const callback of listeners) callback();
  };
  const store = new IndexedDBStore<T>('nearstack', name, notify);

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
  };
}

export { defineModule } from './legacy.js';
