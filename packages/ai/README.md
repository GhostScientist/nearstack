# @nearstack-dev/ai

**Local AI for web apps, made simple.**

I love local models. I love that you can run a language model in a browser tab. I love that a $500 laptop can have a conversation with you without an internet connection. I built this library because adding local AI to a web app should be as easy as adding any other feature.

```typescript
import { ai } from '@nearstack-dev/ai';

await ai.ready();
const response = await ai.chat('Hello!');
```

That's it. No API keys. No accounts. No server. Just intelligence, running locally.

---

## Why Local AI?

- **It's yours** — Models run on your device, your users' devices. Data stays where it belongs.
- **It works offline** — After the first model download, no internet required.
- **It's free forever** — No per-token costs, no rate limits, no billing surprises.
- **It's getting really good** — Small models today outperform GPT-3. Tomorrow they'll be even better.

---

## Quick Start

### Install

```bash
npm install @nearstack-dev/ai
```

For browser inference, also install WebLLM:

```bash
npm install @mlc-ai/web-llm
```

### Use

```typescript
import { ai } from '@nearstack-dev/ai';

// Wait for initialization (auto-detects available backends)
await ai.ready();

// Chat
const answer = await ai.chat('What is the capital of France?');

// Stream responses
for await (const chunk of ai.stream('Write a haiku about coding')) {
  process.stdout.write(chunk.content);
}
```

---

## How It Works

`@nearstack-dev/ai` automatically finds the best way to run models:

1. **Browser** — Runs models directly in the browser using WebGPU or WebAssembly via [WebLLM](https://github.com/mlc-ai/web-llm)
2. **Ollama** — Connects to a local [Ollama](https://ollama.ai) server if one is running

You don't have to choose. The library detects what's available and uses it.

```typescript
// This works whether you have Ollama running, WebGPU available, or both
const response = await ai.chat('Hello!');
```

---

## Working with Models

### See What's Available

```typescript
const models = ai.models.list();

models.forEach(model => {
  console.log(`${model.name} (${ai.ui.formatSize(model.size)})`);
});
```

### Download a Browser Model

Browser models need to be downloaded once, then they're cached locally:

```typescript
// Subscribe to see progress
ai.subscribe(state => {
  if (state.downloading) {
    console.log(`Downloading: ${Math.round(state.downloading.progress * 100)}%`);
  }
});

// Download (runs once, then cached)
await ai.models.download('SmolLM2-360M-Instruct-q4f16_1-MLC');
```

### Switch Models

```typescript
await ai.models.use('SmolLM2-360M-Instruct-q4f16_1-MLC');
console.log(`Now using: ${ai.models.active()?.name}`);
```

---

## Included Browser Models

These models are tested and work well in browsers:

| Model | Size | Good For |
|-------|------|----------|
| SmolLM2 360M | 240 MB | Quick responses, low-end devices |
| SmolLM2 1.7B | 1.1 GB | Balanced performance |
| Llama 3.2 1B | 880 MB | General chat |
| Llama 3.2 3B | 2.2 GB | Better reasoning |
| Phi 3.5 Mini | 2.4 GB | Instruction following |
| Qwen 2.5 1.5B | 1.1 GB | Multilingual |
| Gemma 2 2B | 1.5 GB | Helpful assistant |

Start with **SmolLM2 360M** to test things out — it downloads fast and runs on almost anything.

---

## Building UIs

The library provides helpers for building model selectors, download progress bars, and other common UI patterns:

```typescript
// Get data formatted for a <select> dropdown
const choices = ai.ui.getModelChoices();
// → [{ value: 'smollm2-360m...', label: 'SmolLM2 360M', size: '240 MB', status: {...} }, ...]

// React to state changes
ai.subscribe(state => {
  updateUI({
    isReady: state.initialized,
    activeModel: state.activeModel,
    isDownloading: state.downloading !== null,
    progress: state.downloading?.progress ?? 0,
  });
});
```

---

## Using with Ollama

If you have [Ollama](https://ollama.ai) running locally, the library will automatically detect it and make those models available too:

```bash
# In one terminal
ollama serve

# Pull some models
ollama pull llama3.2:3b
ollama pull mistral:7b
```

```typescript
import { ai } from '@nearstack-dev/ai';

await ai.ready();

// Ollama models appear alongside browser models
ai.models.list().forEach(m => console.log(m.id, m.provider));
// → SmolLM2-360M-Instruct-q4f16_1-MLC browser
// → llama3.2:3b ollama
// → mistral:7b ollama
```

---

## Configuration

### Custom Setup

```typescript
import { createAI, BrowserProvider, OllamaProvider } from '@nearstack-dev/ai';

const ai = createAI({
  providers: [
    new BrowserProvider({ backend: 'webgpu' }),
    new OllamaProvider({ baseUrl: 'http://localhost:11434' }),
  ],
  defaultModel: 'SmolLM2-360M-Instruct-q4f16_1-MLC',
});
```

### Browser-Only

```typescript
import { createAI, BrowserProvider } from '@nearstack-dev/ai';

const ai = createAI({
  providers: [new BrowserProvider()],
});
```

### Ollama-Only

```typescript
import { createAI, OllamaProvider } from '@nearstack-dev/ai';

const ai = createAI({
  providers: [new OllamaProvider()],
});
```

---

## API Reference

### Chat

```typescript
// Simple string
const response = await ai.chat('Hello!');

// With message history
const response = await ai.chat([
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'Hello!' },
]);

// With options
const response = await ai.chat('Be creative', {
  temperature: 1.2,
  maxTokens: 500,
});
```

### Streaming

```typescript
for await (const chunk of ai.stream('Tell me a story')) {
  // chunk.content - the text
  // chunk.done - true on last chunk
}
```

### Models

```typescript
ai.models.list()              // All available models
ai.models.get(id)             // Get specific model
ai.models.active()            // Currently active model
ai.models.use(id)             // Switch to a model
ai.models.download(id)        // Download a browser model
ai.models.cancelDownload()    // Cancel in-progress download
ai.models.delete(id)          // Remove from cache
```

### State

```typescript
ai.getState()                 // Current state snapshot
ai.subscribe(fn)              // Subscribe to changes (returns unsubscribe fn)
ai.ready()                    // Wait for initialization
```

### UI Helpers

```typescript
ai.ui.getModelChoices()       // Models formatted for dropdowns
ai.ui.getProviderChoices()    // Providers formatted for UI
ai.ui.formatSize(bytes)       // "1.2 GB"
```

---

## Browser Support

| Browser | WebGPU | WebAssembly |
|---------|--------|-------------|
| Chrome 113+ | Yes | Yes |
| Edge 113+ | Yes | Yes |
| Safari 18+ | Yes | Yes |
| Firefox | No | Yes |

WebGPU is faster, but WebAssembly works everywhere. The library uses WebGPU when available and falls back automatically.

---

## Part of Nearstack

`@nearstack-dev/ai` is part of the [Nearstack](https://github.com/nearstack) ecosystem for building local-first web applications:

- **@nearstack-dev/cli** — Scaffold new projects with `npx @nearstack-dev/cli create my-app`
- **@nearstack-dev/react** — React hooks for AI (`useChat`, `useModelSelector`)
- **@nearstack-dev/rag** — Local retrieval-augmented generation

---

## Contributing

I'd love your help making local AI more accessible. Whether it's fixing bugs, adding features, improving docs, or just sharing what you've built — all contributions are welcome.

---

## License

MIT

---

*Built with enthusiasm for local AI and the people building with it.*
