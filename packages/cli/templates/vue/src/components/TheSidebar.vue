<script setup lang="ts">
import type { Note } from '../models/Note';

defineProps<{
  notes: Note[];
  activeNoteId: string | null;
  search: string;
}>();

const emit = defineEmits<{
  'update:search': [value: string];
  selectNote: [id: string];
  newNote: [];
}>();

function formatDate(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
</script>

<template>
  <aside class="flex w-72 flex-col border-r border-neutral-200 bg-neutral-50">
    <div class="space-y-2 p-3">
      <input
        type="text"
        :value="search"
        @input="emit('update:search', ($event.target as HTMLInputElement).value)"
        placeholder="Search notes..."
        class="w-full border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-black focus:outline-none"
      />
      <button
        @click="emit('newNote')"
        class="w-full bg-black px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
      >
        + New Note
      </button>
    </div>

    <div class="flex-1 overflow-y-auto">
      <template v-if="notes.some(n => n.pinned)">
        <p class="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-widest text-neutral-400">Pinned</p>
        <button
          v-for="note in notes.filter(n => n.pinned)"
          :key="note.id"
          @click="emit('selectNote', note.id)"
          :class="[
            'w-full px-3 py-2.5 text-left transition-colors',
            note.id === activeNoteId ? 'bg-black text-white' : 'hover:bg-neutral-100',
          ]"
        >
          <p :class="['truncate text-sm font-medium', note.id === activeNoteId ? 'text-white' : 'text-black']">
            {{ note.title || 'Untitled' }}
          </p>
          <p :class="['mt-0.5 truncate text-xs', note.id === activeNoteId ? 'text-neutral-300' : 'text-neutral-500']">
            {{ note.content.slice(0, 80) || 'Empty note' }}
          </p>
          <span class="mt-1 text-[11px] text-neutral-400">{{ formatDate(note.updatedAt) }}</span>
        </button>
      </template>

      <template v-if="notes.some(n => n.pinned) && notes.some(n => !n.pinned)">
        <p class="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-widest text-neutral-400">All Notes</p>
      </template>

      <button
        v-for="note in notes.filter(n => !n.pinned)"
        :key="note.id"
        @click="emit('selectNote', note.id)"
        :class="[
          'w-full px-3 py-2.5 text-left transition-colors',
          note.id === activeNoteId ? 'bg-black text-white' : 'hover:bg-neutral-100',
        ]"
      >
        <p :class="['truncate text-sm font-medium', note.id === activeNoteId ? 'text-white' : 'text-black']">
          {{ note.title || 'Untitled' }}
        </p>
        <p :class="['mt-0.5 truncate text-xs', note.id === activeNoteId ? 'text-neutral-300' : 'text-neutral-500']">
          {{ note.content.slice(0, 80) || 'Empty note' }}
        </p>
        <span class="mt-1 text-[11px] text-neutral-400">{{ formatDate(note.updatedAt) }}</span>
      </button>

      <p v-if="notes.length === 0" class="px-3 py-8 text-center text-sm text-neutral-400">
        {{ search ? 'No notes match your search' : 'No notes yet' }}
      </p>
    </div>
  </aside>
</template>
