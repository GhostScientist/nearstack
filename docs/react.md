# React Guide

`@nearstack-dev/react` provides hooks for connecting React components to Nearstack's data and AI layers.

## Installation

```bash
npm install @nearstack-dev/react @nearstack-dev/core
# For AI features:
npm install @nearstack-dev/ai @mlc-ai/web-llm
```

## Data hooks

### `useLiveQuery`

The primary hook for reading data. Executes a query function and re-runs it automatically when the underlying model's data changes.

```typescript
import { useLiveQuery } from '@nearstack-dev/react';
import { NoteModel } from './models/Note';

function NoteList() {
  const { data: notes, loading, error } = useLiveQuery(
    () => NoteModel.table().getAll(),
    [],        // dependency array (like useEffect)
    NoteModel, // model to subscribe to for auto-refresh
  );

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <ul>
      {notes?.map(note => (
        <li key={note.id}>{note.title}</li>
      ))}
    </ul>
  );
}
```

**Parameters:**
- `query: () => Promise<T>` — Async function that returns data
- `deps?: any[]` — Dependency array. Query re-runs when deps change.
- `model?: Model` — If provided, query re-runs when model data changes.

**Returns:** `{ data: T | undefined, loading: boolean, error: Error | null }`

### Filtered queries

```typescript
// Filter by tag
const { data: workNotes } = useLiveQuery(
  () => NoteModel.table().find(n => n.tags.includes('work')),
  [],
  NoteModel,
);

// Search
const [search, setSearch] = useState('');
const { data: results } = useLiveQuery(
  () => {
    if (!search) return NoteModel.table().getAll();
    const q = search.toLowerCase();
    return NoteModel.table().find(n =>
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q)
    );
  },
  [search], // Re-run when search changes
  NoteModel,
);
```

### `useModel`

Fetches a single record by ID. Does not subscribe to changes (static snapshot).

```typescript
import { useModel } from '@nearstack-dev/react';

function NoteDetail({ noteId }: { noteId: string }) {
  const { data: note, loading } = useModel(NoteModel, noteId);

  if (loading) return <p>Loading...</p>;
  if (!note) return <p>Note not found</p>;

  return <h1>{note.title}</h1>;
}
```

## AI hooks

AI hooks are imported from `@nearstack-dev/react/ai`:

```typescript
import { useChat, useModelSelector, useAI } from '@nearstack-dev/react/ai';
```

### `useChat`

Manages a chat conversation with streaming support.

```typescript
function ChatPanel() {
  const { messages, send, isStreaming, error, clear } = useChat(
    undefined,  // AI instance (undefined = use default singleton)
    { systemPrompt: 'You are a helpful assistant.' },
  );

  const [input, setInput] = useState('');

  return (
    <div>
      {messages.map((msg, i) => (
        <div key={i} className={msg.role}>
          {msg.content}
        </div>
      ))}

      <form onSubmit={async (e) => {
        e.preventDefault();
        const text = input.trim();
        if (!text) return;
        setInput('');
        await send(text);
      }}>
        <input value={input} onChange={e => setInput(e.target.value)} />
        <button disabled={isStreaming}>Send</button>
      </form>
    </div>
  );
}
```

**Returns:**
- `messages: Message[]` — Full message history
- `send(content: string, options?: ChatOptions) => Promise<void>` — Send a message
- `isStreaming: boolean` — True while AI is generating
- `error: string | null` — Error message if chat fails
- `clear: () => void` — Clear message history

### `useModelSelector`

Manages model selection, download, and activation.

```typescript
function ModelPicker() {
  const {
    choices,           // Model options formatted for dropdowns
    selectModel,       // Select a model
    downloadModel,     // Download a browser model
    isDownloading,     // True during download
    downloadProgress,  // 0-1 progress
    currentSelection,  // Currently selected model ID
    selectedModel,     // Full ModelInfo of selected model
  } = useModelSelector();

  return (
    <div>
      <select
        value={currentSelection ?? ''}
        onChange={e => void selectModel(e.target.value)}
        disabled={isDownloading}
      >
        <option value="">Select a model</option>
        {choices.map(c => (
          <option key={c.value} value={c.value}>
            {c.group} · {c.label}
          </option>
        ))}
      </select>

      {selectedModel?.status?.state === 'available' && (
        <button onClick={() => void downloadModel(selectedModel.id)}>
          Download
        </button>
      )}

      {isDownloading && (
        <p>Downloading: {Math.round(downloadProgress * 100)}%</p>
      )}
    </div>
  );
}
```

### `useAI`

Low-level hook for accessing the AI instance and its state.

```typescript
function AIStatus() {
  const { state, ai, isReady, isLoading, error } = useAI();

  if (isLoading) return <p>Initializing AI...</p>;
  if (error) return <p>AI error: {error}</p>;
  if (!isReady) return <p>AI not available</p>;

  return (
    <p>Active model: {state.activeModel ?? 'None'}</p>
  );
}
```

## Patterns

### Context-aware AI chat

Inject application data into the AI's system prompt:

```typescript
function SmartChat() {
  const { data: notes = [] } = useLiveQuery(
    () => NoteModel.table().getAll(),
    [],
    NoteModel,
  );

  const systemPrompt = useMemo(() => {
    if (notes.length === 0) return undefined;
    const summary = notes
      .slice(0, 20)
      .map(n => `- "${n.title}": ${n.content.slice(0, 200)}`)
      .join('\n');
    return `You have access to the user's notes:\n${summary}`;
  }, [notes]);

  const { messages, send, isStreaming } = useChat(undefined, { systemPrompt });

  // ...
}
```

### Optimistic updates

For instant UI feedback, update local state before the async operation completes:

```typescript
function TodoList() {
  const { data: todos = [] } = useLiveQuery(
    () => TodoModel.table().getAll(),
    [],
    TodoModel,
  );

  const toggle = (todo: Todo) => {
    // Fire and forget — useLiveQuery will re-fetch after the write
    void TodoModel.table().update(todo.id, {
      completed: !todo.completed,
    });
  };

  // ...
}
```

Since `useLiveQuery` subscribes to the model, the UI updates automatically after the write completes. For most local operations, this happens fast enough to feel instant.

### Auto-save editor

```typescript
function Editor({ noteId }: { noteId: string }) {
  const { data: note } = useModel(NoteModel, noteId);
  const [content, setContent] = useState('');
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (note) setContent(note.content);
  }, [note?.id]);

  const handleChange = (value: string) => {
    setContent(value);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void NoteModel.table().update(noteId, {
        content: value,
        updatedAt: Date.now(),
      });
    }, 300);
  };

  return (
    <textarea value={content} onChange={e => handleChange(e.target.value)} />
  );
}
```
