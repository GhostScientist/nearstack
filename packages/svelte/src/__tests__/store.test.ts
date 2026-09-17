import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineModel, resetStorage } from '@nearstack-dev/core';
import { liveQuery, modelStore, type AsyncState } from '../index';

interface Note {
  id: string;
  text: string;
}

afterEach(() => {
  resetStorage();
});

function latest<T>(states: AsyncState<T>[]): AsyncState<T> {
  return states[states.length - 1] as AsyncState<T>;
}

describe('svelte async stores', () => {
  it('loads and persists model values, including notifications', async () => {
    const model = defineModel<Note>('svelte-model', { storage: 'memory' });
    const store = modelStore(model, 'note-1');
    const states: AsyncState<Note>[] = [];
    const unsubscribe = store.subscribe((state) => states.push(state));

    await store.set({ id: 'note-1', text: 'hello' });

    expect(latest(states)).toMatchObject({
      data: { id: 'note-1', text: 'hello' },
      loading: false,
      error: null,
    });
    unsubscribe();
  });

  it('surfaces write failures and recovers after a later refresh', async () => {
    const model = defineModel<Note>('svelte-write-error', {
      storage: 'memory',
    });
    const store = modelStore(model, 'note-1');
    const states: AsyncState<Note>[] = [];
    const unsubscribe = store.subscribe((state) => states.push(state));
    const failure = new Error('write failed');
    vi.spyOn(model.store, 'set').mockRejectedValueOnce(failure);

    await expect(store.set({ id: 'note-1', text: 'bad' })).rejects.toBe(
      failure
    );
    expect(latest(states).error).toBe(failure);

    await store.set({ id: 'note-1', text: 'good' });
    expect(latest(states).data?.text).toBe('good');
    expect(latest(states).error).toBeNull();
    unsubscribe();
  });

  it('refreshes live queries when a dependent model changes', async () => {
    const model = defineModel<Note>('svelte-live', { storage: 'memory' });
    const store = liveQuery(() => model.table().getAll(), model);
    const states: AsyncState<Note[]>[] = [];
    const unsubscribe = store.subscribe((state) => states.push(state));
    await Promise.resolve();
    await model.table().insert({ text: 'new' });
    await Promise.resolve();
    await Promise.resolve();

    expect(latest(states).data).toHaveLength(1);
    expect(latest(states).error).toBeNull();
    unsubscribe();
  });

  it('does not let stale queries overwrite newer results', async () => {
    let resolveFirst: ((value: string) => void) | undefined;
    let resolveSecond: ((value: string) => void) | undefined;
    const query = vi
      .fn<() => Promise<string>>()
      .mockImplementationOnce(
        () => new Promise((resolve) => (resolveFirst = resolve))
      )
      .mockImplementationOnce(
        () => new Promise((resolve) => (resolveSecond = resolve))
      );
    const store = liveQuery<string>(query);
    const states: AsyncState<string>[] = [];
    const unsubscribe = store.subscribe((state) => states.push(state));
    const newerRequest = store.refresh();

    resolveSecond?.('new');
    await newerRequest;
    await Promise.resolve();
    resolveFirst?.('old');
    await Promise.resolve();

    expect(latest(states).data).toBe('new');
    unsubscribe();
  });

  it('unsubscribes model dependencies when the last listener leaves', async () => {
    const model = defineModel<Note>('svelte-teardown', { storage: 'memory' });
    const query = vi.fn(() => model.table().getAll());
    const store = liveQuery(query, model);
    const unsubscribe = store.subscribe(() => undefined);
    await Promise.resolve();
    const callsBeforeTeardown = query.mock.calls.length;
    unsubscribe();

    await model.table().insert({ text: 'ignored after teardown' });
    await Promise.resolve();
    expect(query.mock.calls.length).toBe(callsBeforeTeardown);
  });
});
