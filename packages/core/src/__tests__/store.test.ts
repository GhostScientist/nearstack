import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { defineModel } from '../index';

interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

describe('core store + model', () => {
  it('supports CRUD through table()', async () => {
    const model = defineModel<Todo>('todos-test-crud');
    const table = model.table();

    const created = await table.insert({
      title: 'Write tests',
      completed: false,
    });
    expect(created.id).toBeTruthy();

    const fetched = await table.get(created.id);
    expect(fetched?.title).toBe('Write tests');

    const updated = await table.update(created.id, { completed: true });
    expect(updated?.completed).toBe(true);

    await table.delete(created.id);
    expect(await table.get(created.id)).toBeUndefined();
  });

  it('fires change events after mutations', async () => {
    const model = defineModel<Todo>('todos-test-events', {
      storage: 'memory',
    });
    const callback = vi.fn();
    const unsubscribe = model.subscribe(callback);

    const row = await model.table().insert({ title: 'A', completed: false });
    await model.table().update(row.id, { completed: true });
    await model.table().delete(row.id);

    expect(callback).toHaveBeenCalledTimes(3);
    unsubscribe();
  });

  it('supports an explicit in-memory store', async () => {
    const model = defineModel<Todo>('todos-memory', { storage: 'memory' });
    const inserted = await model
      .table()
      .insert({ title: 'offline', completed: false });

    expect((await model.table().getAll()).map((item) => item.id)).toContain(
      inserted.id
    );
    await expect(model.ready()).resolves.toMatchObject({
      backend: 'memory',
      persistent: false,
    });
  });

  it('fires change events with indexeddb store', async () => {
    const model = defineModel<Todo>('todos-indexeddb-events');
    const callback = vi.fn();
    const unsubscribe = model.subscribe(callback);

    try {
      const row = await model
        .table()
        .insert({ title: 'IndexedDB test', completed: false });
      await model.table().update(row.id, { completed: true });
      await model.table().delete(row.id);

      expect(callback).toHaveBeenCalledTimes(3);
    } finally {
      unsubscribe();
    }
  });

  it('stops notifying after unsubscribe', async () => {
    const model = defineModel<Todo>('todos-unsubscribe');
    const callback = vi.fn();
    model.subscribe(callback)();

    await model.table().insert({ title: 'quiet', completed: false });
    expect(callback).not.toHaveBeenCalled();
  });

  it('notifies every subscriber', async () => {
    const model = defineModel<Todo>('todos-multi-subscriber');
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = model.subscribe(first);
    const unsubscribeSecond = model.subscribe(second);

    try {
      await model.table().insert({ title: 'shared', completed: false });
      expect(first).toHaveBeenCalledTimes(1);
      expect(second).toHaveBeenCalledTimes(1);
    } finally {
      unsubscribeFirst();
      unsubscribeSecond();
    }
  });

  it('filters rows with find()', async () => {
    const model = defineModel<Todo>('todos-find');
    const table = model.table();

    await table.insert({ title: 'done', completed: true });
    await table.insert({ title: 'pending', completed: false });
    await table.insert({ title: 'also done', completed: true });

    const done = await table.find((todo) => todo.completed);
    expect(done).toHaveLength(2);
    expect(done.map((todo) => todo.title).sort()).toEqual([
      'also done',
      'done',
    ]);
  });

  it('returns undefined for missing rows and no-ops on missing deletes', async () => {
    const model = defineModel<Todo>('todos-missing');
    const table = model.table();

    expect(await table.get('missing')).toBeUndefined();
    expect(await table.update('missing', { completed: true })).toBeUndefined();
    await expect(table.delete('missing')).resolves.toBeUndefined();
  });

  it('keeps different models isolated', async () => {
    const a = defineModel<Todo>('todos-isolated-a');
    const b = defineModel<Todo>('todos-isolated-b');

    await a.table().insert({ title: 'only in a', completed: false });

    expect(await a.table().getAll()).toHaveLength(1);
    expect(await b.table().getAll()).toHaveLength(0);
  });

  it('exposes the underlying store and model name', async () => {
    const model = defineModel<Todo>('todos-shape');

    expect(model.name).toBe('todos-shape');
    expect(typeof model.store.insert).toBe('function');
    expect(typeof model.ready).toBe('function');
  });

  it('persists across separate model instances of the same name', async () => {
    const writer = defineModel<Todo>('todos-persisted');
    const created = await writer
      .table()
      .insert({ title: 'durable', completed: false });

    const reader = defineModel<Todo>('todos-persisted');
    expect(await reader.table().get(created.id)).toMatchObject({
      title: 'durable',
    });
  });
});
