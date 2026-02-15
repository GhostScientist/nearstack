import type { Note } from '../models/Note';

interface SidebarProps {
  notes: Note[];
  activeNoteId: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  onSelectNote: (id: string) => void;
  onNewNote: () => void;
}

function formatDate(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function Sidebar({ notes, activeNoteId, search, onSearchChange, onSelectNote, onNewNote }: SidebarProps) {
  const pinned = notes.filter(n => n.pinned);
  const unpinned = notes.filter(n => !n.pinned);

  return (
    <aside className="flex w-72 flex-col border-r border-neutral-200 bg-neutral-50">
      <div className="p-3 space-y-2">
        <input
          type="text"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search notes..."
          className="w-full border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-black focus:outline-none"
        />
        <button
          onClick={onNewNote}
          className="w-full bg-black px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          + New Note
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {pinned.length > 0 && (
          <div>
            <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
              Pinned
            </p>
            {pinned.map(note => (
              <NoteItem
                key={note.id}
                note={note}
                active={note.id === activeNoteId}
                onClick={() => onSelectNote(note.id)}
              />
            ))}
          </div>
        )}

        <div>
          {pinned.length > 0 && unpinned.length > 0 && (
            <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
              All Notes
            </p>
          )}
          {unpinned.map(note => (
            <NoteItem
              key={note.id}
              note={note}
              active={note.id === activeNoteId}
              onClick={() => onSelectNote(note.id)}
            />
          ))}
        </div>

        {notes.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-neutral-400">
            {search ? 'No notes match your search' : 'No notes yet'}
          </p>
        )}
      </div>
    </aside>
  );
}

function NoteItem({ note, active, onClick }: { note: Note; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full px-3 py-2.5 text-left transition-colors ${
        active ? 'bg-black text-white' : 'hover:bg-neutral-100'
      }`}
    >
      <p className={`truncate text-sm font-medium ${active ? 'text-white' : 'text-black'}`}>
        {note.title || 'Untitled'}
      </p>
      <p className={`mt-0.5 truncate text-xs ${active ? 'text-neutral-300' : 'text-neutral-500'}`}>
        {note.content.slice(0, 80) || 'Empty note'}
      </p>
      <div className="mt-1 flex items-center gap-2">
        <span className={`text-[11px] ${active ? 'text-neutral-400' : 'text-neutral-400'}`}>
          {formatDate(note.updatedAt)}
        </span>
        {note.tags.length > 0 && (
          <span className={`text-[11px] ${active ? 'text-neutral-400' : 'text-neutral-400'}`}>
            {note.tags.slice(0, 3).join(', ')}
          </span>
        )}
      </div>
    </button>
  );
}
