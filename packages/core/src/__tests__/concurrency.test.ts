import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { defineModel } from '../index';

interface Doc {
  id: string;
  n: number;
  title: string;
  body: string;
}

describe('concurrent writes', () => {
  it('merges concurrent updates to different fields', async () => {
    const model = defineModel<Doc>('conc_two_fields');
    const row = await model
      .table()
      .insert({ n: 0, title: 'orig', body: 'body' });

    await Promise.all([
      model.table().update(row.id, { n: 1 }),
      model.table().update(row.id, { title: 'changed' }),
    ]);

    expect(await model.table().get(row.id)).toMatchObject({
      n: 1,
      title: 'changed',
      body: 'body',
    });
  });

  it('applies many concurrent field updates without losing any', async () => {
    const model = defineModel<Doc>('conc_many');
    const row = await model.table().insert({ n: 0, title: 't', body: 'b' });

    await Promise.all([
      model.table().update(row.id, { n: 42 }),
      model.table().update(row.id, { title: 'a' }),
      model.table().update(row.id, { body: 'c' }),
      model.table().update(row.id, { title: 'final' }),
    ]);

    const final = await model.table().get(row.id);
    expect(final?.n).toBe(42);
    expect(final?.body).toBe('c');
    expect(final?.title).toBe('final');
  });

  it('serializes updates so the last write to a field wins', async () => {
    const model = defineModel<Doc>('conc_last_write');
    const row = await model.table().insert({ n: 0, title: 't', body: 'b' });

    const results = await Promise.all(
      [1, 2, 3, 4, 5].map((n) => model.table().update(row.id, { n }))
    );

    const stored = await model.table().get(row.id);
    expect(stored?.n).toBe(results[results.length - 1]?.n);
    expect(stored?.n).toBe(5);
  });

  it('simulates a debounced editor saving two fields at once', async () => {
    const model = defineModel<Doc>('conc_editor');
    const row = await model
      .table()
      .insert({ n: 0, title: 'Untitled', body: '' });

    // Two debounced saves fire in the same tick, as in the notes template.
    await Promise.all([
      model.table().update(row.id, { title: 'My note' }),
      model.table().update(row.id, { body: 'Hello world' }),
    ]);

    expect(await model.table().get(row.id)).toMatchObject({
      title: 'My note',
      body: 'Hello world',
    });
  });

  it('returns undefined and does not notify when updating a missing row', async () => {
    const model = defineModel<Doc>('conc_missing');
    const callback = vi.fn();
    const unsubscribe = model.subscribe(callback);

    try {
      expect(await model.table().update('nope', { n: 1 })).toBeUndefined();
      expect(callback).not.toHaveBeenCalled();
    } finally {
      unsubscribe();
    }
  });

  it('never lets an update change the record id', async () => {
    const model = defineModel<Doc>('conc_id_guard');
    const row = await model.table().insert({ n: 0, title: 't', body: 'b' });

    const updated = await model
      .table()
      .update(row.id, { id: 'hijacked', n: 9 } as Partial<Doc>);

    expect(updated?.id).toBe(row.id);
    expect(await model.table().get('hijacked')).toBeUndefined();
    expect(await model.table().get(row.id)).toMatchObject({ id: row.id, n: 9 });
  });

  it('handles concurrent inserts without collisions', async () => {
    const model = defineModel<Doc>('conc_inserts');

    const rows = await Promise.all(
      Array.from({ length: 10 }, (_, n) =>
        model.table().insert({ n, title: `t${n}`, body: '' })
      )
    );

    const ids = new Set(rows.map((row) => row.id));
    expect(ids.size).toBe(10);
    expect(await model.table().getAll()).toHaveLength(10);
  });

  it('handles concurrent update and delete of the same row', async () => {
    const model = defineModel<Doc>('conc_update_delete');
    const row = await model.table().insert({ n: 0, title: 't', body: 'b' });

    await Promise.all([
      model.table().update(row.id, { n: 1 }),
      model.table().delete(row.id),
    ]);

    expect(await model.table().get(row.id)).toBeUndefined();
  });
});
