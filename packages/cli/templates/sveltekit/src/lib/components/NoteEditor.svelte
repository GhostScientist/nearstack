<script lang="ts">
  import { NoteModel, type Note } from '$lib/models/Note';

  export let note: Note;

  let title = note.title;
  let content = note.content;
  let tagInput = '';
  let saveTimer: ReturnType<typeof setTimeout>;

  $: if (note.id) {
    title = note.title;
    content = note.content;
  }

  function save(updates: Partial<Note>) {
    clearTimeout(saveTimer);
    const id = note.id;
    saveTimer = setTimeout(() => {
      void NoteModel.table().update(id, { ...updates, updatedAt: Date.now() });
    }, 300);
  }

  function handleTitleInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    title = value;
    save({ title: value });
  }

  function handleContentInput(e: Event) {
    const value = (e.target as HTMLTextAreaElement).value;
    content = value;
    save({ content: value });
  }

  function addTag() {
    const tag = tagInput.trim().toLowerCase();
    if (!tag || note.tags.includes(tag)) {
      tagInput = '';
      return;
    }
    void NoteModel.table().update(note.id, { tags: [...note.tags, tag], updatedAt: Date.now() });
    tagInput = '';
  }

  function removeTag(tag: string) {
    void NoteModel.table().update(note.id, { tags: note.tags.filter(t => t !== tag), updatedAt: Date.now() });
  }

  function togglePin() {
    void NoteModel.table().update(note.id, { pinned: !note.pinned, updatedAt: Date.now() });
  }

  function deleteNote() {
    void NoteModel.table().delete(note.id);
  }

  $: wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
</script>

<div class="flex flex-1 flex-col">
  <div class="flex items-center justify-between border-b border-neutral-200 px-6 py-2">
    <div class="flex items-center gap-3">
      <button
        on:click={togglePin}
        class="px-2 py-1 text-xs font-medium transition-colors {note.pinned ? 'bg-black text-white' : 'border border-neutral-300 text-neutral-600 hover:bg-neutral-100'}"
      >
        {note.pinned ? 'Pinned' : 'Pin'}
      </button>
      <span class="text-xs text-neutral-400">
        {wordCount} {wordCount === 1 ? 'word' : 'words'} &middot; {content.length} chars
      </span>
    </div>
    <button on:click={deleteNote} class="px-2 py-1 text-xs text-neutral-400 transition-colors hover:text-red-600">
      Delete
    </button>
  </div>

  <div class="flex-1 overflow-y-auto px-6 py-4">
    <input
      type="text"
      value={title}
      on:input={handleTitleInput}
      placeholder="Note title"
      class="w-full border-0 p-0 text-2xl font-semibold tracking-tight placeholder:text-neutral-300 focus:outline-none focus:ring-0"
    />
    <textarea
      value={content}
      on:input={handleContentInput}
      placeholder="Start writing..."
      class="mt-4 block min-h-[400px] w-full resize-none border-0 p-0 text-base leading-relaxed text-neutral-700 placeholder:text-neutral-300 focus:outline-none focus:ring-0"
    />
  </div>

  <div class="border-t border-neutral-200 px-6 py-3">
    <div class="flex flex-wrap items-center gap-2">
      {#each note.tags as tag}
        <span class="inline-flex items-center gap-1 border border-neutral-200 px-2 py-0.5 text-xs">
          {tag}
          <button on:click={() => removeTag(tag)} class="text-neutral-400 hover:text-black">&times;</button>
        </span>
      {/each}
      <form on:submit|preventDefault={addTag} class="inline-flex">
        <input
          bind:value={tagInput}
          type="text"
          placeholder="Add tag..."
          class="w-24 border-0 p-0 text-xs placeholder:text-neutral-400 focus:outline-none focus:ring-0"
        />
      </form>
    </div>
  </div>
</div>
