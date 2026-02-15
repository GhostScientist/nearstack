# Getting Started

This guide walks you through creating your first Nearstack application.

## Prerequisites

- **Node.js 18+** — [Download](https://nodejs.org)
- **npm, pnpm, or yarn** — Any package manager works

For browser AI (optional):
- **Chrome 113+, Edge 113+, or Safari 18+** for WebGPU acceleration
- **Firefox** works with WebAssembly fallback (slower)

For Ollama AI (optional):
- **[Ollama](https://ollama.ai)** installed and running locally

You don't need either AI backend to use the data layer. AI features are opt-in.

## Create a project

```bash
npx @nearstack-dev/cli create my-app
```

The CLI will prompt you to choose a framework:

- **React** (Vite) — React 19 with hooks for data and AI
- **Vue** (Vite) — Vue 3 with Composition API
- **Angular** — Angular 18 with standalone components
- **SvelteKit** — SvelteKit with Svelte 4

All templates scaffold the same application—a personal notes app with AI integration—adapted to each framework's patterns and conventions.

## Install and run

```bash
cd my-app
npm install
npm run dev
```

Open the URL shown in your terminal (usually `http://localhost:5173`). You'll see the notes app with:

- A sidebar for navigating and searching notes
- An editor for writing and tagging notes
- An AI assistant panel (toggle from the header)
- Export/import buttons for data portability

## What's in the generated project

```
my-app/
├── src/
│   ├── App.tsx              # Main layout
│   ├── main.tsx             # Entry point
│   ├── index.css            # Tailwind styles
│   ├── models/
│   │   └── Note.ts          # Data model definition
│   └── components/
│       ├── Sidebar.tsx       # Note list + search
│       ├── NoteEditor.tsx    # Note editing
│       └── AIPanel.tsx       # AI chat + model setup
├── public/
│   └── manifest.json        # PWA manifest
├── index.html
├── vite.config.ts
├── tailwind.config.js
└── package.json
```

(Paths shown for React. Other frameworks follow similar structure with framework-appropriate file extensions.)

## Key files explained

### `src/models/Note.ts`

This defines your data model. It's the equivalent of a database table:

```typescript
import { defineModel } from '@nearstack-dev/core';

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

export const NoteModel = defineModel<Note>('notes');
```

`defineModel` creates an IndexedDB-backed store with reactive subscriptions. The `id` field is auto-generated when you insert a record.

### `src/components/NoteEditor.tsx`

The editor demonstrates auto-saving with debounced writes:

```typescript
const save = (updates: Partial<Note>) => {
  clearTimeout(saveTimeout.current);
  saveTimeout.current = setTimeout(() => {
    void NoteModel.table().update(note.id, { ...updates, updatedAt: Date.now() });
  }, 300);
};
```

This pattern—debounce writes, update on change—gives you the feel of a real-time editor backed by persistent storage.

### `src/components/AIPanel.tsx`

The AI panel injects your notes as context into the system prompt, so the AI knows what you've written:

```typescript
function buildSystemPrompt(notes: Note[]): string {
  const notesSummary = notes
    .slice(0, 20)
    .map(note => `- "${note.title}": ${note.content.slice(0, 200)}`)
    .join('\n');

  return `You have access to the user's notes:\n${notesSummary}`;
}
```

## Setting up AI

AI is optional. The notes app works without it. When you're ready:

### Option 1: Browser models (WebGPU)

1. Click **AI Assistant** in the header
2. Select a model from the dropdown (start with **SmolLM2 360M** — it's small and fast)
3. Click **Download model**
4. Wait for the download (240 MB for SmolLM2 360M)
5. Start chatting

The model is cached in IndexedDB. You only download it once.

### Option 2: Ollama

1. [Install Ollama](https://ollama.ai)
2. Run `ollama serve` in a terminal
3. Pull a model: `ollama pull llama3.2:3b`
4. Refresh your app — Ollama models appear in the selector automatically

Both options work offline after initial setup. You can have both active simultaneously.

## Adding a new data model

To add a new type of data (e.g., projects), create a new model file:

```typescript
// src/models/Project.ts
import { defineModel } from '@nearstack-dev/core';

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: number;
}

export const ProjectModel = defineModel<Project>('projects');
```

Then use it in your components:

```typescript
// Create
await ProjectModel.table().insert({
  name: 'My Project',
  description: 'A new project',
  createdAt: Date.now(),
});

// Query
const projects = await ProjectModel.table().getAll();
const active = await ProjectModel.table().find(p => p.name.includes('My'));

// React hook
const { data: projects } = useLiveQuery(
  () => ProjectModel.table().getAll(),
  [],
  ProjectModel,
);
```

## Building for production

```bash
npm run build
```

The output is a static site in `dist/`. Deploy it anywhere—Netlify, Vercel, GitHub Pages, or just open `index.html` from a file server. There's no backend to deploy.

## Next steps

- [Data Layer](data-layer.md) — Deep dive into models, tables, and subscriptions
- [AI Integration](ai-integration.md) — Model management, streaming, context injection
- [React Guide](react.md) — Hooks and patterns for React apps
- [Full-Stack Client-Side Patterns](full-stack-client-side.md) — Architecture for ambitious browser apps
