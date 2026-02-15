<script setup lang="ts">
import { ref, watch } from 'vue';
import { NoteModel, type Note } from '../models/Note';

const props = defineProps<{ note: Note }>();

const title = ref(props.note.title);
const content = ref(props.note.content);
const tagInput = ref('');
let saveTimer: ReturnType<typeof setTimeout>;

watch(() => props.note.id, () => {
  title.value = props.note.title;
  content.value = props.note.content;
});

function save(updates: Partial<Note>) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void NoteModel.table().update(props.note.id, { ...updates, updatedAt: Date.now() });
  }, 300);
}

function handleTitleInput(value: string) {
  title.value = value;
  save({ title: value });
}

function handleContentInput(value: string) {
  content.value = value;
  save({ content: value });
}

function addTag() {
  const tag = tagInput.value.trim().toLowerCase();
  if (!tag || props.note.tags.includes(tag)) {
    tagInput.value = '';
    return;
  }
  void NoteModel.table().update(props.note.id, { tags: [...props.note.tags, tag], updatedAt: Date.now() });
  tagInput.value = '';
}

function removeTag(tag: string) {
  void NoteModel.table().update(props.note.id, { tags: props.note.tags.filter(t => t !== tag), updatedAt: Date.now() });
}

function togglePin() {
  void NoteModel.table().update(props.note.id, { pinned: !props.note.pinned, updatedAt: Date.now() });
}

function deleteNote() {
  void NoteModel.table().delete(props.note.id);
}
</script>

<template>
  <div class="flex flex-1 flex-col">
    <div class="flex items-center justify-between border-b border-neutral-200 px-6 py-2">
      <div class="flex items-center gap-3">
        <button
          @click="togglePin"
          :class="[
            'px-2 py-1 text-xs font-medium transition-colors',
            note.pinned ? 'bg-black text-white' : 'border border-neutral-300 text-neutral-600 hover:bg-neutral-100',
          ]"
        >
          {{ note.pinned ? 'Pinned' : 'Pin' }}
        </button>
        <span class="text-xs text-neutral-400">
          {{ content.trim() ? content.trim().split(/\s+/).length : 0 }} words &middot;
          {{ content.length }} chars
        </span>
      </div>
      <button @click="deleteNote" class="px-2 py-1 text-xs text-neutral-400 transition-colors hover:text-red-600">
        Delete
      </button>
    </div>

    <div class="flex-1 overflow-y-auto px-6 py-4">
      <input
        type="text"
        :value="title"
        @input="handleTitleInput(($event.target as HTMLInputElement).value)"
        placeholder="Note title"
        class="w-full border-0 p-0 text-2xl font-semibold tracking-tight placeholder:text-neutral-300 focus:outline-none focus:ring-0"
      />
      <textarea
        :value="content"
        @input="handleContentInput(($event.target as HTMLTextAreaElement).value)"
        placeholder="Start writing..."
        class="mt-4 block min-h-[400px] w-full resize-none border-0 p-0 text-base leading-relaxed text-neutral-700 placeholder:text-neutral-300 focus:outline-none focus:ring-0"
      />
    </div>

    <div class="border-t border-neutral-200 px-6 py-3">
      <div class="flex flex-wrap items-center gap-2">
        <span
          v-for="tag in note.tags"
          :key="tag"
          class="inline-flex items-center gap-1 border border-neutral-200 px-2 py-0.5 text-xs"
        >
          {{ tag }}
          <button @click="removeTag(tag)" class="text-neutral-400 hover:text-black">&times;</button>
        </span>
        <form @submit.prevent="addTag" class="inline-flex">
          <input
            v-model="tagInput"
            type="text"
            placeholder="Add tag..."
            class="w-24 border-0 p-0 text-xs placeholder:text-neutral-400 focus:outline-none focus:ring-0"
          />
        </form>
      </div>
    </div>
  </div>
</template>
