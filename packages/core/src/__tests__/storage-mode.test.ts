import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  StorageError,
  configureStorage,
  defineModel,
  getStorageConfig,
} from '../index';

interface Row {
  id: string;
  value: string;
}

function withoutIndexedDB(): () => void {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  Object.defineProperty(globalThis, 'indexedDB', {
    value: undefined,
    configurable: true,
    writable: true,
  });
  return () => {
    if (previous) {
      Object.defineProperty(globalThis, 'indexedDB', previous);
    } else {
      delete (globalThis as { indexedDB?: unknown }).indexedDB;
    }
  };
}

afterEach(() => {
  configureStorage({ mode: 'indexeddb', blockedTimeoutMs: 3000 });
  vi.restoreAllMocks();
});

describe('storage modes', () => {
  it('defaults to requiring IndexedDB', () => {
    expect(getStorageConfig().mode).toBe('indexeddb');
  });

  it('reports a persistent backend when IndexedDB is available', async () => {
    const model = defineModel<Row>('mode_persistent');
    await expect(model.ready()).resolves.toEqual({
      backend: 'indexeddb',
      persistent: true,
    });
  });

  it('rejects every operation when storage is unavailable', async () => {
    const restore = withoutIndexedDB();
    try {
      const model = defineModel<Row>('mode_unavailable');
      await expect(model.ready()).rejects.toBeInstanceOf(StorageError);
      await expect(model.table().getAll()).rejects.toBeInstanceOf(StorageError);
      await expect(model.table().insert({ value: 'x' })).rejects.toBeInstanceOf(
        StorageError
      );
      await expect(model.table().get('missing')).rejects.toBeInstanceOf(
        StorageError
      );
      await expect(model.table().update('missing', {})).rejects.toBeInstanceOf(
        StorageError
      );
      await expect(model.table().delete('missing')).rejects.toBeInstanceOf(
        StorageError
      );
    } finally {
      restore();
    }
  });

  it('surfaces STORAGE_UNAVAILABLE as the error code', async () => {
    const restore = withoutIndexedDB();
    try {
      const model = defineModel<Row>('mode_code');
      await model.ready().then(
        () => expect.unreachable('ready() should reject'),
        (error: StorageError) => {
          expect(error.code).toBe('STORAGE_UNAVAILABLE');
          expect(error.name).toBe('StorageError');
        }
      );
    } finally {
      restore();
    }
  });

  it('retries initialization once storage becomes available again', async () => {
    const restore = withoutIndexedDB();
    const model = defineModel<Row>('mode_retry');
    try {
      await expect(model.ready()).rejects.toBeInstanceOf(StorageError);
    } finally {
      restore();
    }

    await expect(model.ready()).resolves.toMatchObject({
      backend: 'indexeddb',
      persistent: true,
    });
    const row = await model.table().insert({ value: 'recovered' });
    expect(await model.table().get(row.id)).toMatchObject({
      value: 'recovered',
    });
  });

  it('uses in-memory storage only when explicitly requested', async () => {
    const model = defineModel<Row>('mode_memory', { storage: 'memory' });
    await expect(model.ready()).resolves.toMatchObject({
      backend: 'memory',
      persistent: false,
    });

    const row = await model.table().insert({ value: 'ephemeral' });
    expect(await model.table().get(row.id)).toMatchObject({
      value: 'ephemeral',
    });

    // A separate instance of the same model name shares nothing.
    const other = defineModel<Row>('mode_memory', { storage: 'memory' });
    expect(await other.table().getAll()).toHaveLength(0);
  });

  it('does not register memory-only models in the shared schema', async () => {
    defineModel<Row>('mode_never_persisted', { storage: 'memory' });
    const probe = defineModel<Row>('mode_probe');
    await probe.ready();

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('nearstack');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      expect(db.objectStoreNames.contains('mode_never_persisted')).toBe(false);
      expect(db.objectStoreNames.contains('mode_probe')).toBe(true);
    } finally {
      db.close();
    }
  });

  it('auto mode falls back to memory and reports the degraded state', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const restore = withoutIndexedDB();
    try {
      const model = defineModel<Row>('mode_auto', { storage: 'auto' });
      const status = await model.ready();

      expect(status.backend).toBe('memory');
      expect(status.persistent).toBe(false);
      expect(status.reason).toBeTruthy();
      expect(warn).toHaveBeenCalled();

      const row = await model.table().insert({ value: 'degraded' });
      expect(await model.table().get(row.id)).toMatchObject({
        value: 'degraded',
      });
    } finally {
      restore();
    }
  });

  it('honours the configured global default mode', async () => {
    configureStorage({ mode: 'memory' });
    expect(getStorageConfig().mode).toBe('memory');

    const model = defineModel<Row>('mode_global_default');
    await expect(model.ready()).resolves.toMatchObject({ backend: 'memory' });
  });

  it('keeps separate databases isolated', async () => {
    const a = defineModel<Row>('shared_name', { database: 'nearstack-alt-a' });
    const b = defineModel<Row>('shared_name', { database: 'nearstack-alt-b' });

    await a.table().insert({ value: 'in-a' });

    expect(await a.table().getAll()).toHaveLength(1);
    expect(await b.table().getAll()).toHaveLength(0);
  });
});
