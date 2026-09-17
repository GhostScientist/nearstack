import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  StorageError,
  defineModel,
  requestPersistence,
  resetStorage,
} from '../index';

interface Note {
  id: string;
  title: string;
  body?: string;
}

async function createLegacyDatabase(name: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('notes', { keyPath: 'id' });
    };
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('notes', 'readwrite');
      transaction.objectStore('notes').put({ id: 'legacy', title: 'old' });
      transaction.oncomplete = () => {
        db.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    };
    request.onerror = () => reject(request.error);
  });
}

afterEach(() => {
  resetStorage();
  vi.restoreAllMocks();
});

describe('shared model registrations and migrations', () => {
  it('shares notifications across model instances and preserves other listeners', async () => {
    const first = defineModel<Note>('notes', {
      database: 'shared-notifications',
    });
    const second = defineModel<Note>('notes', {
      database: 'shared-notifications',
    });
    const firstListener = vi.fn();
    const secondListener = vi.fn();
    const unsubscribeFirst = first.subscribe(firstListener);
    second.subscribe(secondListener);

    await second.table().insert({ title: 'hello' });
    expect(firstListener).toHaveBeenCalledTimes(1);
    expect(secondListener).toHaveBeenCalledTimes(1);

    unsubscribeFirst();
    await first.table().insert({ title: 'world' });
    expect(firstListener).toHaveBeenCalledTimes(1);
    expect(secondListener).toHaveBeenCalledTimes(2);
  });

  it('rejects incompatible repeated definitions', () => {
    defineModel<Note>('conflicting', {
      database: 'conflicts',
      schemaVersion: 1,
    });

    expect(() =>
      defineModel<Note>('conflicting', {
        database: 'conflicts',
        schemaVersion: 2,
        migrations: [{ from: 1, to: 2, migrate: (record) => record }],
      })
    ).toThrowError(expect.objectContaining({ code: 'CONFIGURATION_CONFLICT' }));
  });

  it('runs every ordered migration and preserves record ids', async () => {
    const database = 'legacy-migrations';
    await createLegacyDatabase(database);
    const model = defineModel<Note>('notes', {
      database,
      schemaVersion: 3,
      migrations: [
        {
          from: 1,
          to: 2,
          migrate: (record) => ({
            ...record,
            title: record.title.toUpperCase(),
          }),
        },
        {
          from: 2,
          to: 3,
          migrate: (record) => ({ ...record, body: 'added' }),
        },
      ],
    });

    await model.ready();
    expect(await model.table().get('legacy')).toEqual({
      id: 'legacy',
      title: 'OLD',
      body: 'added',
    });
  });

  it('aborts failed migrations and can retry them without partial writes', async () => {
    const database = 'rollback-migrations';
    await createLegacyDatabase(database);
    let shouldFail = true;
    const model = defineModel<Note>('notes', {
      database,
      schemaVersion: 2,
      migrations: [
        {
          from: 1,
          to: 2,
          migrate: (record) => {
            if (shouldFail) throw new Error('migration failed');
            return { ...record, body: 'recovered' };
          },
        },
      ],
    });

    await expect(model.ready()).rejects.toBeInstanceOf(StorageError);
    shouldFail = false;
    await model.ready();
    expect(await model.table().get('legacy')).toMatchObject({
      body: 'recovered',
    });
  });

  it('reports persistence support without changing storage mode', async () => {
    const previousNavigator = Object.getOwnPropertyDescriptor(
      globalThis,
      'navigator'
    );
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { storage: { persist: vi.fn().mockResolvedValue(false) } },
    });
    await expect(requestPersistence()).resolves.toEqual({ state: 'denied' });

    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { storage: { persist: vi.fn().mockResolvedValue(true) } },
    });
    await expect(requestPersistence()).resolves.toEqual({ state: 'granted' });

    if (previousNavigator) {
      Object.defineProperty(globalThis, 'navigator', previousNavigator);
    } else {
      delete (globalThis as { navigator?: unknown }).navigator;
    }
  });
});
