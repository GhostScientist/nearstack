<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { AI, type Message, type ModelInfo } from '@nearstack-dev/ai';
import type { Note } from '../models/Note';

const props = defineProps<{ notes: Note[]; ai: AI }>();

const input = ref('');
const messages = ref<Message[]>([]);
const isSending = ref(false);
const error = ref('');
const bottomEl = ref<HTMLDivElement>();
const models = ref<ModelInfo[]>(props.ai.models.list());
const selectedModel = ref(props.ai.models.active()?.id ?? '');
const isDownloading = ref(false);
const downloadProgress = ref(0);

const selectedModelInfo = computed(() => models.value.find(m => m.id === selectedModel.value));
const needsSetup = computed(() => {
  const m = selectedModelInfo.value;
  return !m || (m.status.state !== 'cached' && m.status.state !== 'ready');
});

function buildSystemPrompt(): string | undefined {
  if (props.notes.length === 0) return undefined;
  const summary = props.notes
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 20)
    .map(n => {
      const tags = n.tags.length ? ` [${n.tags.join(', ')}]` : '';
      return `- "${n.title || 'Untitled'}"${tags}: ${n.content.slice(0, 200)}`;
    })
    .join('\n');
  return [
    'You are a helpful AI assistant in a personal notes app.',
    `The user has ${props.notes.length} notes:`,
    summary,
    'Be concise. Reference note titles when relevant.',
  ].join('\n\n');
}

async function selectModelAndDownload() {
  if (!selectedModel.value) return;
  const model = models.value.find(m => m.id === selectedModel.value);
  if (!model) return;

  if (model.status.state === 'available') {
    isDownloading.value = true;
    downloadProgress.value = 0;
    const unsub = props.ai.subscribe(state => {
      if (state.downloading?.modelId === selectedModel.value) {
        downloadProgress.value = state.downloading.progress;
      }
    });
    try {
      await props.ai.models.download(selectedModel.value);
    } finally {
      unsub();
      isDownloading.value = false;
    }
  }
  await props.ai.models.use(selectedModel.value);
  models.value = props.ai.models.list();
}

async function send() {
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  error.value = '';
  const next: Message[] = [...messages.value, { role: 'user', content: text }];
  messages.value = next;
  isSending.value = true;
  try {
    const reply = await props.ai.chat(next, { systemPrompt: buildSystemPrompt() });
    messages.value = [...next, { role: 'assistant', content: reply }];
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Chat failed';
  } finally {
    isSending.value = false;
    await nextTick();
    bottomEl.value?.scrollIntoView({ behavior: 'smooth' });
  }
}

function clear() {
  messages.value = [];
  error.value = '';
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex items-center justify-between border-b border-neutral-200 px-4 py-2">
      <h2 class="text-sm font-semibold">AI Assistant</h2>
      <button v-if="messages.length > 0" @click="clear" class="text-xs text-neutral-400 hover:text-black">Clear</button>
    </div>

    <div v-if="needsSetup" class="flex flex-1 flex-col items-center justify-center p-6 text-center">
      <p class="text-sm font-medium">Set up a local AI model</p>
      <p class="mt-1 text-xs text-neutral-500">Models run entirely on your device. No data leaves your browser.</p>
      <select
        v-model="selectedModel"
        class="mt-4 w-full border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-black focus:outline-none"
        :disabled="isDownloading"
      >
        <option value="">Select a model</option>
        <option v-for="m in models" :key="m.id" :value="m.id">{{ m.provider }} &middot; {{ m.name }}</option>
      </select>
      <button
        v-if="selectedModelInfo?.status.state === 'available'"
        @click="selectModelAndDownload"
        class="mt-3 w-full bg-black px-3 py-2 text-sm text-white hover:bg-neutral-800"
      >
        Download model
      </button>
      <div v-if="isDownloading" class="mt-3 w-full">
        <div class="h-1 w-full overflow-hidden bg-neutral-200">
          <div class="h-full bg-black transition-all" :style="{ width: `${Math.round(downloadProgress * 100)}%` }" />
        </div>
        <p class="mt-1 text-xs text-neutral-500">Downloading {{ Math.round(downloadProgress * 100) }}%</p>
      </div>
    </div>

    <template v-else>
      <div class="flex-1 overflow-y-auto p-4">
        <div v-if="messages.length === 0" class="flex h-full items-center justify-center text-center text-neutral-400">
          <div>
            <p class="text-sm font-medium">Ask about your notes</p>
            <div class="mt-3 space-y-1.5 text-xs text-neutral-500">
              <p>&ldquo;Summarize my recent notes&rdquo;</p>
              <p>&ldquo;What topics come up most?&rdquo;</p>
              <p>&ldquo;Help me draft a note about...&rdquo;</p>
            </div>
          </div>
        </div>
        <div class="space-y-3">
          <div
            v-for="(msg, i) in messages"
            :key="`${msg.role}-${i}`"
            :class="['text-sm', msg.role === 'assistant' ? 'text-neutral-700' : 'ml-8 bg-neutral-100 px-3 py-2']"
          >
            {{ msg.content }}
          </div>
          <p v-if="error" class="text-xs text-red-600">{{ error }}</p>
        </div>
        <div ref="bottomEl" />
      </div>
      <form @submit.prevent="send" class="border-t border-neutral-200 p-3">
        <div class="flex gap-2">
          <input
            v-model="input"
            placeholder="Ask anything..."
            class="flex-1 border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-black focus:outline-none"
          />
          <button
            type="submit"
            :disabled="isSending"
            class="bg-black px-3 py-2 text-sm text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </template>
  </div>
</template>
