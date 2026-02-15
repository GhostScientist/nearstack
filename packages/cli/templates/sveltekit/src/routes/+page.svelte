<script lang="ts">
  import { onMount } from 'svelte';
  import { AI, type Message, type ModelInfo } from '@nearstack-dev/ai';
  import { TodoModel, type Todo } from '$lib/models/Todo';

  const ai = new AI();
  let todos: Todo[] = [];
  let todoTitle = '';
  let models: ModelInfo[] = [];
  let selectedModel = '';
  let isDownloading = false;
  let downloadProgress = 0;
  let messages: Message[] = [];
  let chatInput = '';
  let isSending = false;
  let error = '';

  function buildSystemPrompt(items: Todo[]): string | undefined {
    if (!items.length) return undefined;
    const pending = items.filter((todo) => !todo.completed).map((todo) => `- ${todo.title}`).join('\n');
    const complete = items.filter((todo) => todo.completed).map((todo) => `- ${todo.title}`).join('\n');
    return [
      'You are a helpful assistant. The user has local todo data.',
      pending ? `Pending todos:\n${pending}` : '',
      complete ? `Completed todos:\n${complete}` : '',
      'Use this context when it helps answer questions.',
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  async function refreshTodos() {
    todos = await TodoModel.table().getAll();
  }

  async function addTodo(event: SubmitEvent) {
    event.preventDefault();
    if (!todoTitle.trim()) return;
    await TodoModel.table().insert({ title: todoTitle.trim(), completed: false, createdAt: Date.now() });
    todoTitle = '';
    await refreshTodos();
  }

  async function toggle(todo: Todo) {
    await TodoModel.table().update(todo.id, { completed: !todo.completed });
    await refreshTodos();
  }

  async function remove(id: string) {
    await TodoModel.table().delete(id);
    await refreshTodos();
  }

  async function selectModel(modelId: string) {
    selectedModel = modelId;
    const model = models.find((entry) => entry.id === modelId);
    if (!model) return;

    if (model.status.state === 'available') {
      isDownloading = true;
      downloadProgress = 0;
      const unsubscribe = ai.subscribe((state) => {
        if (state.downloading?.modelId === modelId) {
          downloadProgress = state.downloading.progress;
        }
      });
      try {
        await ai.models.download(modelId);
      } finally {
        unsubscribe();
        isDownloading = false;
      }
    }

    await ai.models.use(modelId);
    models = ai.models.list();
  }

  async function sendMessage(event: SubmitEvent) {
    event.preventDefault();
    const text = chatInput.trim();
    if (!text || !selectedModel) return;
    chatInput = '';
    error = '';
    const next = [...messages, { role: 'user', content: text } as Message];
    messages = next;
    isSending = true;

    try {
      const systemPrompt = buildSystemPrompt(todos);
      const apiMessages: Message[] = systemPrompt
        ? [{ role: 'system', content: systemPrompt }, ...next]
        : next;
      const reply = await ai.chat(apiMessages);
      messages = [...next, { role: 'assistant', content: reply }];
    } catch (chatError) {
      error = chatError instanceof Error ? chatError.message : 'Chat failed';
    } finally {
      isSending = false;
    }
  }

  onMount(async () => {
    await refreshTodos();
    await ai.ready();
    models = ai.models.list();
    const active = ai.models.active();
    selectedModel = active?.id ?? '';
  });
</script>

<div class="mx-auto grid min-h-screen max-w-7xl gap-6 p-6 lg:grid-cols-[2fr_1fr]">
  <main class="space-y-4">
    <h1 class="text-4xl font-bold tracking-tight">Nearstack + SvelteKit</h1>
    <section class="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
      <h2 class="text-xl font-semibold">Todos</h2>
      <form class="mt-3 flex gap-2" on:submit={addTodo}>
        <input class="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2" bind:value={todoTitle} placeholder="Add a task" />
        <button class="rounded-md bg-cyan-500 px-4 py-2 font-medium text-slate-950" type="submit">Add</button>
      </form>
      <ul class="mt-4 space-y-2">
        {#each todos as todo (todo.id)}
          <li class="flex items-center justify-between rounded-md border border-slate-700 p-2">
            <label class="flex items-center gap-3">
              <input type="checkbox" checked={todo.completed} on:change={() => toggle(todo)} />
              <span class:line-through={todo.completed} class:opacity-50={todo.completed}>{todo.title}</span>
            </label>
            <button class="text-sm text-rose-300" on:click={() => remove(todo.id)}>Delete</button>
          </li>
        {/each}
      </ul>
    </section>
  </main>

  <aside class="space-y-4">
    <section class="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
      <h2 class="text-xl font-semibold">Model Setup</h2>
      <select class="mt-3 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2" bind:value={selectedModel} on:change={() => selectModel(selectedModel)}>
        <option value="">Select a model</option>
        {#each models as model (model.id)}
          <option value={model.id}>{model.provider} · {model.name}</option>
        {/each}
      </select>
      {#if isDownloading}
        <p class="mt-3 text-sm text-slate-300">Downloading {Math.round(downloadProgress * 100)}%</p>
      {/if}
    </section>

    <section class="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-xl font-semibold">AI Chat</h2>
        <button class="text-sm text-slate-300" on:click={() => { messages = []; error = ''; }}>Clear</button>
      </div>
      <div class="mt-3 h-80 space-y-2 overflow-y-auto rounded-md border border-slate-700 bg-slate-950 p-2">
        {#if messages.length === 0}
          <p class="text-sm text-slate-400">Ask AI about your todos.</p>
        {/if}
        {#each messages as message, index (`${message.role}-${index}`)}
          <div class={`max-w-[90%] rounded-md px-3 py-2 text-sm ${message.role === 'assistant' ? 'bg-slate-800' : 'ml-auto bg-cyan-500 text-slate-950'}`}>
            {message.content}
          </div>
        {/each}
      </div>
      {#if error}
        <p class="mt-2 text-sm text-rose-300">{error}</p>
      {/if}
      <form class="mt-3 flex gap-2" on:submit={sendMessage}>
        <input class="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2" bind:value={chatInput} placeholder="Ask about your todos..." />
        <button class="rounded-md bg-cyan-500 px-4 py-2 font-medium text-slate-950" disabled={isSending || !selectedModel} type="submit">Send</button>
      </form>
    </section>
  </aside>
</div>
