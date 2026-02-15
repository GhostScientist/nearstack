import { defineModel } from '@nearstack-dev/core';

export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
}

export const TodoModel = defineModel<Todo>('todos');
