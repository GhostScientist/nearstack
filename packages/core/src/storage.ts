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
  | 'OPEN_FAILED'
  | 'QUOTA_EXCEEDED'
  | 'MIGRATION_FAILED'
  | 'SCHEMA_VERSION_UNSUPPORTED'
  | 'CONFIGURATION_CONFLICT';

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

export type PersistenceState = 'granted' | 'denied' | 'unsupported';

export interface PersistenceStatus {
  state: PersistenceState;
}

export interface SchemaMigration<T extends { id: string }> {
  from: number;
  to: number;
  migrate: (record: T) => T;
}

export type MigrationDefinition<T extends { id: string }> =
  readonly SchemaMigration<T>[] | Readonly<Record<number, (record: T) => T>>;

export const SCHEMA_METADATA_STORE = '__nearstack_schema';

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

export function normalizeStorageError(
  error: unknown,
  fallbackCode: StorageErrorCode,
  message: string
): StorageError {
  if (error instanceof StorageError) return error;
  const name = (error as { name?: unknown } | null)?.name;
  if (name === 'QuotaExceededError') {
    return new StorageError(
      'QUOTA_EXCEEDED',
      'The browser storage quota was exceeded while writing data.',
      error
    );
  }
  return new StorageError(fallbackCode, message, error);
}

/** Ask the browser to protect this origin's storage from eviction. */
export async function requestPersistence(): Promise<PersistenceStatus> {
  const storage = (globalThis as { navigator?: Navigator }).navigator?.storage;
  if (!storage?.persist) return { state: 'unsupported' };

  try {
    return { state: (await storage.persist()) ? 'granted' : 'denied' };
  } catch {
    return { state: 'denied' };
  }
}

export interface ModelSchemaOptions<T extends { id: string }> {
  schemaVersion: number;
  migrations: MigrationDefinition<T>;
}

interface SchemaMetadata {
  id: string;
  version: number;
}

function migrationSteps<T extends { id: string }>(
  definition: MigrationDefinition<T>
): SchemaMigration<T>[] {
  if (Array.isArray(definition)) return [...definition];
  return Object.entries(definition).map(([from, migrate]) => ({
    from: Number(from),
    to: Number(from) + 1,
    migrate,
  }));
}

/** Migrate one model and its metadata in one readwrite transaction. */
export function migrateModel<T extends { id: string }>(
  db: IDBDatabase,
  modelName: string,
  options: ModelSchemaOptions<T>
): Promise<void> {
  const { schemaVersion, migrations } = options;
  if (!Number.isInteger(schemaVersion) || schemaVersion < 1) {
    return Promise.reject(
      new StorageError(
        'MIGRATION_FAILED',
        `Schema version for model "${modelName}" must be a positive integer.`
      )
    );
  }

  const steps = migrationSteps(migrations);
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      reject(
        normalizeStorageError(
          error,
          'MIGRATION_FAILED',
          `Failed to migrate model "${modelName}".`
        )
      );
    };

    let transaction: IDBTransaction;
    try {
      transaction = db.transaction(
        [modelName, SCHEMA_METADATA_STORE],
        'readwrite'
      );
    } catch (error) {
      fail(error);
      return;
    }

    const metadataStore = transaction.objectStore(SCHEMA_METADATA_STORE);
    const modelStore = transaction.objectStore(modelName);
    const metadataRequest = metadataStore.get(modelName);

    metadataRequest.onerror = () => fail(metadataRequest.error);
    metadataRequest.onsuccess = () => {
      if (settled) return;
      const metadata = metadataRequest.result as SchemaMetadata | undefined;
      const currentVersion = metadata?.version ?? 1;

      if (currentVersion > schemaVersion) {
        fail(
          new StorageError(
            'SCHEMA_VERSION_UNSUPPORTED',
            `Model "${modelName}" uses schema version ${currentVersion}, ` +
              `but this application supports up to ${schemaVersion}.`
          )
        );
        transaction.abort();
        return;
      }

      const recordsRequest = modelStore.getAll();
      recordsRequest.onerror = () => fail(recordsRequest.error);
      recordsRequest.onsuccess = () => {
        if (settled) return;
        try {
          let records = recordsRequest.result as T[];
          let version = currentVersion;

          while (version < schemaVersion) {
            const step = steps.find(
              (candidate) =>
                candidate.from === version && candidate.to === version + 1
            );
            if (!step) {
              throw new StorageError(
                'MIGRATION_FAILED',
                `Missing migration for model "${modelName}" from ` +
                  `schema ${version} to ${version + 1}.`
              );
            }
            records = records.map((record) => {
              const migrated = step.migrate(record);
              if (
                migrated === null ||
                typeof migrated !== 'object' ||
                typeof (migrated as { then?: unknown }).then === 'function'
              ) {
                throw new StorageError(
                  'MIGRATION_FAILED',
                  `Migration ${version} -> ${version + 1} for model ` +
                    `"${modelName}" must return a record synchronously.`
                );
              }
              return { ...migrated, id: record.id } as T;
            });
            version += 1;
          }

          for (const record of records) modelStore.put(record);
          metadataStore.put({ id: modelName, version: schemaVersion });
        } catch (error) {
          fail(error);
          transaction.abort();
        }
      };
    };

    transaction.oncomplete = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    transaction.onabort = () => {
      fail(transaction.error ?? new Error('Migration transaction aborted.'));
    };
    transaction.onerror = () => {
      if (transaction.error) fail(transaction.error);
    };
  });
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
const abandonedUpgrades = new Map<string, Promise<IDBDatabase>>();

export function registerStoreName(dbName: string, storeName: string): void {
  let stores = dbStoreNames.get(dbName);
  if (!stores) {
    stores = new Set();
    dbStoreNames.set(dbName, stores);
  }
  if (stores.has(storeName)) return;
  stores.add(storeName);
  if (storeName !== SCHEMA_METADATA_STORE) {
    stores.add(SCHEMA_METADATA_STORE);
  }
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

async function openOrUpgrade(dbName: string): Promise<IDBDatabase> {
  const factory = getIndexedDBFactory();
  if (!factory) {
    throw new StorageError(
      'STORAGE_UNAVAILABLE',
      'IndexedDB is not available in this context.'
    );
  }

  // An upgrade we already reported as blocked is still sitting in the
  // database's connection queue and cannot be cancelled. Opening again now
  // would queue behind it forever, so wait for it to drain first.
  const abandoned = abandonedUpgrades.get(dbName);
  if (abandoned) await waitForAbandonedUpgrade(dbName, abandoned);

  return openWithSchema(dbName, factory);
}

function waitForAbandonedUpgrade(
  dbName: string,
  abandoned: Promise<IDBDatabase>
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new StorageError(
          'UPGRADE_BLOCKED',
          `Database "${dbName}" is still blocked by another open connection. ` +
            'Close other tabs using this app and retry.'
        )
      );
    }, config.blockedTimeoutMs);

    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    abandoned.then(done, done);
  });
}

/**
 * Records an upgrade request we gave up waiting on. It stays queued inside
 * IndexedDB, so later opens must wait for it rather than queue behind it.
 */
function abandonUpgrade(
  dbName: string,
  upgradeDone: Promise<IDBDatabase>
): void {
  abandonedUpgrades.set(dbName, upgradeDone);
  const forget = () => {
    if (abandonedUpgrades.get(dbName) === upgradeDone) {
      abandonedUpgrades.delete(dbName);
    }
  };
  upgradeDone.then((db) => {
    forget();
    // Nobody is waiting on this handle any more; leaving it open would
    // block the next upgrade.
    db.close();
  }, forget);
}

function openWithSchema(
  dbName: string,
  factory: IDBFactory
): Promise<IDBDatabase> {
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
      const upgradeDone = new Promise<IDBDatabase>((settle, fail) => {
        upgradeReq.onsuccess = () => settle(upgradeReq.result);
        upgradeReq.onerror = () =>
          fail(
            new StorageError(
              'OPEN_FAILED',
              `Failed to upgrade database "${dbName}".`,
              upgradeReq.error
            )
          );
      });
      upgradeReq.onupgradeneeded = (event) => {
        const udb = (event.target as IDBOpenDBRequest).result;
        createMissingStores(udb, neededStores);
      };

      let blockedTimer: ReturnType<typeof setTimeout> | undefined;
      const clearBlockedTimer = () => {
        if (blockedTimer !== undefined) clearTimeout(blockedTimer);
        blockedTimer = undefined;
      };

      upgradeReq.onblocked = () => {
        // Our own handles are already closed, so this is another context.
        // Give `versionchange` listeners a moment, then fail loudly rather
        // than leaving the caller with a promise that never settles.
        closeOwnConnections(dbName);
        if (blockedTimer !== undefined) return;
        blockedTimer = setTimeout(() => {
          blockedTimer = undefined;
          abandonUpgrade(dbName, upgradeDone);
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

      // Resolving after the blocked timeout is a no-op; `abandonUpgrade`
      // owns the connection in that case.
      upgradeDone.then(
        (upgraded) => {
          clearBlockedTimer();
          resolve(upgraded);
        },
        (error) => {
          clearBlockedTimer();
          reject(error);
        }
      );
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
  abandonedUpgrades.clear();
  dbStoreNames.clear();
  config.mode = 'indexeddb';
  config.blockedTimeoutMs = 3000;
}
