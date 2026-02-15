<script lang="ts">
  import { AI, type Message, type ModelInfo } from '@nearstack-dev/ai';
  import type { Note } from '$lib/models/Note';

  export let notes: Note[];
  export let ai: AI;

  let input = '';
  let messages: Message[] = [];
  let isSending = false;
  let error = '';
  let bottomEl: HTMLDivElement;
  let models: ModelInfo[] = ai.models.list();
  let selectedModel = ai.models.active()?.id ?? '';
  let isDownloading = false;
  let downloadProgress = 0;

  $: selectedModelInfo = models.find(m => m.id === selectedModel);
  $: needsSetup = !selectedModelInfo || (selectedModelInfo.status.state !== 'cached' && selectedModelInfo.status.state !== 'ready');

  function buildSystemPrompt(): string | undefined {
    if (notes.length === 0) return undefined;
    const summary = notes
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 20)
      .map(n => {
        const tags = n.tags.length ? ` [${n.tags.join(', ')}]` : '';
        return `- "${n.title || 'Untitled'}"${tags}: ${n.content.slice(0, 200)}`;
      })
      .join('\n');
    return [
      'You are a helpful AI assistant in a personal notes app.',
      `The user has ${notes.length} notes:`,
      summary,
      'Be concise. Reference note titles when relevant.',
    ].join('\n\n');
  }

  async function selectAndDownload() {
    if (!selectedModel) return;
    const model = models.find(m => m.id === selectedModel);
    if (!model) return;

    if (model.status.state === 'available') {
      isDownloading = true;
      downloadProgress = 0;
      const unsub = ai.subscribe(state => {
        if (state.downloading?.modelId === selectedModel) {
          downloadProgress = state.downloading.progress;
        }
      });
      try {
        await ai.models.download(selectedModel);
      } finally {
        unsub();
        isDownloading = false;
      }
    }
    await ai.models.use(selectedModel);
    models = ai.models.list();
  }

  async function send() {
    const text = input.trim();
    if (!text) return;
    input = '';
    error = '';
    const next: Message[] = [...messages, { role: 'user', content: text }];
    messages = next;
    isSending = true;
    try {
      const reply = await ai.chat(next, { systemPrompt: buildSystemPrompt() });
      messages = [...next, { role: 'assistant', content: reply }];
    } catch (e) {
      error = e instanceof Error ? e.message : 'Chat failed';
    } finally {
      isSending = false;
      setTimeout(() => bottomEl?.scrollIntoView({ behavior: 'smooth' }), 0);
    }
  }

  function clear() {
    messages = [];
    error = '';
  }
</script>

<div class="flex h-full flex-col">
  <div class="flex items-center justify-between border-b border-neutral-200 px-4 py-2">
    <h2 class="text-sm font-semibold">AI Assistant</h2>
    {#if messages.length > 0}
      <button on:click={clear} class="text-xs text-neutral-400 hover:text-black">Clear</button>
    {/if}
  </div>

  {#if needsSetup}
    <div class="flex flex-1 flex-col items-center justify-center p-6 text-center">
      <p class="text-sm font-medium">Set up a local AI model</p>
      <p class="mt-1 text-xs text-neutral-500">Models run entirely on your device. No data leaves your browser.</p>
      <select
        bind:value={selectedModel}
        class="mt-4 w-full border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-black focus:outline-none"
        disabled={isDownloading}
      >
        <option value="">Select a model</option>
        {#each models as m (m.id)}
          <option value={m.id}>{m.provider} &middot; {m.name}</option>
        {/each}
      </select>
      {#if selectedModelInfo?.status.state === 'available'}
        <button
          on:click={selectAndDownload}
          class="mt-3 w-full bg-black px-3 py-2 text-sm text-white hover:bg-neutral-800"
        >
          Download model
        </button>
      {/if}
      {#if isDownloading}
        <div class="mt-3 w-full">
          <div class="h-1 w-full overflow-hidden bg-neutral-200">
            <div class="h-full bg-black transition-all" style="width: {Math.round(downloadProgress * 100)}%"></div>
          </div>
          <p class="mt-1 text-xs text-neutral-500">Downloading {Math.round(downloadProgress * 100)}%</p>
        </div>
      {/if}
    </div>
  {:else}
    <div class="flex-1 overflow-y-auto p-4">
      {#if messages.length === 0}
        <div class="flex h-full items-center justify-center text-center text-neutral-400">
          <div>
            <p class="text-sm font-medium">Ask about your notes</p>
            <div class="mt-3 space-y-1.5 text-xs text-neutral-500">
              <p>&ldquo;Summarize my recent notes&rdquo;</p>
              <p>&ldquo;What topics come up most?&rdquo;</p>
              <p>&ldquo;Help me draft a note about...&rdquo;</p>
            </div>
          </div>
        </div>
      {/if}
      <div class="space-y-3">
        {#each messages as msg, i (`${msg.role}-${i}`)}
          <div class="text-sm {msg.role === 'assistant' ? 'text-neutral-700' : 'ml-8 bg-neutral-100 px-3 py-2'}">
            {msg.content}
          </div>
        {/each}
        {#if error}
          <p class="text-xs text-red-600">{error}</p>
        {/if}
      </div>
      <div bind:this={bottomEl}></div>
    </div>
    <form on:submit|preventDefault={send} class="border-t border-neutral-200 p-3">
      <div class="flex gap-2">
        <input
          bind:value={input}
          placeholder="Ask anything..."
          class="flex-1 border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-black focus:outline-none"
        />
        <button
          type="submit"
          disabled={isSending}
          class="bg-black px-3 py-2 text-sm text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </form>
  {/if}
</div>
