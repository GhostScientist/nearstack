<script lang="ts">
  import { onMount } from 'svelte';
  import { AI } from '@nearstack-dev/ai';
  import { NoteModel, type Note } from '$lib/models/Note';
  import Sidebar from '$lib/components/Sidebar.svelte';
  import NoteEditor from '$lib/components/NoteEditor.svelte';
  import AIPanel from '$lib/components/AIPanel.svelte';

  const ai = new AI();
  let notes: Note[] = [];
  let activeNoteId: string | null = null;
  let search = '';
  let showAI = false;

  $: filteredNotes = notes
    .filter(note => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        note.title.toLowerCase().includes(q) ||
        note.content.toLowerCase().includes(q) ||
        note.tags.some(t => t.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });

  $: activeNote = notes.find(n => n.id === activeNoteId) ?? null;
  $: allTags = [...new Set(notes.flatMap(n => n.tags))];

  async function refreshNotes() {
    notes = await NoteModel.table().getAll();
  }

  async function createNote() {
    const note = await NoteModel.table().insert({
      title: '',
      content: '',
      tags: [],
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    activeNoteId = note.id;
    await refreshNotes();
  }

  function handleExport() {
    const blob = new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nearstack-notes.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      const imported = JSON.parse(text) as Note[];
      for (const note of imported) {
        const { id, ...data } = note;
        await NoteModel.table().insert(data);
      }
      await refreshNotes();
    };
    input.click();
  }

  onMount(async () => {
    await refreshNotes();
    NoteModel.subscribe(() => void refreshNotes());
    await ai.ready();
  });
</script>

<div class="flex h-screen flex-col bg-white text-black">
  <header class="flex items-center justify-between border-b border-neutral-200 px-6 py-3">
    <div class="flex items-center gap-3">
      <div class="h-3.5 w-3.5 bg-black"></div>
      <h1 class="text-base font-semibold tracking-tight">Nearstack Notes</h1>
    </div>
    <div class="flex items-center gap-1.5">
      <button
        on:click={() => (showAI = !showAI)}
        class="px-3 py-1.5 text-sm font-medium transition-colors {showAI ? 'bg-black text-white' : 'border border-neutral-300 hover:bg-neutral-100'}"
      >
        AI Assistant
      </button>
      <button on:click={handleExport} class="border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100">
        Export
      </button>
      <button on:click={handleImport} class="border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100">
        Import
      </button>
    </div>
  </header>

  <div class="flex flex-1 overflow-hidden">
    <Sidebar
      notes={filteredNotes}
      {activeNoteId}
      {search}
      on:search={e => (search = e.detail)}
      on:select={e => (activeNoteId = e.detail)}
      on:create={createNote}
    />

    <main class="flex flex-1 flex-col overflow-hidden">
      {#if activeNote}
        <NoteEditor note={activeNote} />
      {:else}
        <div class="flex flex-1 items-center justify-center">
          <div class="text-center text-neutral-400">
            <p class="text-lg font-light">Select a note or create a new one</p>
            <button on:click={createNote} class="mt-4 bg-black px-4 py-2 text-sm text-white hover:bg-neutral-800">
              New Note
            </button>
          </div>
        </div>
      {/if}
    </main>

    {#if showAI}
      <aside class="w-96 border-l border-neutral-200">
        <AIPanel {notes} {ai} />
      </aside>
    {/if}
  </div>

  <footer class="border-t border-neutral-200 px-6 py-2 text-[11px] text-neutral-400">
    {notes.length} {notes.length === 1 ? 'note' : 'notes'} &middot;
    {allTags.length} {allTags.length === 1 ? 'tag' : 'tags'} &middot;
    Stored locally in your browser
  </footer>
</div>
