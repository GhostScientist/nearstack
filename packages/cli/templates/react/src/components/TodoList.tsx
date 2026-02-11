import { useState } from 'react';
import { useLiveQuery } from '@nearstack-dev/react';
import { TodoModel } from '../models/Todo';

export function TodoList() {
  const [title, setTitle] = useState('');
  const { data: todos = [], loading } = useLiveQuery(() => TodoModel.table().getAll(), [], TodoModel);

  const addTodo = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;

    await TodoModel.table().insert({
      title: title.trim(),
      completed: false,
      createdAt: Date.now(),
    });
    setTitle('');
  };

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
      <h2 className="text-xl font-semibold">Todos</h2>
      <form onSubmit={addTodo} className="mt-3 flex gap-2">
        <input
          className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task"
        />
        <button className="rounded-md bg-cyan-500 px-4 py-2 font-medium text-slate-950">Add</button>
      </form>
      {loading ? <p className="mt-3 text-sm text-slate-400">Loading...</p> : null}
      <ul className="mt-4 space-y-2">
        {todos.map((todo) => (
          <li key={todo.id} className="flex items-center justify-between rounded-md border border-slate-700 p-2">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => {
                  void TodoModel.table().update(todo.id, { completed: !todo.completed });
                }}
              />
              <span className={todo.completed ? 'text-slate-500 line-through' : ''}>{todo.title}</span>
            </label>
            <button
              className="text-sm text-rose-300"
              onClick={() => {
                void TodoModel.table().delete(todo.id);
              }}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
