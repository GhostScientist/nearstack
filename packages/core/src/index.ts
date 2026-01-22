// IndexedDB runtime, defineModel(), base Store interface

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
}

// IndexedDB storage implementation with in-memory fallback
class IndexedDBStore<T extends { id: string }> implements Store<T> {
  private dbName: string;
  private storeName: string;
  private db: IDBDatabase | null = null;
  private fallbackStore?: InMemoryStore<T>;
  private isInitialized = false;

  constructor(dbName: string, storeName: string) {
    this.dbName = dbName;
    this.storeName = storeName;
  }

  private async init(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Check if IndexedDB is available
      if (typeof window === 'undefined' || !window.indexedDB) {
        throw new Error('IndexedDB not available');
      }

      this.db = await this.openDB();
      this.isInitialized = true;
    } catch (error) {
      console.warn('IndexedDB unavailable, falling back to in-memory storage:', error);
      this.fallbackStore = new InMemoryStore<T>();
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
      return this.fallbackStore.set(id, value);
    }

    const store = await this.getObjectStore('readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(value);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async delete(id: string): Promise<void> {
    await this.init();
    
    if (this.fallbackStore) {
      return this.fallbackStore.delete(id);
    }

    const store = await this.getObjectStore('readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
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

    // Generate a UUID for the ID
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

// In-memory storage implementation (fallback)
class InMemoryStore<T extends { id: string }> implements Store<T> {
  private data: Map<string, T> = new Map();

  async get(id: string): Promise<T | undefined> {
    return this.data.get(id);
  }

  async set(id: string, value: T): Promise<void> {
    this.data.set(id, value);
  }

  async delete(id: string): Promise<void> {
    this.data.delete(id);
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
  const store = new IndexedDBStore<T>('nearstack', name);

  return {
    name,
    store,
    table() {
      return new TableImpl(store);
    },
  };
}

export { defineModule } from './legacy.js';
