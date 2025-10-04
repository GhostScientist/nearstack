# Nearstack

Nearstack is a local-first full-stack web framework that makes the browser the backend. Built for offline-first AI apps.

## Packages

- **@nearstack/core** - IndexedDB runtime, defineModel(), base Store interface
- **@nearstack/react** - React bindings (useModel, useLiveQuery)
- **@nearstack/svelte** - Svelte store adapter
- **@nearstack/rtc** - WebRTC + CRDT sync layer
- **@nearstack/rag** - Text splitter + embedding + vector search
- **@nearstack/ai** - createAIContext() with Fake + WebLLM adapters
- **@nearstack/cli** - CLI tool to scaffold new Nearstack apps

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
npx @nearstack/cli create my-app
```

## License

MIT
