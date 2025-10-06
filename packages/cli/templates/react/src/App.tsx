import { useState, useEffect } from 'react';
import { TodoModel, type Todo } from './models/Todo';
import './App.css';

function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodoTitle, setNewTodoTitle] = useState('');

  useEffect(() => {
    loadTodos();
  }, []);

  const loadTodos = async () => {
    const allTodos = await TodoModel.table().getAll();
    setTodos(allTodos);
  };

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoTitle.trim()) return;

    const newTodo = await TodoModel.table().insert({
      title: newTodoTitle,
      completed: false,
      createdAt: Date.now(),
    });

    setTodos([...todos, newTodo]);
    setNewTodoTitle('');
  };

  const toggleTodo = async (id: string) => {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;

    const updated = await TodoModel.table().update(id, {
      completed: !todo.completed,
    });

    if (updated) {
      setTodos(todos.map((t) => (t.id === id ? updated : t)));
    }
  };

  const deleteTodo = async (id: string) => {
    await TodoModel.table().delete(id);
    setTodos(todos.filter((t) => t.id !== id));
  };

  return (
    <div className="app">
      <h1>Nearstack Todo App</h1>
      <p className="subtitle">Local-first, powered by @nearstack-dev/core</p>

      <form onSubmit={addTodo} className="todo-form">
        <input
          type="text"
          value={newTodoTitle}
          onChange={(e) => setNewTodoTitle(e.target.value)}
          placeholder="What needs to be done?"
          className="todo-input"
        />
        <button type="submit" className="add-button">
          Add
        </button>
      </form>

      <div className="todo-list">
        {todos.length === 0 ? (
          <p className="empty-state">No todos yet. Add one above!</p>
        ) : (
          todos.map((todo) => (
            <div key={todo.id} className="todo-item">
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => toggleTodo(todo.id)}
                className="todo-checkbox"
              />
              <span
                className={`todo-title ${todo.completed ? 'completed' : ''}`}
              >
                {todo.title}
              </span>
              <button
                onClick={() => deleteTodo(todo.id)}
                className="delete-button"
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>

      <div className="stats">
        <span>{todos.filter((t) => !t.completed).length} remaining</span>
        <span>{todos.length} total</span>
      </div>
    </div>
  );
}

export default App;
