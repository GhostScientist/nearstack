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

class IndexedDBStore<T extends { id: string }> implements Store<T> {
  private db: IDBDatabase | null = null;
  private fallbackStore?: InMemoryStore<T>;
  private isInitialized = false;

  constructor(
    private dbName: string,
    private storeName: string,
    private notifyChange: () => void
  ) {}

  private async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      if (typeof window === 'undefined' || !window.indexedDB) {
        throw new Error('IndexedDB not available');
      }

      this.db = await this.openDB();
      this.isInitialized = true;
    } catch (error) {
      console.warn('IndexedDB unavailable, falling back to in-memory storage:', error);
      this.fallbackStore = new InMemoryStore<T>(this.notifyChange);
      this.isInitialized = true;
    }
  }

  private openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };
    });
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
