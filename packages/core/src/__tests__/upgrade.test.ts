import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StorageError, configureStorage, defineModel } from '../index';

interface Row {
  id: string;
  n: number;
}

function openRaw(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

afterEach(() => {
  configureStorage({ mode: 'indexeddb', blockedTimeoutMs: 3000 });
  vi.restoreAllMocks();
});

describe('schema upgrades', () => {
  it('rejects with UPGRADE_BLOCKED instead of hanging', async () => {
    const first = defineModel<Row>('blocked_first');
    await first.table().insert({ n: 1 });

    // A connection that ignores `versionchange`, i.e. another tab.
    const squatter = await openRaw('nearstack');
    configureStorage({ blockedTimeoutMs: 50 });

    try {
      const second = defineModel<Row>('blocked_second');
      const error = await second.ready().then(
        () => undefined,
        (e: unknown) => e
      );

      expect(error).toBeInstanceOf(StorageError);
      expect((error as StorageError).code).toBe('UPGRADE_BLOCKED');
      expect((error as StorageError).message).toMatch(/blocked/i);
    } finally {
      squatter.close();
    }
  });

  it('recovers once the blocking connection closes', async () => {
    const first = defineModel<Row>('recover_first');
    await first.table().insert({ n: 1 });

    const squatter = await openRaw('nearstack');
    configureStorage({ blockedTimeoutMs: 50 });

    const second = defineModel<Row>('recover_second');
    await expect(second.ready()).rejects.toBeInstanceOf(StorageError);

    squatter.close();
    configureStorage({ blockedTimeoutMs: 3000 });

    await expect(second.ready()).resolves.toMatchObject({
      backend: 'indexeddb',
    });
    const row = await second.table().insert({ n: 2 });
    expect(await second.table().get(row.id)).toMatchObject({ n: 2 });
    expect(await first.table().getAll()).toHaveLength(1);
  });

  it('does not strand other models behind an abandoned blocked upgrade', async () => {
    const working = defineModel<Row>('strand_working');
    await working.table().insert({ n: 1 });

    const squatter = await openRaw('nearstack');
    configureStorage({ blockedTimeoutMs: 50 });

    try {
      const late = defineModel<Row>('strand_late');
      await expect(late.ready()).rejects.toBeInstanceOf(StorageError);

      // The abandoned upgrade request is still queued inside IndexedDB, so a
      // read on the already-working model must fail fast rather than queue
      // behind it forever.
      const result = await Promise.race([
        working
          .table()
          .getAll()
          .then(
            () => 'resolved',
            (error: unknown) => error
          ),
        new Promise((resolve) => setTimeout(() => resolve('HUNG'), 2000)),
      ]);

      expect(result).not.toBe('HUNG');
      expect(result).toBeInstanceOf(StorageError);
      expect((result as StorageError).code).toBe('UPGRADE_BLOCKED');
    } finally {
      squatter.close();
    }

    // ...and everything recovers once the blocker goes away.
    configureStorage({ blockedTimeoutMs: 3000 });
    expect(await working.table().getAll()).toHaveLength(1);
  });

  it('closes our own connections on versionchange', async () => {
    const first = defineModel<Row>('vc_first');
    await first.table().insert({ n: 1 });

    // Registering a new store forces an upgrade; the connection held by
    // `first` must close so the upgrade is not blocked by us.
    const second = defineModel<Row>('vc_second');
    await expect(second.ready()).resolves.toMatchObject({
      backend: 'indexeddb',
      persistent: true,
    });

    // The previously created model transparently reopens.
    expect(await first.table().getAll()).toHaveLength(1);
  });

  it('auto mode does not degrade permanently on a transient blocked upgrade', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const first = defineModel<Row>('auto_blocked_first');
    await first.table().insert({ n: 1 });

    const squatter = await openRaw('nearstack');
    configureStorage({ blockedTimeoutMs: 50 });

    const late = defineModel<Row>('auto_blocked_late', { storage: 'auto' });

    // A blocked upgrade is transient, so `auto` must surface it rather than
    // silently switching to an empty in-memory store forever.
    const error = await late.ready().then(
      () => undefined,
      (e: unknown) => e
    );
    expect(error).toBeInstanceOf(StorageError);
    expect((error as StorageError).code).toBe('UPGRADE_BLOCKED');
    expect(warn).not.toHaveBeenCalled();

    squatter.close();
    configureStorage({ blockedTimeoutMs: 3000 });

    await expect(late.ready()).resolves.toMatchObject({
      backend: 'indexeddb',
      persistent: true,
    });

    const row = await late.table().insert({ n: 99 });
    const reader = defineModel<Row>('auto_blocked_late');
    expect(await reader.table().get(row.id)).toMatchObject({ n: 99 });
  });

  it('creates one object store per model in the shared database', async () => {
    const names = ['schema_a', 'schema_b', 'schema_c'];
    for (const name of names) {
      const model = defineModel<Row>(name);
      await model.table().insert({ n: 1 });
    }

    const db = await openRaw('nearstack');
    try {
      for (const name of names) {
        expect(db.objectStoreNames.contains(name)).toBe(true);
      }
    } finally {
      db.close();
    }
  });

  it('registering the same model twice does not force an upgrade', async () => {
    const a = defineModel<Row>('dup_model');
    await a.table().insert({ n: 1 });
    const versionBefore = await openRaw('nearstack').then((db) => {
      const version = db.version;
      db.close();
      return version;
    });

    const b = defineModel<Row>('dup_model');
    await b.ready();

    const versionAfter = await openRaw('nearstack').then((db) => {
      const version = db.version;
      db.close();
      return version;
    });

    expect(versionAfter).toBe(versionBefore);
    expect(await b.table().getAll()).toHaveLength(1);
  });

  it('survives a new model being registered while writes are in flight', async () => {
    const existing = defineModel<Row>('inflight_existing');
    await existing.table().insert({ n: 0 });

    // Kick off work, then register a brand new model in the same tick so the
    // schema upgrade races the in-flight operations.
    const pending = [
      existing.table().insert({ n: 1 }),
      existing.table().getAll(),
    ];
    const late = defineModel<Row>('inflight_late');
    pending.push(late.table().insert({ n: 2 }));

    await Promise.all(pending);

    expect(await existing.table().getAll()).toHaveLength(2);
    expect(await late.table().getAll()).toHaveLength(1);
  });

  it('supports interleaved reads and writes across many models', async () => {
    const models = Array.from({ length: 5 }, (_, i) =>
      defineModel<Row>(`interleaved_${i}`)
    );

    await Promise.all(models.map((model, i) => model.table().insert({ n: i })));
    const results = await Promise.all(
      models.map((model) => model.table().getAll())
    );

    results.forEach((rows, i) => {
      expect(rows).toHaveLength(1);
      expect(rows[0]?.n).toBe(i);
    });
  });
});
