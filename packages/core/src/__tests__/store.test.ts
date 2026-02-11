import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { defineModel } from '../index';

interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

function useInMemoryWindow() {
  const previousWindow = globalThis.window;
  Object.defineProperty(globalThis, 'window', {
    value: undefined,
    configurable: true,
    writable: true,
  });
  return () => {
    Object.defineProperty(globalThis, 'window', {
      value: previousWindow,
      configurable: true,
      writable: true,
    });
  };
}

describe('core store + model', () => {
  it('supports CRUD through table()', async () => {
    const restore = useInMemoryWindow();
    const model = defineModel<Todo>('todos-test-crud');
    const table = model.table();

    const created = await table.insert({ title: 'Write tests', completed: false });
    expect(created.id).toBeTruthy();

    const fetched = await table.get(created.id);
    expect(fetched?.title).toBe('Write tests');

    const updated = await table.update(created.id, { completed: true });
    expect(updated?.completed).toBe(true);

    await table.delete(created.id);
    expect(await table.get(created.id)).toBeUndefined();
    restore();
  });

  it('fires change events after mutations', async () => {
    const restore = useInMemoryWindow();
    const model = defineModel<Todo>('todos-test-events');
    const callback = vi.fn();
    const unsubscribe = model.subscribe(callback);

    const row = await model.table().insert({ title: 'A', completed: false });
    await model.table().update(row.id, { completed: true });
    await model.table().delete(row.id);

    expect(callback).toHaveBeenCalledTimes(3);
    unsubscribe();
    restore();
  });

  it('falls back to in-memory store when indexeddb is unavailable', async () => {
    const restore = useInMemoryWindow();

    const model = defineModel<Todo>('todos-memory');
    const inserted = await model.table().insert({ title: 'offline', completed: false });

    expect((await model.table().getAll()).map((item) => item.id)).toContain(inserted.id);
    restore();
  });
});
