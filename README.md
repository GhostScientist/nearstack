# Nearstack

**The browser is the backend.**

Nearstack is a local-first web framework that makes it possible to build full-stack applications entirely in the browser. No servers. No accounts. No API keys. Just open your app and everything works.

## What you get

- **Persistent data** — IndexedDB storage with reactive subscriptions. Your data survives page refreshes and works offline.
- **Local AI** — Run language models directly in the browser via WebGPU, or connect to a local Ollama server. No cloud dependency.
- **Framework support** — First-class integrations for React, Vue, Angular, and SvelteKit.
- **Zero configuration** — One command to scaffold a complete application. No backend to deploy, no database to provision.

## The vision

Traditional web apps split into frontend and backend. The frontend handles UI. The backend handles data, authentication, business logic, and AI. This split made sense when browsers were document viewers.

Browsers aren't document viewers anymore. IndexedDB gives you a database. WebGPU gives you a GPU. Service Workers give you a server. WebRTC gives you networking. The browser has everything you need to build complete applications.

Nearstack makes these capabilities accessible through a clean, developer-friendly API. The goal is to push the boundaries of what people consider possible in a web app—achieving full-stack experiences completely client-side.

## Quick start

```bash
npx @nearstack-dev/cli create my-app
cd my-app
npm install
npm run dev
```

This scaffolds a complete notes application with persistent storage, full-text search, tagging, AI integration, and data export/import—all running locally in your browser.

## Packages

| Package | Description |
|---------|-------------|
| `@nearstack-dev/core` | Data layer. `defineModel()` for IndexedDB storage with reactive subscriptions. |
| `@nearstack-dev/ai` | AI runtime. Browser-native inference via WebLLM + Ollama auto-detection. |
| `@nearstack-dev/react` | React hooks. `useLiveQuery`, `useChat`, `useModelSelector`. |
| `@nearstack-dev/svelte` | Svelte stores. `modelStore`, `liveQuery`. |
| `@nearstack-dev/cli` | Scaffolder. Templates for React, Vue, Angular, and SvelteKit. |
| `@nearstack-dev/rag` | Retrieval-augmented generation (in development). |
| `@nearstack-dev/rtc` | WebRTC peer-to-peer sync (in development). |

## Core concepts

### Define a model

Models are the foundation. Each model maps to an IndexedDB object store with automatic persistence and change notifications.

```typescript
import { defineModel } from '@nearstack-dev/core';

interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

const NoteModel = defineModel<Note>('notes');
```

### Work with data

Every model exposes a `table()` interface for CRUD operations. Data is stored in IndexedDB and persists across page refreshes and browser restarts.

```typescript
const notes = NoteModel.table();

// Create
const note = await notes.insert({
  title: 'Meeting notes',
  content: 'Discussed the roadmap...',
  tags: ['work', 'planning'],
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

// Read
const all = await notes.getAll();
const one = await notes.get(note.id);
const tagged = await notes.find(n => n.tags.includes('work'));

// Update
await notes.update(note.id, { title: 'Updated title', updatedAt: Date.now() });

// Delete
await notes.delete(note.id);
```

### React to changes

Subscribe to a model to get notified whenever its data changes. This is how the UI stays in sync with the data layer.

```typescript
const unsubscribe = NoteModel.subscribe(() => {
  console.log('Notes changed—re-render the UI');
});
```

### Add AI

Local AI with zero configuration. The library auto-detects available backends (WebGPU for in-browser inference, Ollama for local server) and uses the best one available.

```typescript
import { ai } from '@nearstack-dev/ai';

await ai.ready();

// Simple chat
const answer = await ai.chat('Summarize my notes');

// Streaming
for await (const chunk of ai.stream('Write about...')) {
  process.stdout.write(chunk.content);
}

// With context
const answer = await ai.chat([
  { role: 'system', content: 'You have access to the user\'s notes...' },
  { role: 'user', content: 'What did I write about last week?' },
]);
```

### React hooks

```typescript
import { useLiveQuery } from '@nearstack-dev/react';
import { useChat, useModelSelector } from '@nearstack-dev/react/ai';

function NotesApp() {
  // Live-updating query — re-runs when NoteModel data changes
  const { data: notes } = useLiveQuery(
    () => NoteModel.table().getAll(),
    [],
    NoteModel,
  );

  // AI chat with streaming
  const { messages, send, isStreaming } = useChat();

  // Model management
  const { choices, selectModel, downloadModel } = useModelSelector();

  // ...
}
```

## Architecture

```
┌─────────────────────────────────────────────────┐
│                Your Application                  │
├──────────┬──────────┬──────────┬────────────────┤
│  React   │   Vue    │ Angular  │   SvelteKit    │
├──────────┴──────────┴──────────┴────────────────┤
│              @nearstack-dev/core                 │
│        Models · Tables · Subscriptions           │
├─────────────────────────────────────────────────┤
│               @nearstack-dev/ai                  │
│       WebLLM · Ollama · Model Management         │
├─────────────────────────────────────────────────┤
│              Browser Platform                    │
│     IndexedDB · WebGPU · Service Workers         │
└─────────────────────────────────────────────────┘
```

## What the scaffold demonstrates

The generated app is a personal notes application that shows what's possible when the browser is the backend:

- **Persistent notes** stored in IndexedDB—survives refreshes, works offline
- **Full-text search** across titles, content, and tags, entirely client-side
- **Tagging system** for organizing notes
- **Pin important notes** to the top of your list
- **Auto-saving editor** with debounced writes
- **Local AI assistant** that understands your notes and can summarize, find connections, and help you write
- **Model management** — download and switch between AI models, all in-browser
- **Export/import** your data as JSON—you own it completely
- **Word and character counts** in the editor
- **PWA support** — installable, offline-capable
- **Black and white design** — clean, typographic, distraction-free

## What's here today vs. what's coming

### Implemented

| Capability | Package | Status |
|-----------|---------|--------|
| IndexedDB data models with reactive subscriptions | `core` | Stable |
| Browser AI inference (WebGPU/WebAssembly) | `ai` | Stable |
| Ollama integration with auto-detection | `ai` | Stable |
| Streaming chat and model management | `ai` | Stable |
| React hooks (`useLiveQuery`, `useChat`, `useModelSelector`) | `react` | Stable |
| Svelte store adapters | `svelte` | Basic |
| CLI scaffolder with 4 framework templates | `cli` | Stable |

### In development

| Capability | Package | Status |
|-----------|---------|--------|
| Retrieval-augmented generation (vector search) | `rag` | Skeleton |
| WebRTC peer-to-peer sync | `rtc` | Planned |
| Rich query indexes and pagination | `core` | Planned |
| Deeper Vue/Angular/Svelte bindings (hooks equivalents) | Various | Planned |
| File and blob storage | `core` | Planned |
| End-to-end encryption | `core` | Planned |

### Vision gaps

These are the areas where the original vision extends beyond what's currently implemented:

1. **Peer-to-peer sync** — The `rtc` package exists as a stub. The vision is CRDTs + WebRTC for real-time collaboration without a server. This is the biggest gap.
2. **RAG / semantic search** — The `rag` package has basic text splitting but no actual vector embeddings or similarity search. Real RAG needs client-side embeddings.
3. **Framework parity** — React has first-class hooks. Vue, Angular, and SvelteKit use the AI and core packages directly but lack framework-specific binding libraries with the same ergonomics.
4. **Rich queries** — The current `find()` method scans all records. For larger datasets, indexed queries and cursor-based pagination are needed.
5. **Authentication** — Local-first doesn't mean single-user. Device-level auth and encrypted storage would enable shared devices.
6. **File storage** — Binary data (images, PDFs, audio) should be as easy to store as JSON objects.
7. **Background sync** — Service Worker integration for syncing data when connectivity is available.

## Documentation

- [Getting Started](docs/getting-started.md) — Set up your first Nearstack app
- [Data Layer](docs/data-layer.md) — Models, tables, subscriptions, and patterns
- [AI Integration](docs/ai-integration.md) — Local AI, model management, streaming, and context injection
- [React Guide](docs/react.md) — Hooks, components, and patterns for React apps
- [CLI Reference](docs/cli.md) — Scaffolding commands and template options
- [Full-Stack Client-Side Patterns](docs/full-stack-client-side.md) — Architecture guide for building complete apps in the browser

## Workspace commands

```bash
pnpm install       # Install all dependencies
pnpm build         # Build all packages
pnpm test          # Run all tests
pnpm dev           # Watch-build all packages in parallel
pnpm lint          # Lint all packages
pnpm format        # Format all packages
```

## Contributing

Contributions welcome. Whether it's fixing bugs, adding features, improving docs, or sharing what you've built—all contributions help make local-first development more accessible.

## License

MIT
