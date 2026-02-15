import { useState, useEffect, useRef } from 'react';
import { NoteModel, type Note } from '../models/Note';

interface NoteEditorProps {
  note: Note;
}

export function NoteEditor({ note }: NoteEditorProps) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [tagInput, setTagInput] = useState('');
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    setTitle(note.title);
    setContent(note.content);
  }, [note.id, note.title, note.content]);

  const save = (updates: Partial<Note>) => {
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      void NoteModel.table().update(note.id, { ...updates, updatedAt: Date.now() });
    }, 300);
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    save({ title: value });
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    save({ content: value });
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (!tag || note.tags.includes(tag)) {
      setTagInput('');
      return;
    }
    const newTags = [...note.tags, tag];
    void NoteModel.table().update(note.id, { tags: newTags, updatedAt: Date.now() });
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    const newTags = note.tags.filter(t => t !== tag);
    void NoteModel.table().update(note.id, { tags: newTags, updatedAt: Date.now() });
  };

  const togglePin = () => {
    void NoteModel.table().update(note.id, { pinned: !note.pinned, updatedAt: Date.now() });
  };

  const deleteNote = () => {
    void NoteModel.table().delete(note.id);
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-2">
        <div className="flex items-center gap-3">
          <button
            onClick={togglePin}
            className={`px-2 py-1 text-xs font-medium transition-colors ${
              note.pinned
                ? 'bg-black text-white'
                : 'border border-neutral-300 text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            {note.pinned ? 'Pinned' : 'Pin'}
          </button>
          <span className="text-xs text-neutral-400">
            {wordCount} {wordCount === 1 ? 'word' : 'words'} &middot; {charCount} {charCount === 1 ? 'char' : 'chars'}
          </span>
        </div>
        <button
          onClick={deleteNote}
          className="px-2 py-1 text-xs text-neutral-400 hover:text-red-600 transition-colors"
        >
          Delete
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <input
          type="text"
          value={title}
          onChange={e => handleTitleChange(e.target.value)}
          placeholder="Note title"
          className="w-full border-0 p-0 text-2xl font-semibold tracking-tight placeholder:text-neutral-300 focus:outline-none focus:ring-0"
        />
        <textarea
          value={content}
          onChange={e => handleContentChange(e.target.value)}
          placeholder="Start writing..."
          className="mt-4 block min-h-[400px] w-full resize-none border-0 p-0 text-base leading-relaxed text-neutral-700 placeholder:text-neutral-300 focus:outline-none focus:ring-0"
        />
      </div>

      <div className="border-t border-neutral-200 px-6 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {note.tags.map(tag => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 border border-neutral-200 px-2 py-0.5 text-xs"
            >
              {tag}
              <button onClick={() => removeTag(tag)} className="text-neutral-400 hover:text-black">
                &times;
              </button>
            </span>
          ))}
          <form
            onSubmit={e => {
              e.preventDefault();
              addTag();
            }}
            className="inline-flex"
          >
            <input
              type="text"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              placeholder="Add tag..."
              className="w-24 border-0 p-0 text-xs placeholder:text-neutral-400 focus:outline-none focus:ring-0"
            />
          </form>
        </div>
      </div>
    </div>
  );
}
