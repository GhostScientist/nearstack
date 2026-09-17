import type { Model, Unsubscribe } from '@nearstack-dev/core';

type ModelDependency = Pick<Model, 'subscribe'>;

export interface AsyncState<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
}

export interface AsyncStore<T> {
  subscribe(run: (value: AsyncState<T>) => void): Unsubscribe;
  refresh(): Promise<void>;
  /** Persist the value before resolving; failures remain visible in `error`. */
  set(value: T | undefined): Promise<void>;
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function createAsyncStore<T>(
  query: () => Promise<T | undefined>,
  write?: (value: T | undefined) => Promise<void>,
  dependencies: readonly ModelDependency[] = []
): AsyncStore<T> {
  let state: AsyncState<T> = {
    data: undefined,
    loading: false,
    error: null,
  };
  const subscribers = new Set<(value: AsyncState<T>) => void>();
  let stopDependencies: Unsubscribe[] = [];
  let requestId = 0;

  const publish = (next: AsyncState<T>) => {
    state = next;
    for (const subscriber of [...subscribers]) subscriber(state);
  };

  const refresh = async (): Promise<void> => {
    const currentRequest = ++requestId;
    publish({ ...state, loading: true, error: null });
    try {
      const data = await query();
      if (currentRequest !== requestId) return;
      publish({ data, loading: false, error: null });
    } catch (error) {
      if (currentRequest !== requestId) return;
      publish({ ...state, loading: false, error: asError(error) });
    }
  };

  const start = () => {
    void refresh();
    stopDependencies = dependencies.map((model) =>
      model.subscribe(() => {
        void refresh();
      })
    );
  };

  const stop = () => {
    requestId += 1;
    for (const unsubscribe of stopDependencies) unsubscribe();
    stopDependencies = [];
  };

  return {
    subscribe(run) {
      const wasEmpty = subscribers.size === 0;
      subscribers.add(run);
      run(state);
      if (wasEmpty) start();
      return () => {
        subscribers.delete(run);
        if (subscribers.size === 0) stop();
      };
    },
    refresh,
    async set(value) {
      if (!write) throw new Error('This store is read-only.');
      publish({ ...state, loading: true, error: null });
      try {
        await write(value);
        await refresh();
      } catch (error) {
        publish({ ...state, loading: false, error: asError(error) });
        throw error;
      }
    },
  };
}

export function modelStore<T extends { id: string }>(
  model: Model<T>,
  id: string
): AsyncStore<T> {
  return createAsyncStore(
    () => model.store.get(id),
    async (value) => {
      if (value === undefined) {
        await model.store.delete(id);
      } else {
        await model.store.set(id, value);
      }
    },
    [model]
  );
}

export function liveQuery<T>(
  query: () => Promise<T>,
  models: ModelDependency | readonly ModelDependency[] = []
): AsyncStore<T> {
  const dependencies = Array.isArray(models) ? models : [models];
  return createAsyncStore(query, undefined, dependencies);
}
