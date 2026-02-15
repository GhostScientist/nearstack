# AI Integration

Nearstack's AI layer runs language models locally—in the browser via WebGPU or through a local Ollama server. No API keys, no cloud, no data leaving the device.

## Overview

```typescript
import { ai } from '@nearstack-dev/ai';

await ai.ready();
const answer = await ai.chat('Hello!');
```

The `ai` singleton auto-detects available backends and configures itself. You can start chatting immediately after `ready()` resolves.

## How it works

On initialization, the AI engine probes for available providers in order:

1. **BrowserProvider** — Checks for WebGPU support (falls back to WebAssembly). Uses [WebLLM](https://github.com/mlc-ai/web-llm) for in-browser inference.
2. **OllamaProvider** — Checks if Ollama is running at `http://localhost:11434`.

Both can be active simultaneously. Models from all providers appear in a unified list.

## Chat

### Simple chat

```typescript
const response = await ai.chat('What is the capital of France?');
// "The capital of France is Paris."
```

### Message history

```typescript
const response = await ai.chat([
  { role: 'system', content: 'You are a helpful writing assistant.' },
  { role: 'user', content: 'Help me write an introduction.' },
]);
```

### Chat options

```typescript
const response = await ai.chat('Be creative', {
  temperature: 1.2,
  maxTokens: 500,
  systemPrompt: 'You are a poet.',
});
```

## Streaming

For real-time output, use `ai.stream()`:

```typescript
for await (const chunk of ai.stream('Tell me a story')) {
  // chunk.content — the text fragment
  // chunk.done — true on the last chunk
  process.stdout.write(chunk.content);
}
```

Streaming is essential for good UX with local models. Even fast models take seconds to generate a full response. Streaming shows output as it's generated.

## Model management

### List models

```typescript
const models = ai.models.list();
models.forEach(model => {
  console.log(`${model.name} (${model.provider}) — ${ai.ui.formatSize(model.size)}`);
});
```

### Download browser models

Browser models must be downloaded once, then they're cached in IndexedDB:

```typescript
// Track download progress
ai.subscribe(state => {
  if (state.downloading) {
    console.log(`${Math.round(state.downloading.progress * 100)}%`);
  }
});

await ai.models.download('SmolLM2-360M-Instruct-q4f16_1-MLC');
```

### Switch models

```typescript
await ai.models.use('SmolLM2-360M-Instruct-q4f16_1-MLC');
console.log(`Active: ${ai.models.active()?.name}`);
```

### Delete cached models

```typescript
await ai.models.delete('SmolLM2-360M-Instruct-q4f16_1-MLC');
```

## Available browser models

| Model | Size | Best for |
|-------|------|----------|
| SmolLM2 360M | 240 MB | Quick responses, low-end devices |
| SmolLM2 1.7B | 1.1 GB | Balanced performance |
| Llama 3.2 1B | 880 MB | General chat |
| Llama 3.2 3B | 2.2 GB | Better reasoning |
| Phi 3.5 Mini | 2.4 GB | Instruction following |
| Qwen 2.5 1.5B | 1.1 GB | Multilingual |
| Gemma 2 2B | 1.5 GB | Helpful assistant |

Start with **SmolLM2 360M** for testing. Move to 1B+ models for production use.

## Context injection

The most powerful pattern for local AI is injecting your app's data into the system prompt. This gives the model knowledge about the user's specific content:

```typescript
async function chatWithContext(userMessage: string, notes: Note[]) {
  const notesSummary = notes
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 20)
    .map(note => `- "${note.title}": ${note.content.slice(0, 200)}`)
    .join('\n');

  const response = await ai.chat([
    {
      role: 'system',
      content: [
        'You are an AI assistant integrated into a notes app.',
        'You have access to the user\'s notes:',
        notesSummary,
        'Reference specific notes when relevant. Be concise.',
      ].join('\n\n'),
    },
    { role: 'user', content: userMessage },
  ]);

  return response;
}
```

### Context size considerations

Local models have smaller context windows than cloud models (typically 2K-4K tokens). Tips:

- **Truncate content** — Send the first 200 characters of each note, not the full text.
- **Limit the number** — Include the 20 most recent notes, not all of them.
- **Be selective** — Only include content relevant to the conversation topic.
- **Summarize** — If you have many notes, summarize them by tag or project first.

## State and subscriptions

```typescript
const state = ai.getState();
// {
//   initialized: boolean,
//   providers: ProviderStatus[],
//   models: ModelInfo[],
//   activeModel: string | null,
//   activeProvider: string | null,
//   downloading: { modelId: string, progress: number } | null,
//   error: string | null,
// }

const unsubscribe = ai.subscribe(state => {
  // Called on every state change
});
```

## Custom configuration

### Custom AI instance

```typescript
import { createAI, BrowserProvider, OllamaProvider } from '@nearstack-dev/ai';

const ai = createAI({
  providers: [
    new BrowserProvider({ backend: 'webgpu' }),
    new OllamaProvider({ baseUrl: 'http://localhost:11434' }),
  ],
  defaultModel: 'SmolLM2-360M-Instruct-q4f16_1-MLC',
  autoInitialize: true,
});
```

### Browser-only

```typescript
import { createAI, BrowserProvider } from '@nearstack-dev/ai';

const ai = createAI({
  providers: [new BrowserProvider()],
});
```

### Ollama-only

```typescript
import { createAI, OllamaProvider } from '@nearstack-dev/ai';

const ai = createAI({
  providers: [new OllamaProvider()],
});
```

## UI helpers

The AI instance includes helpers for building UIs:

```typescript
// Model choices formatted for <select> dropdowns
const choices = ai.ui.getModelChoices();
// [{ value: 'model-id', label: 'Model Name', size: '240 MB', status: {...} }]

// Provider choices
const providers = ai.ui.getProviderChoices();

// Format bytes
ai.ui.formatSize(1100000000); // "1.1 GB"
```

## Browser support

| Browser | WebGPU | WebAssembly |
|---------|--------|-------------|
| Chrome 113+ | Yes | Yes |
| Edge 113+ | Yes | Yes |
| Safari 18+ | Yes | Yes |
| Firefox | No | Yes |

WebGPU is significantly faster. WebAssembly works everywhere but is slower. The library auto-detects and uses the best available backend.
