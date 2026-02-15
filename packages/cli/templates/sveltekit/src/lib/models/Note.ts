import { defineModel } from '@nearstack-dev/core';

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

export const NoteModel = defineModel<Note>('notes');
