// Svelte store adapter (simple bridge)

import { writable, type Writable } from 'svelte/store';
import type { Model } from '@nearstack-dev/core';

export function modelStore<T = any>(
  model: Model<T>,
  id: string
): Writable<T | undefined> {
  const store = writable<T | undefined>(undefined);

  // Initialize the store with data from the model
  model.store.get(id).then((value) => {
    store.set(value);
  });

  return {
    ...store,
    set: (value: T | undefined) => {
      store.set(value);
      if (value !== undefined) {
        model.store.set(id, value);
      }
    },
  };
}

export function liveQuery<T = any>(query: () => Promise<T>): Writable<T | undefined> {
  const store = writable<T | undefined>(undefined);

  // Execute the query and update the store
  query().then((value) => {
    store.set(value);
  });

  return store;
}
