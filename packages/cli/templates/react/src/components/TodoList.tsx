import { useState } from 'react';
import { useLiveQuery } from '@nearstack-dev/react';
import { TodoModel } from '../models/Todo';

export function TodoList() {
  const [title, setTitle] = useState('');
  const { data: todos = [], loading } = useLiveQuery(
    () => TodoModel.table().getAll(),
    [],
    TodoModel
  );

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

  const toggle = async (id: string, completed: boolean) => {
    await TodoModel.table().update(id, { completed: !completed });
  };

  const remove = async (id: string) => {
    await TodoModel.table().delete(id);
  };

  return (
    <section className="card">
      <h2>Todos</h2>
      <form onSubmit={addTodo} className="todo-form">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a task" />
        <button type="submit">Add</button>
      </form>

      {loading ? <p>Loading...</p> : null}

      <ul className="todo-list">
        {todos.map((todo) => (
          <li key={todo.id}>
            <label>
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => {
                  void toggle(todo.id, todo.completed);
                }}
              />
              <span className={todo.completed ? 'done' : ''}>{todo.title}</span>
            </label>
            <button
              onClick={() => {
                void remove(todo.id);
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
