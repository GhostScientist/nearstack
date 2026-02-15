# CLI Reference

`@nearstack-dev/cli` scaffolds new Nearstack projects with framework-specific templates.

## Usage

```bash
npx @nearstack-dev/cli create <project-name>
```

Or using the `init` alias:

```bash
npx @nearstack-dev/cli init <project-name>
```

## Framework selection

The CLI prompts you to choose a framework:

| Framework | Build Tool | Key Features |
|-----------|-----------|--------------|
| **React** | Vite | React 19, hooks for data + AI, react-markdown |
| **Vue** | Vite | Vue 3 Composition API, multi-component SFC |
| **Angular** | Angular CLI | Angular 18, standalone components, FormsModule |
| **SvelteKit** | Vite | Svelte 4, SvelteKit routing, reactive stores |

All templates generate the same application—a personal notes app—adapted to each framework's conventions.

## What gets generated

### Common to all templates

- **Notes data model** with title, content, tags, pinned, timestamps
- **Sidebar** with search and note list
- **Note editor** with auto-save, tags, pin/unpin, delete
- **AI assistant panel** with model setup, chat, and streaming
- **Export/import** for data portability
- **Tailwind CSS** with black-and-white design
- **TypeScript** configuration
- **PWA manifest** for installability

### React-specific

```
my-app/
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.css
│   ├── models/Note.ts
│   └── components/
│       ├── Sidebar.tsx
│       ├── NoteEditor.tsx
│       └── AIPanel.tsx
├── index.html
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
└── package.json
```

Uses `@nearstack-dev/react` hooks: `useLiveQuery`, `useChat`, `useModelSelector`.

### Vue-specific

```
my-app/
├── src/
│   ├── App.vue
│   ├── main.ts
│   ├── style.css
│   ├── models/Note.ts
│   └── components/
│       ├── TheSidebar.vue
│       ├── NoteEditor.vue
│       └── AIPanel.vue
├── index.html
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
└── package.json
```

Uses Vue 3 Composition API with `<script setup>`. Emits events for parent-child communication.

### Angular-specific

```
my-app/
├── src/
│   ├── main.ts
│   ├── index.html
│   ├── styles.css
│   └── app/
│       ├── app.component.ts
│       ├── app.component.html
│       └── models/note.model.ts
├── angular.json
├── tsconfig.json
├── tsconfig.app.json
├── tailwind.config.js
├── postcss.config.js
└── package.json
```

Single standalone component with Angular's FormsModule for two-way binding.

### SvelteKit-specific

```
my-app/
├── src/
│   ├── app.css
│   ├── app.d.ts
│   ├── routes/
│   │   ├── +layout.svelte
│   │   └── +page.svelte
│   └── lib/
│       ├── models/Note.ts
│       └── components/
│           ├── Sidebar.svelte
│           ├── NoteEditor.svelte
│           └── AIPanel.svelte
├── vite.config.ts
├── svelte.config.js
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
└── package.json
```

Uses SvelteKit's file-based routing with Svelte 4 reactive syntax.

## Template customization

After scaffolding, the generated project is yours to modify. Common customizations:

### Adding new data models

Create a new file in `models/`:

```typescript
// src/models/Project.ts
import { defineModel } from '@nearstack-dev/core';

export interface Project {
  id: string;
  name: string;
  createdAt: number;
}

export const ProjectModel = defineModel<Project>('projects');
```

### Changing the design

The templates use Tailwind CSS utility classes. Modify classes directly in components to change the design. The base color scheme is configured in the global CSS file (`index.css`, `style.css`, or `styles.css`).

### Adding routes

- **React**: Add a router like `react-router-dom`
- **Vue**: Add `vue-router`
- **Angular**: Already includes `@angular/router`
- **SvelteKit**: Add files to `src/routes/`

## After scaffolding

```bash
cd my-app
npm install    # Install dependencies
npm run dev    # Start dev server
npm run build  # Build for production
```
