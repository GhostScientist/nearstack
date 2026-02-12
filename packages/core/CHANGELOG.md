# Changelog

## 0.1.2

### Bug fixes

- **Fix multiple models sharing a single IndexedDB database.** Previously, `defineModel()` only worked for a single model per app. Each model independently opened the database at a hardcoded version of `1`, so only the first model to access the database had its object store created. All subsequent models failed with `NotFoundError` when attempting any read or write operation. The fix replaces the per-instance connection logic with a shared connection manager that registers all store names at construction time, probes the database on first access, and performs a version upgrade to create any missing stores. Existing data is preserved across upgrades.

## 0.1.1

### Features

- Initial release with `defineModel()`, IndexedDB-backed `Store` and `Table` interfaces, in-memory fallback, and `subscribe()` for reactive updates.
