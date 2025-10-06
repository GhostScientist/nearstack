# Nearstack

Nearstack is a local-first full-stack web framework that makes the browser the backend. Built for offline-first AI apps.

## Packages

- **@nearstack-dev/core** - IndexedDB runtime, defineModel(), base Store interface
- **@nearstack-dev/react** - React bindings (useModel, useLiveQuery)
- **@nearstack-dev/svelte** - Svelte store adapter
- **@nearstack-dev/rtc** - WebRTC + CRDT sync layer
- **@nearstack-dev/rag** - Text splitter + embedding + vector search
- **@nearstack-dev/ai** - createAIContext() with Fake + WebLLM adapters
- **@nearstack-dev/cli** - CLI tool to scaffold new Nearstack apps

## Getting Started

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run development mode
pnpm dev
```

## Quick Start

Create a new Nearstack app in seconds:

```bash
# Using npx (recommended)
npx @nearstack-dev/cli create my-app

# Or install globally
npm install -g @nearstack-dev/cli
nearstack create my-app
```

Then follow the prompts to choose your UI framework (React or Svelte), and start developing:

```bash
cd my-app
npm install
npm run dev
```

Your app will be running at `http://localhost:5173` with:
- ✅ **In-memory data persistence** using `@nearstack-dev/core`
- ✅ **Todo model** pre-configured with full CRUD operations
- ✅ **Working UI** with add, toggle, and delete functionality
- ✅ **AI context** ready for WebLLM or custom adapters

## What You Get

Each scaffolded project includes:

- **📦 packages/core integration** - `defineModel()` with `.table()` API for data management
- **⚛️ Framework bindings** - `@nearstack-dev/react` or `@nearstack-dev/svelte`
- **🤖 AI context** - Pre-configured `ai.context.ts` with FakeAdapter
- **📝 Todo example** - Complete CRUD implementation in `src/models/Todo.ts`
- **⚡ Vite setup** - Fast HMR and optimized build
- **📘 TypeScript** - Full type safety out of the box

## Core API

### defineModel()

```typescript
import { defineModel } from '@nearstack-dev/core';

interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

const TodoModel = defineModel<Todo>('todos');

// Use the table API
const todos = TodoModel.table();

// CRUD operations
await todos.insert({ title: 'Learn Nearstack', completed: false });
await todos.getAll();
await todos.update('1', { completed: true });
await todos.delete('1');
await todos.find((todo) => !todo.completed);
```

### React Bindings

```typescript
import { useModel, useLiveQuery } from '@nearstack-dev/react';

function TodoList() {
  const { data, loading } = useLiveQuery(
    async () => await TodoModel.table().getAll(),
    []
  );

  // Your component logic
}
```

### Svelte Bindings

```typescript
import { modelStore, liveQuery } from '@nearstack-dev/svelte';

const todos = liveQuery(() => TodoModel.table().getAll());
// Use $todos in your component
```

## Publishing to npm

### Prerequisites
1. Make sure you're logged in to npm with access to the `@nearstack-dev` organization:
   ```bash
   npm login
   ```

2. Verify your login:
   ```bash
   npm whoami
   ```

### Publishing Packages

**Publish all packages at once:**
```bash
pnpm run publish:all
```

**Or publish individual packages:**
```bash
# Core package (publish this first - other packages depend on it)
pnpm run publish:core

# Framework bindings
pnpm run publish:react
pnpm run publish:svelte

# Additional packages
pnpm run publish:rtc
pnpm run publish:rag
pnpm run publish:ai
pnpm run publish:cli
```

**Important Notes:**
- Each package will automatically build before publishing (via `prepublishOnly` script)
- Packages are published with `--access public` (required for scoped packages)
- The `workspace:*` dependencies will be automatically converted to proper version numbers by pnpm
- Make sure to publish `@nearstack-dev/core` first since other packages depend on it

### Versioning

Update package versions using:
```bash
# Update specific package
cd packages/core
npm version patch  # or minor, major

# Or use pnpm workspace commands
pnpm --filter @nearstack-dev/core version patch
```

## License

MIT
