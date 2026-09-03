import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { StorageError, defineModel } from '../index';

interface Row {
  id: string;
  n: number;
  title: string;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`TIMEOUT/HANG: ${label}`)),
        ms
      );
      void promise.finally(() => clearTimeout(timer)).catch(() => undefined);
    }),
  ]);
}

describe('issue #33 regressions', () => {
  it('bug 1: defineModel() after first use does not hang', async () => {
    const early = defineModel<Row>('bug1_early');
    await withTimeout(
      early.table().insert({ n: 1, title: 'early' }),
      2000,
      'early insert'
    );

    const late = defineModel<Row>('bug1_late');
    const inserted = await withTimeout(
      late.table().insert({ n: 2, title: 'late' }),
      2000,
      'late insert'
    );

    expect(inserted.id).toBeTruthy();
    expect(await late.table().getAll()).toHaveLength(1);

    // the previously created model keeps working across the upgrade
    const earlyRows = await withTimeout(
      early.table().getAll(),
      2000,
      'early getAll after upgrade'
    );
    expect(earlyRows).toHaveLength(1);
  });

  it('bug 2: concurrent update() calls do not lose writes', async () => {
    const model = defineModel<Row>('bug2_concurrent');
    const row = await model.table().insert({ n: 0, title: 'orig' });

    await Promise.all([
      model.table().update(row.id, { n: 1 }),
      model.table().update(row.id, { title: 'changed' }),
    ]);

    const final = await model.table().get(row.id);
    expect(final).toMatchObject({ n: 1, title: 'changed' });
  });

  it('bug 3: worker-like context persists to indexeddb', async () => {
    const previousWindow = globalThis.window;
    Object.defineProperty(globalThis, 'window', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    let insertedId: string;
    try {
      const model = defineModel<Row>('bug3_worker');
      const inserted = await withTimeout(
        model.table().insert({ n: 7, title: 'from worker' }),
        2000,
        'worker insert'
      );
      insertedId = inserted.id;
    } finally {
      Object.defineProperty(globalThis, 'window', {
        value: previousWindow,
        configurable: true,
        writable: true,
      });
    }

    // Read through a separate model instance: data must really be in IndexedDB
    const reader = defineModel<Row>('bug3_worker');
    const persisted = await withTimeout(
      reader.table().get(insertedId),
      2000,
      'worker read-back'
    );
    expect(persisted).toMatchObject({ n: 7, title: 'from worker' });
  });

  it('bug 3: unavailable storage fails loudly instead of silently', async () => {
    const previous = Object.getOwnPropertyDescriptor(
      globalThis,
      'indexedDB'
    ) as PropertyDescriptor;
    Object.defineProperty(globalThis, 'indexedDB', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    try {
      const model = defineModel<Row>('bug3_denied');
      const error = await model
        .table()
        .insert({ n: 1, title: 'lost?' })
        .then(
          () => undefined,
          (e: unknown) => e
        );

      expect(error).toBeInstanceOf(StorageError);
      expect((error as StorageError).code).toBe('STORAGE_UNAVAILABLE');
    } finally {
      Object.defineProperty(globalThis, 'indexedDB', previous);
    }
  });

  it('many lazily defined models keep working together', async () => {
    const models = ['lazy_a', 'lazy_b', 'lazy_c', 'lazy_d'].map((name) =>
      defineModel<Row>(name)
    );

    for (const [index, model] of models.entries()) {
      await withTimeout(
        model.table().insert({ n: index, title: model.name }),
        2000,
        `insert into ${model.name}`
      );
    }

    for (const [index, model] of models.entries()) {
      const rows = await withTimeout(
        model.table().getAll(),
        2000,
        `read ${model.name}`
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ n: index, title: model.name });
    }
  });
});
