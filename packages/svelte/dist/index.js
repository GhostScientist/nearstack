// Svelte store adapter (simple bridge)
import { writable } from 'svelte/store';
export function modelStore(model, id) {
    const store = writable(undefined);
    // Initialize the store with data from the model
    model.store.get(id).then((value) => {
        store.set(value);
    });
    return {
        ...store,
        set: (value) => {
            store.set(value);
            if (value !== undefined) {
                model.store.set(id, value);
            }
        },
    };
}
export function liveQuery(query) {
    const store = writable(undefined);
    // Execute the query and update the store
    query().then((value) => {
        store.set(value);
    });
    return store;
}
//# sourceMappingURL=index.js.map