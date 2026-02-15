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
- Automatic fallback to in-memory storage if IndexedDB is unavailable

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
  name: string;                              // Store name
  store: Store<T>;                           // Low-level store access
  table(): Table<T>;                         // High-level query interface
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
  note => note.createdAt > Date.now() - 86400000
);

const tagged = await NoteModel.table().find(
  note => note.tags.includes('work')
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

Subscriptions fire after any `insert`, `update`, or `delete` operation. They don't tell you *what* changed—just that something did. This is by design: the subscription triggers a re-query, and the query determines the new state.

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
  NoteModel, // Pass model to auto-subscribe
);
```

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
  note => note.projectId === project.id
);

// Fetch a note's project
const note = await NoteModel.table().get(noteId);
const project = note ? await ProjectModel.table().get(note.projectId) : undefined;
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

### In-memory fallback

If IndexedDB is unavailable (e.g., in certain testing environments), the data layer falls back to an in-memory `Map`. The API is identical, but data doesn't persist across page loads.

### Storage limits

IndexedDB storage limits vary by browser:
- **Chrome**: Up to 80% of available disk space
- **Firefox**: Up to 50% of available disk space (max 2 GB)
- **Safari**: Up to 1 GB, with prompts for more

For typical local-first applications (notes, todos, contacts), you won't hit these limits.

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
  return notes.filter(note =>
    note.title.toLowerCase().includes(q) ||
    note.content.toLowerCase().includes(q) ||
    note.tags.some(tag => tag.toLowerCase().includes(q))
  );
}
```

### Export / import

```typescript
// Export
async function exportData() {
  const notes = await NoteModel.table().getAll();
  const blob = new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json' });
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
