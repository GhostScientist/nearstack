// IndexedDB runtime, defineModel(), base Store interface
export function defineModel(name) {
    // Stub implementation - will be replaced with IndexedDB runtime
    const store = {
        async get(id) {
            return undefined;
        },
        async set(id, value) { },
        async delete(id) { },
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
//# sourceMappingURL=index.js.map