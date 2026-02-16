# Changelog

All notable changes to this project will be documented in this file.

The project did not previously include a changelog; the entries below summarize the latest changes from February 11, 2026 through February 16, 2026.

## [Unreleased]

### Added
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
