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

## License

MIT
