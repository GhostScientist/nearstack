# @nearstack-dev/core

IndexedDB-backed data models for local-first browser apps. Define typed models, get automatic persistence with zero configuration.

## Install

```bash
npm install @nearstack-dev/core
```

## Quick start

```ts
import { defineModel } from "@nearstack-dev/core";

type Todo = {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
};

export const TodoModel = defineModel<Todo>("todo");
```

That single call gives you a fully typed, IndexedDB-backed model. Use `.table()` to read and write data:

```ts
const table = TodoModel.table();

// Insert (id is auto-generated)
const todo = await table.insert({
  title: "Buy milk",
  done: false,
  createdAt: new Date().toISOString(),
});

// Read
const all = await table.getAll();
const one = await table.get(todo.id);
const active = await table.find((t) => !t.done);

// Update
await table.update(todo.id, { done: true });

// Delete
await table.delete(todo.id);
```

## API

### `defineModel<T>(name)`

Creates a named model backed by an IndexedDB object store.

- `name` — unique store name within the `nearstack` database
- `T` — must include `{ id: string }`

Returns a `Model<T>` with:

| Property / Method | Description |
|---|---|
| `name` | The store name |
| `store` | Low-level `Store<T>` (get, set, delete, getAll, insert, update) |
| `table()` | Returns a `Table<T>` with higher-level query methods |
| `subscribe(cb)` | Listen for data changes. Returns an unsubscribe function |

### `Table<T>`

| Method | Description |
|---|---|
| `insert(value)` | Insert a record. `id` is auto-generated via `crypto.randomUUID()` |
| `get(id)` | Get a single record by id |
| `getAll()` | Get all records |
| `find(predicate)` | Filter records with a predicate function |
| `update(id, partial)` | Merge partial fields into an existing record |
| `delete(id)` | Delete a record by id |

### `subscribe(callback)`

Registers a listener that fires after any insert, update, or delete:

```ts
const unsubscribe = TodoModel.subscribe(() => {
  console.log("data changed");
});

// Later
unsubscribe();
```

## Multiple models

Define as many models as you need. They all share a single `nearstack` IndexedDB database. The library automatically manages schema upgrades when new models are added:

```ts
export const UserModel = defineModel<User>("user");
export const PostModel = defineModel<Post>("post");
export const CommentModel = defineModel<Comment>("comment");
```

## Offline fallback

If IndexedDB is unavailable (e.g. certain private browsing modes), the library silently falls back to in-memory storage. Data won't persist across page reloads, but the app continues to work.

## License

MIT
