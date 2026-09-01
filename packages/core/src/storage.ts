// Shared IndexedDB connection manager and storage configuration.

export type StorageBackend = 'indexeddb' | 'memory';

/**
 * How a model resolves its storage backend.
 *
 * - `indexeddb` (default): require IndexedDB. If it is unavailable or denied,
 *   every operation rejects with a {@link StorageError} instead of silently
 *   pretending to persist.
 * - `memory`: deliberately use a non-persistent in-memory store.
 * - `auto`: prefer IndexedDB, fall back to in-memory when it is unavailable.
 *   The degraded state is reported through `model.ready()`.
 */
export type StorageMode = StorageBackend | 'auto';

export type StorageErrorCode =
  | 'STORAGE_UNAVAILABLE'
  | 'UPGRADE_BLOCKED'
  | 'OPEN_FAILED';

export class StorageError extends Error {
  readonly code: StorageErrorCode;
  readonly reason?: unknown;

  constructor(code: StorageErrorCode, message: string, reason?: unknown) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
    this.reason = reason;
  }
}

/** Describes which backend a model actually ended up using. */
export interface StorageStatus {
  backend: StorageBackend;
  /** `false` means writes are lost when the context is torn down. */
  persistent: boolean;
  /** Why the store is degraded, when `persistent` is `false`. */
  reason?: string;
}

export interface StorageConfig {
  /** Default {@link StorageMode} for `defineModel()` calls. */
  mode: StorageMode;
  /**
   * How long to wait after an upgrade reports `blocked` before rejecting.
   * Other connections normally close on `versionchange`, so this is only a
   * backstop against another tab holding the database open.
   */
  blockedTimeoutMs: number;
}

const config: StorageConfig = {
  mode: 'indexeddb',
  blockedTimeoutMs: 3000,
};

/** Override the process-wide storage defaults. */
export function configureStorage(next: Partial<StorageConfig>): void {
  if (next.mode !== undefined) config.mode = next.mode;
  if (next.blockedTimeoutMs !== undefined) {
    config.blockedTimeoutMs = next.blockedTimeoutMs;
  }
}

export function getStorageConfig(): Readonly<StorageConfig> {
  return { ...config };
}

/**
 * Resolve the IndexedDB factory from `globalThis` so that Workers and Service
 * Workers — where `indexedDB` exists but `window` does not — are supported.
 */
export function getIndexedDBFactory(): IDBFactory | undefined {
  try {
    const factory = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
    return factory ?? undefined;
  } catch {
    // Accessing `indexedDB` throws in some locked-down contexts.
    return undefined;
  }
}

// ─── Shared DB connection manager ──────────────────────────────────
// Tracks every registered store name per database and shares a single
// connection, upgrading the schema when new stores are discovered.
// Registering a new store closes the connections we hold so the upgrade is
// never blocked by our own handles, and a `blocked` upgrade rejects instead
// of hanging forever.

const dbStoreNames = new Map<string, Set<string>>();
const dbConnections = new Map<string, Promise<IDBDatabase>>();
const openConnections = new Map<string, Set<IDBDatabase>>();
const openQueue = new Map<string, Promise<unknown>>();

export function registerStoreName(dbName: string, storeName: string): void {
  let stores = dbStoreNames.get(dbName);
  if (!stores) {
    stores = new Set();
    dbStoreNames.set(dbName, stores);
  }
  if (stores.has(storeName)) return;
  stores.add(storeName);
  // A new store means the schema is stale: drop the cached connection and
  // close the handles we own so the upgrade transaction can start.
  invalidateConnection(dbName);
}

export function invalidateConnection(dbName: string): void {
  dbConnections.delete(dbName);
  closeOwnConnections(dbName);
}

function closeOwnConnections(dbName: string): void {
  const open = openConnections.get(dbName);
  if (!open) return;
  for (const db of open) db.close();
  open.clear();
}

function trackConnection(
  dbName: string,
  db: IDBDatabase,
  owner: Promise<IDBDatabase>
): void {
  let open = openConnections.get(dbName);
  if (!open) {
    open = new Set();
    openConnections.set(dbName, open);
  }
  open.add(db);

  db.onversionchange = () => {
    // Another connection (this process or another tab) wants to upgrade.
    db.close();
    open.delete(db);
    if (dbConnections.get(dbName) === owner) dbConnections.delete(dbName);
  };
  db.onclose = () => {
    open.delete(db);
    if (dbConnections.get(dbName) === owner) dbConnections.delete(dbName);
  };
}

export function getDatabase(dbName: string): Promise<IDBDatabase> {
  const cached = dbConnections.get(dbName);
  if (cached) return cached;

  const previous = openQueue.get(dbName) ?? Promise.resolve();
  // Serialize opens per database so an in-flight open never races an upgrade.
  const promise: Promise<IDBDatabase> = previous
    .then(
      () => openOrUpgrade(dbName),
      () => openOrUpgrade(dbName)
    )
    .then((db) => {
      trackConnection(dbName, db, promise);
      return db;
    });

  openQueue.set(
    dbName,
    promise.then(
      () => undefined,
      () => undefined
    )
  );
  dbConnections.set(dbName, promise);
  promise.catch(() => {
    if (dbConnections.get(dbName) === promise) dbConnections.delete(dbName);
  });
  return promise;
}

function openOrUpgrade(dbName: string): Promise<IDBDatabase> {
  const factory = getIndexedDBFactory();
  if (!factory) {
    return Promise.reject(
      new StorageError(
        'STORAGE_UNAVAILABLE',
        'IndexedDB is not available in this context.'
      )
    );
  }

  const neededStores = dbStoreNames.get(dbName) ?? new Set<string>();

  return new Promise<IDBDatabase>((resolve, reject) => {
    // Open without an explicit version to discover the current state
    const probeReq = factory.open(dbName);

    probeReq.onerror = () =>
      reject(
        new StorageError(
          'OPEN_FAILED',
          `Failed to open database "${dbName}".`,
          probeReq.error
        )
      );

    probeReq.onsuccess = () => {
      const db = probeReq.result;
      const missing = [...neededStores].filter(
        (s) => !db.objectStoreNames.contains(s)
      );

      if (missing.length === 0) {
        resolve(db);
        return;
      }

      // Upgrade needed — bump version and create missing stores. Close every
      // connection we own first, otherwise the upgrade is blocked by us.
      const newVersion = db.version + 1;
      db.close();
      closeOwnConnections(dbName);

      const upgradeReq = factory.open(dbName, newVersion);
      let blockedTimer: ReturnType<typeof setTimeout> | undefined;
      let settled = false;
      const settle = (fn: () => void) => {
        if (blockedTimer !== undefined) clearTimeout(blockedTimer);
        blockedTimer = undefined;
        if (settled) return;
        settled = true;
        fn();
      };

      upgradeReq.onblocked = () => {
        // Our own handles are already closed, so this is another context.
        // Give `versionchange` listeners a moment, then fail loudly rather
        // than leaving the caller with a promise that never settles.
        closeOwnConnections(dbName);
        if (blockedTimer !== undefined) return;
        blockedTimer = setTimeout(() => {
          blockedTimer = undefined;
          if (settled) return;
          settled = true;
          reject(
            new StorageError(
              'UPGRADE_BLOCKED',
              `Upgrading database "${dbName}" to version ${newVersion} is ` +
                'blocked by another open connection. Close other tabs using ' +
                'this app and retry.'
            )
          );
        }, config.blockedTimeoutMs);
      };
      upgradeReq.onerror = () =>
        settle(() =>
          reject(
            new StorageError(
              'OPEN_FAILED',
              `Failed to upgrade database "${dbName}".`,
              upgradeReq.error
            )
          )
        );
      upgradeReq.onsuccess = () => {
        if (settled) {
          // The upgrade completed after we already reported it blocked.
          // Don't leak the connection or it blocks the next upgrade.
          upgradeReq.result.close();
          return;
        }
        settle(() => resolve(upgradeReq.result));
      };
      upgradeReq.onupgradeneeded = (event) => {
        const udb = (event.target as IDBOpenDBRequest).result;
        createMissingStores(udb, neededStores);
      };
    };

    // DB doesn't exist yet — create fresh with all registered stores
    probeReq.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      createMissingStores(db, neededStores);
    };
  });
}

function createMissingStores(db: IDBDatabase, stores: Set<string>): void {
  for (const store of stores) {
    if (!db.objectStoreNames.contains(store)) {
      db.createObjectStore(store, { keyPath: 'id' });
    }
  }
}

export function isConnectionClosedError(error: unknown): boolean {
  return (error as { name?: string } | null)?.name === 'InvalidStateError';
}

/**
 * Close every connection and forget every registered store. Intended for
 * tests; production code should never need this.
 */
export function resetStorage(): void {
  for (const dbName of openConnections.keys()) closeOwnConnections(dbName);
  openConnections.clear();
  dbConnections.clear();
  openQueue.clear();
  dbStoreNames.clear();
  config.mode = 'indexeddb';
  config.blockedTimeoutMs = 3000;
}
