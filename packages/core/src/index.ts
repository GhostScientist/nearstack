// IndexedDB runtime, defineModel(), base Store interface

export interface Store<T = any> {
  get(id: string): Promise<T | undefined>;
  set(id: string, value: T): Promise<void>;
  delete(id: string): Promise<void>;
  getAll(): Promise<T[]>;
}

export interface Model<T = any> {
  name: string;
  store: Store<T>;
}

export function defineModel<T = any>(name: string): Model<T> {
  // Stub implementation - will be replaced with IndexedDB runtime
  const store: Store<T> = {
    async get(id: string) {
      return undefined;
    },
    async set(id: string, value: T) {},
    async delete(id: string) {},
    async getAll() {
      return [];
    },
  };

  return {
    name,
    store,
  };
}

export { defineModule } from './legacy.js';
