import { useState } from 'react';
import { useLiveQuery } from '@nearstack-dev/react';
import { NoteModel, type Note } from './models/Note';
import { Sidebar } from './components/Sidebar';
import { NoteEditor } from './components/NoteEditor';
import { AIPanel } from './components/AIPanel';

function App() {
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showAI, setShowAI] = useState(false);

  const { data: notes = [] } = useLiveQuery(() => NoteModel.table().getAll(), [], NoteModel);

  const filteredNotes = notes
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

  const activeNote = notes.find(n => n.id === activeNoteId) ?? null;

  const createNote = async () => {
    const note = await NoteModel.table().insert({
      title: '',
      content: '',
      tags: [],
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    setActiveNoteId(note.id);
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(notes, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nearstack-notes.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
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
    };
    input.click();
  };

  const allTags = [...new Set(notes.flatMap(n => n.tags))];

  return (
    <div className="flex h-screen flex-col bg-white text-black">
      <header className="flex items-center justify-between border-b border-neutral-200 px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="h-3.5 w-3.5 bg-black" />
          <h1 className="text-base font-semibold tracking-tight">Nearstack Notes</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowAI(!showAI)}
            className={`px-3 py-1.5 text-sm font-medium transition-colors ${
              showAI ? 'bg-black text-white' : 'border border-neutral-300 hover:bg-neutral-100'
            }`}
          >
            AI Assistant
          </button>
          <button
            onClick={handleExport}
            className="border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100"
          >
            Export
          </button>
          <button
            onClick={handleImport}
            className="border border-neutral-300 px-3 py-1.5 text-sm hover:bg-neutral-100"
          >
            Import
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          notes={filteredNotes}
          activeNoteId={activeNoteId}
          search={search}
          onSearchChange={setSearch}
          onSelectNote={setActiveNoteId}
          onNewNote={createNote}
        />

        <main className="flex flex-1 flex-col overflow-hidden">
          {activeNote ? (
            <NoteEditor note={activeNote} />
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center text-neutral-400">
                <p className="text-lg font-light">Select a note or create a new one</p>
                <button
                  onClick={createNote}
                  className="mt-4 bg-black px-4 py-2 text-sm text-white hover:bg-neutral-800"
                >
                  New Note
                </button>
              </div>
            </div>
          )}
        </main>

        {showAI && (
          <aside className="w-96 border-l border-neutral-200">
            <AIPanel notes={notes} />
          </aside>
        )}
      </div>

      <footer className="border-t border-neutral-200 px-6 py-2 text-[11px] text-neutral-400">
        {notes.length} {notes.length === 1 ? 'note' : 'notes'} &middot; {allTags.length}{' '}
        {allTags.length === 1 ? 'tag' : 'tags'} &middot; Stored locally in your browser
      </footer>
    </div>
  );
}

export default App;
