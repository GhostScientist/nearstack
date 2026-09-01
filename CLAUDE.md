# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Nearstack is a local-first web framework where "the browser is the backend": IndexedDB for persistence, WebGPU (via WebLLM) or a local Ollama server for AI inference, no server-side code. It is a pnpm workspace monorepo publishing packages under the `@nearstack-dev/` npm scope.

## Commands

```bash
pnpm install       # Install all dependencies
pnpm build         # Build all packages
pnpm test          # Run all tests (packages without tests just echo)
pnpm dev           # Watch-build all packages in parallel
pnpm lint          # eslint packages/*/src --ext .ts,.tsx
pnpm format        # prettier --write on all package sources
```

Per-package work uses pnpm filters:

```bash
pnpm --filter @nearstack-dev/ai test           # Test one package
pnpm --filter @nearstack-dev/ai build          # Build one package
pnpm --filter @nearstack-dev/ai exec vitest run src/providers/__tests__/ollama.test.ts   # Single test file
pnpm --filter @nearstack-dev/ai exec vitest run -t "detects ollama"                      # Single test by name
```

The `ai` package also has `test:watch`, `test:coverage` (80% thresholds enforced on statements/branches/functions/lines), and `typecheck` scripts.

Publishing: `pnpm publish:all` or `pnpm publish:<package>` from the root (each package builds via `prepublishOnly`).

## Package layout and build tooling

| Package | Purpose | Build | Tests |
|---------|---------|-------|-------|
| `packages/core` | `defineModel()` → IndexedDB stores with reactive subscriptions | `tsc` (ESM only) | vitest + `fake-indexeddb` |
| `packages/ai` | `AI` class + `ai` singleton; WebLLM/Ollama providers | `tsup` (dual ESM/CJS) | vitest, node env, `fake-indexeddb/auto` setup, coverage thresholds |
| `packages/react` | `useModel`, `useLiveQuery` (root export); `useAI`, `useChat`, `useModelSelector`, `ModelSelector` (`./ai` subpath export) | `tsup` (dual ESM/CJS, entries `src/index.ts` + `src/ai.ts`) | vitest, jsdom env |
| `packages/svelte` | Basic store bridges (`modelStore`, `liveQuery`) | `tsc` | none |
| `packages/cli` | `nearstack create <name>` scaffolder; templates in `packages/cli/templates/{react,vue,angular,sveltekit,svelte}` | `tsc` (tests excluded from compile) | vitest, node env |
| `packages/rag` | Text splitter / vector search — stub | `tsc` | none |
| `packages/rtc` | WebRTC + CRDT sync — stub | `tsc` | none |

Packages built with plain `tsc` are ESM (`"type": "module"`) and must use explicit `.js` extensions in relative imports (e.g. `from './types.js'`). The tsup packages (`ai`, `react`) do not.

## Architecture

### Data layer (`core`)

`defineModel<T>(name, options?)` creates a `Model` backed by an `IndexedDBStore` in a single shared database named `nearstack` (one object store per model, keyPath `id`, ids from `crypto.randomUUID()`). A module-level connection manager (`src/storage.ts`) tracks registered store names and reopens the DB with a bumped version whenever a new store is missing. `defineModel()` may be called lazily (code-split routes, dynamic imports): registering a new store closes the connections nearstack owns, open handles close on `versionchange`, and a genuinely blocked upgrade rejects with `StorageError('UPGRADE_BLOCKED')` rather than hanging. Storage is detected from `globalThis.indexedDB`, so Workers and Service Workers are supported. When IndexedDB is unavailable, the default `storage: 'indexeddb'` mode **rejects** every operation with a `StorageError` — silent in-memory fallback is opt-in via `storage: 'memory'`/`'auto'` or `configureStorage({ mode })`, and `model.ready()` reports the resolved `StorageStatus`.

Reactivity is coarse-grained: every write (`set`/`delete`, and thus `insert`/`update`) fires all `subscribe()` listeners for that model with no payload; consumers re-run their queries. `Table.find()` is a full-scan `getAll().filter()` — there are no indexes. `defineModule` in `core/src/legacy.ts` is a legacy export; don't build on it.

### AI layer (`ai`)

The `AI` class (`src/ai.ts`) orchestrates providers, a `StateManager` (`src/state/`), and UI helpers (`src/ui/`). The exported `ai` singleton auto-initializes: it probes for available providers — `BrowserProvider` (WebLLM over WebGPU, curated model list in `src/providers/browser.ts`) and `OllamaProvider` (REST against `http://localhost:11434`) — and picks the best available. Key surface: `ai.ready()`, `ai.chat(string | Message[])`, `ai.stream()`, `ai.models.{list,get,download,cancelDownload}`.

`@mlc-ai/web-llm` is an **optional peer dependency**, marked `external` in tsup and loaded dynamically — never import it eagerly at module top level in a way that would break apps not using browser inference. Errors use `AIError` with `AIErrorCode` values.

### Framework bindings

React is the first-class binding: `useLiveQuery(queryFn, deps, model)` re-runs the query on model subscription callbacks; the `@nearstack-dev/react/ai` subpath wraps the `ai` singleton's state manager. Svelte has thinner adapters; Vue/Angular/SvelteKit consume `core`/`ai` directly (framework parity is a known gap — see README "Vision gaps").

### CLI and templates

`nearstack create <name>` prompts for a framework (choices in `FRAMEWORK_CHOICES`, `src/index.ts`), copies `templates/<framework>` into the target dir, and substitutes `{{PROJECT_NAME}}` in `package.json`, `index.html`, `public/manifest.json`, `vite.config.ts`, and `angular.json` where present. Templates are shipped in the published package (`files: ["dist", "templates"]`) and reference **published** `@nearstack-dev/*` versions (e.g. `^0.1.0`), not `workspace:*` — bumping package APIs may require updating template code and version ranges.

Each template scaffolds the same notes app (IndexedDB persistence, search, tags, AI chat) with Vite + Tailwind. When changing template behavior (e.g. AI system prompts, chat wiring), keep the four active templates (react, vue, angular, sveltekit) consistent — the CHANGELOG shows this is an explicit convention. The CLI scaffold tests (`packages/cli/src/__tests__/scaffold.test.ts`) assert on template contents, so template edits can require test updates.

## Conventions

- TypeScript strict mode, ES2020 target; each package extends `tsconfig.base.json`.
- Prettier: single quotes, semicolons, 80-column width, 2-space tabs. ESLint: `eslint:recommended` + `@typescript-eslint/recommended` with no custom rules.
- Cross-package dependencies inside the workspace use `workspace:*`; framework libs (`react`, `svelte`, `@mlc-ai/web-llm`) are peer dependencies of the packages that use them.
- Tests live in `__tests__/` directories next to the code (`src/**/*.test.ts`).
