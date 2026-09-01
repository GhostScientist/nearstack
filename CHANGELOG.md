# Changelog

All notable changes to this project will be documented in this file.

The project did not previously include a changelog; the entries below summarize the latest changes from February 11, 2026 through February 16, 2026.

## [Unreleased]

### Breaking

- `@nearstack-dev/core` no longer silently falls back to non-persistent in-memory storage when IndexedDB is unavailable. `defineModel()` now defaults to `storage: 'indexeddb'`, and every table operation (plus the new `model.ready()`) rejects with a `StorageError` whose `code` is `'STORAGE_UNAVAILABLE'`. Opt back into the old behaviour per model with `defineModel(name, { storage: 'auto' })`, or globally with `configureStorage({ mode: 'auto' })`; use `storage: 'memory'` for a deliberately ephemeral store ([#33](https://github.com/GhostScientist/nearstack/issues/33)).

### Added
- `@nearstack-dev/core` now exports `configureStorage()`, `getStorageConfig()`, `resetStorage()`, the `StorageError` class, and the `StorageBackend` / `StorageConfig` / `StorageErrorCode` / `StorageMode` / `StorageStatus` types ([#33](https://github.com/GhostScientist/nearstack/issues/33)).
- `Model.ready()` resolves with a `StorageStatus` (`{ backend, persistent, reason? }`) so callers can detect and surface a degraded, non-persistent store ([#33](https://github.com/GhostScientist/nearstack/issues/33)).
- `defineModel()` accepts an options object with `storage` (`'indexeddb' | 'memory' | 'auto'`) and `database` (defaults to `nearstack`) ([#33](https://github.com/GhostScientist/nearstack/issues/33)).
- CLI scaffolding support for `react`, `sveltekit`, `vue`, and `angular` templates with Tailwind CSS starter setup (`504bdeb`).
- New CLI scaffold coverage in `packages/cli/src/__tests__/scaffold.test.ts` for all supported framework templates (`504bdeb`).
- `@mlc-ai/web-llm` support in Angular, SvelteKit, and Vue templates (`1731787`).
- Template-specific `.gitignore` files for Angular, SvelteKit, and Vue scaffold outputs (`880ec30`).
- SvelteKit template `src/app.html` file (`1731787`).

### Changed
- Standardized AI system prompt phrasing across Angular, React, SvelteKit, and Vue template chat experiences (`1731787`, `880ec30`).
- Template chat implementations now prepend system context to message history before calling `ai.chat(...)` in Angular, SvelteKit, and Vue (`1731787`).
- SvelteKit template `dev` and `build` scripts now run `svelte-kit sync` before Vite commands (`1731787`).
- React template `@mlc-ai/web-llm` dependency updated from `^0.2.79` to `^0.2.80` (`880ec30`).
- Angular template assets configuration updated to avoid missing default asset path issues in generated projects (`880ec30`).
- CLI TypeScript config now excludes test files from compilation (`1731787`).

### Fixed
- `defineModel()` no longer hangs forever when called after another store has been used. Registering a new model closes the connections nearstack owns, open handles close on `versionchange`, and an upgrade that stays blocked by another tab now rejects with `StorageError('UPGRADE_BLOCKED')` instead of leaving a promise pending ([#33](https://github.com/GhostScientist/nearstack/issues/33)).
- Concurrent `update()` calls to different fields of the same record no longer lose writes. The read-modify-write now runs inside a single `readwrite` transaction, so IndexedDB serializes overlapping updates ([#33](https://github.com/GhostScientist/nearstack/issues/33)).
- Storage detection reads `indexedDB` from `globalThis` instead of `window`, so models work — and actually persist — in Workers and Service Workers ([#33](https://github.com/GhostScientist/nearstack/issues/33)).
- `update()` can no longer change a record's `id` via the patch object ([#33](https://github.com/GhostScientist/nearstack/issues/33)).
- `@nearstack-dev/core` no longer compiles its `__tests__` directory into `dist/`, so tests are not shipped in the published package ([#33](https://github.com/GhostScientist/nearstack/issues/33)).
- `ai.models.download()` now enforces single-flight semantics: a duplicate call for the same model returns the in-flight promise, and a call for a different model rejects with `AIErrorCode.DOWNLOAD_IN_PROGRESS` instead of racing shared state ([#14](https://github.com/GhostScientist/nearstack/issues/14)).
- React, Vue, SvelteKit, and Angular templates now offer a Retry action when a model download fails, so users can recover without reloading the app ([#13](https://github.com/GhostScientist/nearstack/issues/13)).
- Template model-selection handlers now treat the `error` state like `available` and re-download instead of falling through to `models.use()` and rejecting ([#12](https://github.com/GhostScientist/nearstack/issues/12)).
