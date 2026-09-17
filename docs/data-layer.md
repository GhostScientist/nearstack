# Data Layer

The data layer is the foundation of Nearstack. It provides persistent, reactive storage backed by IndexedDB with an API designed to feel like working with a database.

## Overview

```typescript
import { defineModel } from '@nearstack-dev/core';

interface Note {
  id: string;
  title: string;
  content: string;
}

const NoteModel = defineModel<Note>('notes');
```

This single line creates:

- An IndexedDB object store named `'notes'` in the `'nearstack'` database
- A `table()` interface for CRUD operations
- A `subscribe()` method for change notifications
- A `ready()` method that resolves once storage is initialized

## Models

### Defining models

Every model requires an `id: string` field. This is the primary key, auto-generated using `crypto.randomUUID()` on insert.

```typescript
interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
}

const TodoModel = defineModel<Todo>('todos');
```

The string passed to `defineModel` is the IndexedDB store name. Use it consistently—changing it means losing access to existing data.

### Model interface

```typescript
interface Model<T> {
  name: string; // Store name
  store: Store<T>; // Low-level store access
  table(): Table<T>; // High-level query interface
  subscribe(callback: () => void): () => void; // Change notifications
}
```

## Table operations

The `table()` method returns a `Table<T>` interface for all data operations.

### Insert

```typescript
const note = await NoteModel.table().insert({
  title: 'Meeting notes',
  content: 'Discussed the roadmap...',
  createdAt: Date.now(),
});
// note.id is auto-generated
```

The `id` field is omitted from the input and auto-generated. The returned object includes the generated `id`.

### Get

```typescript
// Single record by ID
const note = await NoteModel.table().get('some-uuid');
// Returns T | undefined

// All records
const notes = await NoteModel.table().getAll();
// Returns T[]
```

### Find

```typescript
// Client-side filtering
const recent = await NoteModel.table().find(
  (note) => note.createdAt > Date.now() - 86400000
);

const tagged = await NoteModel.table().find((note) =>
  note.tags.includes('work')
);
```

`find()` loads all records and filters in memory. This works well for typical local-first datasets (hundreds to low thousands of records). For larger datasets, consider filtering at the application level after `getAll()`.

### Update

```typescript
// Partial update — only specified fields change
await NoteModel.table().update(noteId, {
  title: 'Updated title',
  updatedAt: Date.now(),
});
// Returns T | undefined (the updated record)
```

### Delete

```typescript
await NoteModel.table().delete(noteId);
```

## Subscriptions

Subscribe to a model to get notified when any data in that store changes:

```typescript
const unsubscribe = NoteModel.subscribe(() => {
  console.log('Notes data changed');
});

// Later
unsubscribe();
```

Subscriptions fire after any `insert`, `update`, or `delete` operation. They don't tell you _what_ changed—just that something did. This is by design: the subscription triggers a re-query, and the query determines the new state.

### Pattern: reactive UI

```typescript
// Subscribe and re-fetch
NoteModel.subscribe(async () => {
  const notes = await NoteModel.table().getAll();
  renderNoteList(notes);
});
```

In React, `useLiveQuery` handles this pattern automatically:

```typescript
const { data: notes } = useLiveQuery(
  () => NoteModel.table().getAll(),
  [],
  NoteModel // Pass model to auto-subscribe
);
```

In Svelte, the async bindings expose the same lifecycle explicitly. The
returned store has `{ data, loading, error }` state, and `set()` resolves only
after the model write has completed:

```svelte
<script lang="ts">
  import { liveQuery, modelStore } from '@nearstack-dev/svelte';

  const notes = liveQuery(() => NoteModel.table().getAll(), NoteModel);
  const selected = modelStore(NoteModel, noteId);
</script>

{#if $notes.loading}
  <p>Loading…</p>
{:else if $notes.error}
  <p>{$notes.error.message}</p>
{:else}
  {#each $notes.data ?? [] as note}
    <p>{note.title}</p>
  {/each}
{/if}
```

Async refreshes are lifecycle-managed, stale results cannot overwrite newer
ones, and failed reads or writes remain visible through `error` until the
next successful refresh.

## Multiple models

You can define as many models as your application needs:

```typescript
const NoteModel = defineModel<Note>('notes');
const ProjectModel = defineModel<Project>('projects');
const TagModel = defineModel<Tag>('tags');
const SettingsModel = defineModel<Settings>('settings');
```

Each model gets its own IndexedDB object store. They share the same `'nearstack'` database.

### Relationships between models

IndexedDB doesn't have foreign keys or joins. Model relationships are managed in application code:

```typescript
interface Note {
  id: string;
  title: string;
  projectId: string; // Reference to a Project
}

interface Project {
  id: string;
  name: string;
}

// Fetch notes for a project
const projectNotes = await NoteModel.table().find(
  (note) => note.projectId === project.id
);

// Fetch a note's project
const note = await NoteModel.table().get(noteId);
const project = note
  ? await ProjectModel.table().get(note.projectId)
  : undefined;
```

## Storage details

### IndexedDB

Data is stored in the browser's IndexedDB under database name `'nearstack'`. Each model creates an object store with key path `'id'`.

IndexedDB data persists across:

- Page refreshes
- Browser restarts
- System reboots

It does **not** persist across:

- Clearing browser data
- Incognito/private browsing sessions
- Different browsers or devices

### When storage is unavailable

If IndexedDB is unavailable — a locked-down context, or storage denied in
Safari private browsing — nearstack **fails loudly** rather than silently
pretending to persist. Every table operation rejects with a `StorageError`
whose `code` is `'STORAGE_UNAVAILABLE'`:

```ts
import { StorageError, defineModel } from '@nearstack-dev/core';

const NoteModel = defineModel<Note>('notes');

try {
  await NoteModel.ready();
} catch (error) {
  if (error instanceof StorageError) {
    // Show the user that their data can't be saved.
  }
}
```

`ready()` resolves with a `StorageStatus` describing the backend in use:

```ts
const status = await NoteModel.ready();
// { backend: 'indexeddb', persistent: true }
```

Non-persistent storage is **opt-in**. Pass `storage: 'memory'` for a
deliberately ephemeral store (tests, previews), or `storage: 'auto'` to prefer
IndexedDB and degrade to memory when it is permanently unavailable. `'auto'`
does _not_ degrade on transient failures such as `'UPGRADE_BLOCKED'` — those
are surfaced and retried, so a momentarily blocked upgrade can never strand a
model on an empty in-memory store:

```ts
const Draft = defineModel<Draft>('drafts', { storage: 'memory' });

const Notes = defineModel<Note>('notes', { storage: 'auto' });
const status = await Notes.ready();
if (!status.persistent) {
  console.warn(`Running without persistence: ${status.reason}`);
}
```

You can change the default for every model with `configureStorage`:

```ts
import { configureStorage } from '@nearstack-dev/core';

configureStorage({ mode: 'auto' });
```

### Workers and Service Workers

Storage detection reads `indexedDB` from `globalThis`, so models work in
Workers and Service Workers, where `indexedDB` exists but `window` does not.

### Defining models lazily

`defineModel()` may be called at any time, including from a lazily imported
route or a code-split chunk. Registering a new model after the shared database
is already open triggers a schema upgrade: existing connections close on
`versionchange` and reopen transparently. If another tab holds the database
open and never closes it, the upgrade rejects with a `StorageError` whose
`code` is `'UPGRADE_BLOCKED'` instead of hanging. That request stays queued
inside IndexedDB, so nearstack waits for it to drain before opening again —
other models fail fast with `'UPGRADE_BLOCKED'` rather than queueing behind it,
and everything recovers automatically once the other tab closes.

### Storage limits

IndexedDB storage limits vary by browser:

- **Chrome**: Up to 80% of available disk space
- **Firefox**: Up to 50% of available disk space (max 2 GB)
- **Safari**: Up to 1 GB, with prompts for more

For typical local-first applications (notes, todos, contacts), you won't hit these limits.

### Schema migrations

Model schema versions are separate from IndexedDB's structural database version.
Existing records without metadata are treated as schema version `1`. Set the
application schema version and provide one synchronous step for each version
boundary:

```typescript
interface VersionedNote {
  id: string;
  title: string;
  content?: string;
  body?: string;
  archived?: boolean;
}

const Notes = defineModel<VersionedNote>('notes', {
  schemaVersion: 3,
  migrations: [
    {
      from: 1,
      to: 2,
      migrate: (note) => ({ ...note, body: note.body ?? note.content ?? '' }),
    },
    {
      from: 2,
      to: 3,
      migrate: (note) => ({ ...note, archived: false }),
    },
  ],
});

await Notes.ready();
```

Nearstack applies all missing steps, including when a device skips a release.
Each model's records and its version metadata are committed in one IndexedDB
transaction. A thrown migration aborts the transaction and leaves the previous
records and version available for a later retry. Migration callbacks must be
synchronous: network requests and `async` callbacks are rejected. Record IDs
are preserved even if a callback returns a different ID.

Defining the same database/model more than once is supported when the resolved
storage mode, target schema version, and migration definitions agree. A
configuration conflict throws `StorageError` with code
`CONFIGURATION_CONFLICT`; it is not silently resolved by whichever definition
runs first. Opening data newer than the application understands throws
`SCHEMA_VERSION_UNSUPPORTED`, and a missing version step throws
`MIGRATION_FAILED`.

### Persistence and quota reporting

IndexedDB is a persistent backend, but the browser may still evict it. Request
the separate browser protection when appropriate, usually from a user action:

```typescript
import { requestPersistence } from '@nearstack-dev/core';

const result = await requestPersistence();
// { state: 'granted' | 'denied' | 'unsupported' }
```

`StorageStatus.persistent` describes the selected backend, not an eviction
guarantee. A write that exceeds the browser quota rejects with a
`StorageError` whose code is `QUOTA_EXCEEDED`; its original error is available
as `reason`. A denied persistence request never switches a model to memory or
erases existing data.

## Patterns

### Auto-save with debounce

```typescript
let saveTimer: ReturnType<typeof setTimeout>;

function autoSave(noteId: string, updates: Partial<Note>) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    NoteModel.table().update(noteId, { ...updates, updatedAt: Date.now() });
  }, 300);
}
```

### Search / filter

```typescript
function searchNotes(query: string, notes: Note[]): Note[] {
  const q = query.toLowerCase();
  return notes.filter(
    (note) =>
      note.title.toLowerCase().includes(q) ||
      note.content.toLowerCase().includes(q) ||
      note.tags.some((tag) => tag.toLowerCase().includes(q))
  );
}
```

### Export / import

```typescript
// Export
async function exportData() {
  const notes = await NoteModel.table().getAll();
  const blob = new Blob([JSON.stringify(notes, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'notes-export.json';
  a.click();
  URL.revokeObjectURL(url);
}

// Import
async function importData(file: File) {
  const text = await file.text();
  const notes = JSON.parse(text) as Note[];
  for (const note of notes) {
    const { id, ...data } = note;
    await NoteModel.table().insert(data);
  }
}
```

### Singleton settings

```typescript
interface AppSettings {
  id: string;
  theme: 'light' | 'dark';
  fontSize: number;
}

const SettingsModel = defineModel<AppSettings>('settings');
const SETTINGS_KEY = 'app-settings';

async function getSettings(): Promise<AppSettings> {
  const existing = await SettingsModel.table().get(SETTINGS_KEY);
  if (existing) return existing;

  return SettingsModel.table().insert({
    theme: 'light',
    fontSize: 16,
  });
}
```
