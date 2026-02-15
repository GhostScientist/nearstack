<script setup lang="ts">
import { AI, type Message } from '@nearstack-dev/ai';
import { computed, onMounted, ref } from 'vue';
import { TodoModel, type Todo } from './models/Todo';

const ai = new AI();
const todos = ref<Todo[]>([]);
const todoTitle = ref('');
const models = ref(ai.models.list());
const selectedModel = ref('');
const isDownloading = ref(false);
const downloadProgress = ref(0);
const messages = ref<Message[]>([]);
const chatInput = ref('');
const isSending = ref(false);
const error = ref('');

const hasModel = computed(() => Boolean(selectedModel.value));

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
  todos.value = await TodoModel.table().getAll();
}

async function addTodo() {
  if (!todoTitle.value.trim()) return;
  await TodoModel.table().insert({ title: todoTitle.value.trim(), completed: false, createdAt: Date.now() });
  todoTitle.value = '';
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

async function onModelChange() {
  if (!selectedModel.value) return;
  const model = models.value.find((entry) => entry.id === selectedModel.value);
  if (!model) return;

  if (model.status.state === 'available') {
    isDownloading.value = true;
    downloadProgress.value = 0;
    const unsubscribe = ai.subscribe((state) => {
      if (state.downloading?.modelId === selectedModel.value) {
        downloadProgress.value = state.downloading.progress;
      }
    });
    try {
      await ai.models.download(selectedModel.value);
    } finally {
      unsubscribe();
      isDownloading.value = false;
    }
  }

  await ai.models.use(selectedModel.value);
  models.value = ai.models.list();
}

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text || !selectedModel.value) return;
  error.value = '';
  chatInput.value = '';
  const next = [...messages.value, { role: 'user', content: text } as Message];
  messages.value = next;
  isSending.value = true;
  try {
    const systemPrompt = buildSystemPrompt(todos.value);
    const apiMessages: Message[] = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...next]
      : next;
    const reply = await ai.chat(apiMessages);
    messages.value = [...next, { role: 'assistant', content: reply }];
  } catch (chatError) {
    error.value = chatError instanceof Error ? chatError.message : 'Chat failed';
  } finally {
    isSending.value = false;
  }
}

onMounted(async () => {
  await refreshTodos();
  await ai.ready();
  models.value = ai.models.list();
  selectedModel.value = ai.models.active()?.id ?? '';
});
</script>

<template>
  <div class="mx-auto grid min-h-screen max-w-7xl gap-6 p-6 lg:grid-cols-[2fr_1fr]">
    <main class="space-y-4">
      <h1 class="text-4xl font-bold tracking-tight">Nearstack + Vue</h1>
      <section class="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
        <h2 class="text-xl font-semibold">Todos</h2>
        <form class="mt-3 flex gap-2" @submit.prevent="addTodo">
          <input v-model="todoTitle" class="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Add a task" />
          <button class="rounded-md bg-cyan-500 px-4 py-2 font-medium text-slate-950" type="submit">Add</button>
        </form>
        <ul class="mt-4 space-y-2">
          <li v-for="todo in todos" :key="todo.id" class="flex items-center justify-between rounded-md border border-slate-700 p-2">
            <label class="flex items-center gap-3">
              <input type="checkbox" :checked="todo.completed" @change="toggle(todo)" />
              <span :class="{ 'line-through opacity-50': todo.completed }">{{ todo.title }}</span>
            </label>
            <button class="text-sm text-rose-300" type="button" @click="remove(todo.id)">Delete</button>
          </li>
        </ul>
      </section>
    </main>

    <aside class="space-y-4">
      <section class="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
        <h2 class="text-xl font-semibold">Model Setup</h2>
        <select v-model="selectedModel" class="mt-3 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2" @change="onModelChange">
          <option value="">Select a model</option>
          <option v-for="model in models" :key="model.id" :value="model.id">{{ model.provider }} · {{ model.name }}</option>
        </select>
        <p v-if="isDownloading" class="mt-3 text-sm text-slate-300">Downloading {{ Math.round(downloadProgress * 100) }}%</p>
      </section>

      <section class="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
        <h2 class="text-xl font-semibold">AI Chat</h2>
        <div class="mt-3 h-80 space-y-2 overflow-y-auto rounded-md border border-slate-700 bg-slate-950 p-2">
          <p v-if="messages.length === 0" class="text-sm text-slate-400">Ask AI about your todos.</p>
          <div v-for="(message, index) in messages" :key="`${message.role}-${index}`" class="max-w-[90%] rounded-md px-3 py-2 text-sm" :class="message.role === 'assistant' ? 'bg-slate-800' : 'ml-auto bg-cyan-500 text-slate-950'">
            {{ message.content }}
          </div>
        </div>
        <p v-if="error" class="mt-2 text-sm text-rose-300">{{ error }}</p>
        <form class="mt-3 flex gap-2" @submit.prevent="sendMessage">
          <input v-model="chatInput" class="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2" placeholder="Ask about your todos..." />
          <button class="rounded-md bg-cyan-500 px-4 py-2 font-medium text-slate-950" :disabled="isSending || !hasModel" type="submit">Send</button>
        </form>
      </section>
    </aside>
  </div>
</template>
