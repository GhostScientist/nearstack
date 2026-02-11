# Nearstack

Nearstack is a local-first web framework focused on browser-native data + AI.

## Packages

- **@nearstack-dev/core (0.1.0)** - `defineModel()` with IndexedDB + in-memory fallback and reactive `subscribe()` events.
- **@nearstack-dev/react (0.1.0)** - React hooks for data and AI (`useLiveQuery`, `useChat`, `useModelSelector`, `ModelSelector`).
- **@nearstack-dev/ai (0.1.0)** - Browser/Ollama AI runtime with streaming + model management.
- **@nearstack-dev/cli (0.1.0)** - App scaffolder for React/Svelte templates.
- **@nearstack-dev/svelte / rtc / rag (0.0.5)** - Deferred packages (not yet full-featured template defaults).

## Quick start

```bash
npx @nearstack-dev/cli create my-app
cd my-app
npm install
npm run dev
```

The React template now scaffolds a cohesive todo + AI chat app with PWA support.

## Workspace commands

```bash
pnpm install
pnpm build
pnpm test
```

## Core example

```ts
import { defineModel } from '@nearstack-dev/core';

interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

const TodoModel = defineModel<Todo>('todos');

const unsubscribe = TodoModel.subscribe(() => {
  console.log('Todo data changed');
});

await TodoModel.table().insert({ title: 'Ship MVP', completed: false });
unsubscribe();
```

## License

MIT
