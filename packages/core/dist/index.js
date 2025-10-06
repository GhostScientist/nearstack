// IndexedDB runtime, defineModel(), base Store interface
// In-memory storage implementation (will be replaced with IndexedDB)
class InMemoryStore {
    constructor() {
        this.data = new Map();
        this.idCounter = 0;
    }
    async get(id) {
        return this.data.get(id);
    }
    async set(id, value) {
        this.data.set(id, value);
    }
    async delete(id) {
        this.data.delete(id);
    }
    async getAll() {
        return Array.from(this.data.values());
    }
    async insert(value) {
        const id = `${++this.idCounter}`;
        const item = { ...value, id };
        await this.set(id, item);
        return item;
    }
    async update(id, value) {
        const existing = await this.get(id);
        if (!existing)
            return undefined;
        const updated = { ...existing, ...value };
        await this.set(id, updated);
        return updated;
    }
}
class TableImpl {
    constructor(store) {
        this.store = store;
    }
    async insert(value) {
        return this.store.insert(value);
    }
    async update(id, value) {
        return this.store.update(id, value);
    }
    async delete(id) {
        return this.store.delete(id);
    }
    async get(id) {
        return this.store.get(id);
    }
    async getAll() {
        return this.store.getAll();
    }
    async find(predicate) {
        const all = await this.getAll();
        return all.filter(predicate);
    }
}
export function defineModel(name) {
    const store = new InMemoryStore();
    return {
        name,
        store,
        table() {
            return new TableImpl(store);
        },
    };
}
export { defineModule } from './legacy.js';
//# sourceMappingURL=index.js.map