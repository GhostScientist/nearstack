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

## Usage

```bash
# Create a new Nearstack app
npx @nearstack-dev/cli create my-app
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
