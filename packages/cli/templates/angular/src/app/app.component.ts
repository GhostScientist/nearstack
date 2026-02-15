import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AI, Message, ModelInfo } from '@nearstack-dev/ai';
import { Note, NoteModel } from './models/note.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  private readonly ai = new AI();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  notes: Note[] = [];
  activeNoteId: string | null = null;
  search = '';
  showAI = false;

  // Editor state
  editorTitle = '';
  editorContent = '';
  tagInput = '';

  // AI state
  models: ModelInfo[] = [];
  selectedModel = '';
  isDownloading = false;
  downloadProgress = 0;
  messages: Message[] = [];
  chatInput = '';
  isSending = false;
  error = '';

  get filteredNotes(): Note[] {
    return this.notes
      .filter(note => {
        if (!this.search) return true;
        const q = this.search.toLowerCase();
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
  }

  get activeNote(): Note | null {
    return this.notes.find(n => n.id === this.activeNoteId) ?? null;
  }

  get pinnedNotes(): Note[] {
    return this.filteredNotes.filter(n => n.pinned);
  }

  get unpinnedNotes(): Note[] {
    return this.filteredNotes.filter(n => !n.pinned);
  }

  get allTags(): string[] {
    return [...new Set(this.notes.flatMap(n => n.tags))];
  }

  get wordCount(): number {
    return this.editorContent.trim() ? this.editorContent.trim().split(/\s+/).length : 0;
  }

  get needsSetup(): boolean {
    const m = this.models.find(m => m.id === this.selectedModel);
    return !m || (m.status.state !== 'cached' && m.status.state !== 'ready');
  }

  get selectedModelInfo(): ModelInfo | undefined {
    return this.models.find(m => m.id === this.selectedModel);
  }

  async ngOnInit() {
    await this.refreshNotes();
    NoteModel.subscribe(() => void this.refreshNotes());
    await this.ai.ready();
    this.models = this.ai.models.list();
    this.selectedModel = this.ai.models.active()?.id ?? '';
  }

  async refreshNotes() {
    this.notes = await NoteModel.table().getAll();
    if (this.activeNote) {
      this.editorTitle = this.activeNote.title;
      this.editorContent = this.activeNote.content;
    }
  }

  selectNote(id: string) {
    this.activeNoteId = id;
    const note = this.notes.find(n => n.id === id);
    if (note) {
      this.editorTitle = note.title;
      this.editorContent = note.content;
    }
  }

  async createNote() {
    const note = await NoteModel.table().insert({
      title: '',
      content: '',
      tags: [],
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    this.activeNoteId = note.id;
    this.editorTitle = '';
    this.editorContent = '';
  }

  private save(updates: Partial<Note>) {
    if (!this.activeNoteId) return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    const id = this.activeNoteId;
    this.saveTimer = setTimeout(() => {
      void NoteModel.table().update(id, { ...updates, updatedAt: Date.now() });
    }, 300);
  }

  onTitleChange(value: string) {
    this.editorTitle = value;
    this.save({ title: value });
  }

  onContentChange(value: string) {
    this.editorContent = value;
    this.save({ content: value });
  }

  addTag() {
    const tag = this.tagInput.trim().toLowerCase();
    if (!tag || !this.activeNote || this.activeNote.tags.includes(tag)) {
      this.tagInput = '';
      return;
    }
    void NoteModel.table().update(this.activeNote.id, {
      tags: [...this.activeNote.tags, tag],
      updatedAt: Date.now(),
    });
    this.tagInput = '';
  }

  removeTag(tag: string) {
    if (!this.activeNote) return;
    void NoteModel.table().update(this.activeNote.id, {
      tags: this.activeNote.tags.filter(t => t !== tag),
      updatedAt: Date.now(),
    });
  }

  togglePin() {
    if (!this.activeNote) return;
    void NoteModel.table().update(this.activeNote.id, {
      pinned: !this.activeNote.pinned,
      updatedAt: Date.now(),
    });
  }

  deleteNote() {
    if (!this.activeNote) return;
    void NoteModel.table().delete(this.activeNote.id);
    this.activeNoteId = null;
  }

  handleExport() {
    const blob = new Blob([JSON.stringify(this.notes, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nearstack-notes.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  handleImport() {
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
  }

  private buildSystemPrompt(): string | undefined {
    if (this.notes.length === 0) return undefined;
    const summary = this.notes
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 20)
      .map(n => {
        const tags = n.tags.length ? ` [${n.tags.join(', ')}]` : '';
        return `- "${n.title || 'Untitled'}"${tags}: ${n.content.slice(0, 200)}`;
      })
      .join('\n');
    return [
      'You are a helpful AI assistant in a personal notes app.',
      `The user has ${this.notes.length} notes:`,
      summary,
      'Be concise. Reference note titles when relevant.',
    ].join('\n\n');
  }

  async onModelSelect(modelId: string) {
    this.selectedModel = modelId;
    const model = this.models.find(m => m.id === modelId);
    if (!model) return;

    if (model.status.state === 'available') {
      this.isDownloading = true;
      this.downloadProgress = 0;
      const unsub = this.ai.subscribe(state => {
        if (state.downloading?.modelId === modelId) {
          this.downloadProgress = state.downloading.progress;
        }
      });
      try {
        await this.ai.models.download(modelId);
      } finally {
        unsub();
        this.isDownloading = false;
      }
    }
    await this.ai.models.use(modelId);
    this.models = this.ai.models.list();
  }

  async sendMessage() {
    const text = this.chatInput.trim();
    if (!text) return;
    this.chatInput = '';
    this.error = '';
    const next: Message[] = [...this.messages, { role: 'user', content: text }];
    this.messages = next;
    this.isSending = true;
    try {
      const reply = await this.ai.chat(next, { systemPrompt: this.buildSystemPrompt() });
      this.messages = [...next, { role: 'assistant', content: reply }];
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Chat failed';
    } finally {
      this.isSending = false;
    }
  }

  clearChat() {
    this.messages = [];
    this.error = '';
  }

  formatDate(timestamp: number): string {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return new Date(timestamp).toLocaleDateString();
  }
}
