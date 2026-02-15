# Full-Stack Client-Side Patterns

This guide covers architecture patterns for building complete applications in the browser with Nearstack. The goal is to achieve what traditionally requires a server—entirely on the client.

## The mental model

In a traditional web app:

```
Browser (UI) → Server (Logic + Data) → Database
```

In a Nearstack app:

```
Browser (UI + Logic + Data + AI)
```

Everything runs in one place. IndexedDB is your database. WebGPU is your inference server. Your application code is your backend logic. The browser is capable of much more than rendering HTML.

## Data architecture

### Single model apps

For simple applications, one model is enough:

```typescript
const NoteModel = defineModel<Note>('notes');
```

All operations go through this model. Search, filter, and sort in application code.

### Multi-model apps

For richer applications, split data into multiple models with relationships managed in application code:

```typescript
const ProjectModel = defineModel<Project>('projects');
const NoteModel = defineModel<Note>('notes');
const TagModel = defineModel<Tag>('tags');

// Note references a project
interface Note {
  id: string;
  projectId: string;  // FK to Project
  title: string;
  content: string;
  tagIds: string[];   // FK array to Tags
}
```

### Querying across models

Without server-side joins, you fetch and combine data in application code:

```typescript
async function getProjectWithNotes(projectId: string) {
  const [project, allNotes] = await Promise.all([
    ProjectModel.table().get(projectId),
    NoteModel.table().find(n => n.projectId === projectId),
  ]);

  return { project, notes: allNotes };
}
```

This is fast because all data is local. There's no network latency.

### Denormalization

When query performance matters more than storage efficiency, duplicate data:

```typescript
interface Note {
  id: string;
  projectId: string;
  projectName: string;  // Denormalized from Project
  title: string;
  content: string;
  tags: string[];        // Denormalized from Tag (store names directly)
}
```

This avoids multi-model lookups for display. Update denormalized fields when the source changes.

## Search

### Full-text search

Client-side search across all your data:

```typescript
function search(query: string, notes: Note[]): Note[] {
  const terms = query.toLowerCase().split(/\s+/);

  return notes
    .map(note => {
      const text = `${note.title} ${note.content} ${note.tags.join(' ')}`.toLowerCase();
      const score = terms.reduce((acc, term) => acc + (text.includes(term) ? 1 : 0), 0);
      return { note, score };
    })
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(result => result.note);
}
```

For datasets under 10,000 records, this is fast enough for real-time search-as-you-type.

### Tag-based filtering

```typescript
function filterByTags(notes: Note[], selectedTags: string[]): Note[] {
  if (selectedTags.length === 0) return notes;
  return notes.filter(note =>
    selectedTags.every(tag => note.tags.includes(tag))
  );
}
```

## AI as a feature layer

Local AI isn't just a chatbot. It's a feature layer you can integrate deeply into your app.

### Summarization

```typescript
async function summarizeNote(note: Note): Promise<string> {
  return ai.chat([
    { role: 'system', content: 'Summarize the following note in 2-3 sentences.' },
    { role: 'user', content: `Title: ${note.title}\n\n${note.content}` },
  ]);
}
```

### Auto-tagging

```typescript
async function suggestTags(note: Note, existingTags: string[]): Promise<string[]> {
  const response = await ai.chat([
    {
      role: 'system',
      content: `Suggest 2-3 tags for this note. Available tags: ${existingTags.join(', ')}. You can also suggest new tags. Return only the tags, comma-separated.`,
    },
    { role: 'user', content: `${note.title}\n\n${note.content}` },
  ]);

  return response.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
}
```

### Smart search

```typescript
async function aiSearch(query: string, notes: Note[]): Promise<string> {
  const context = notes
    .slice(0, 20)
    .map(n => `[${n.id}] "${n.title}": ${n.content.slice(0, 150)}`)
    .join('\n');

  return ai.chat([
    {
      role: 'system',
      content: `You help find information in the user's notes. Here are their notes:\n${context}\n\nAnswer the question using information from the notes. Reference note titles when relevant.`,
    },
    { role: 'user', content: query },
  ]);
}
```

### Writing assistance

```typescript
async function continueWriting(note: Note): Promise<string> {
  return ai.chat([
    {
      role: 'system',
      content: 'Continue writing from where the user left off. Match their tone and style. Write 2-3 paragraphs.',
    },
    { role: 'user', content: `Title: ${note.title}\n\n${note.content}` },
  ]);
}
```

## Data portability

### JSON export/import

The simplest approach. Export all data as JSON, import it back:

```typescript
async function exportAllData() {
  const [notes, projects, tags] = await Promise.all([
    NoteModel.table().getAll(),
    ProjectModel.table().getAll(),
    TagModel.table().getAll(),
  ]);

  const data = { notes, projects, tags, exportedAt: Date.now() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, 'app-export.json');
}

async function importAllData(file: File) {
  const data = JSON.parse(await file.text());

  for (const note of data.notes ?? []) {
    const { id, ...rest } = note;
    await NoteModel.table().insert(rest);
  }
  // Repeat for other models
}
```

### Clipboard integration

```typescript
async function copyNoteToClipboard(note: Note) {
  await navigator.clipboard.writeText(
    `# ${note.title}\n\n${note.content}\n\nTags: ${note.tags.join(', ')}`
  );
}
```

## Offline and PWA

### Service Worker

The Vite PWA plugin (included in React template) generates a service worker that caches your app shell. After the first load, the app works entirely offline.

### Installability

The included `manifest.json` makes the app installable as a PWA. Users can add it to their home screen / dock and it opens like a native app.

### Offline-first data flow

```
User action
  → Write to IndexedDB (immediate, always works)
  → UI updates via subscription (instant feedback)
  → Optional: Queue for sync when online (future: @nearstack-dev/rtc)
```

## Performance considerations

### Data loading

- `getAll()` loads all records into memory. For most local-first apps (< 10K records), this is fine.
- For larger datasets, use `find()` with selective predicates.
- Cache frequently-accessed data in component state.

### AI inference

- Browser AI inference takes 1-10 seconds per response depending on model size and hardware.
- Always use streaming for user-facing responses.
- Keep system prompts under 500 tokens for best performance with small models.
- Batch AI operations (don't call `ai.chat()` in a loop).

### Reactivity

- Model subscriptions fire on every write. If you're writing in a loop, batch your writes or debounce the subscription handler.
- `useLiveQuery` re-runs the query on every subscription event. Keep queries efficient.

## What the browser gives you

| Traditional Backend | Browser Equivalent | Nearstack Integration |
|--------------------|--------------------|----------------------|
| Database | IndexedDB | `@nearstack-dev/core` |
| AI/ML inference | WebGPU / WebAssembly | `@nearstack-dev/ai` |
| File storage | IndexedDB / OPFS | Planned |
| Real-time sync | WebRTC | `@nearstack-dev/rtc` (planned) |
| Background jobs | Service Workers | PWA plugin |
| Authentication | Web Crypto API | Planned |
| Networking | Fetch / WebSockets | Native |

The browser is already a capable runtime. Nearstack's job is to make these APIs accessible through a clean, productive developer experience.
