import { useState, useEffect } from 'react';
import { TodoModel, type Todo } from './models/Todo';
import { AIExample } from './examples/AIExample';
import { RAGExample } from './examples/RAGExample';
import { RTCExample } from './examples/RTCExample';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState('todos');
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

  const renderTabContent = () => {
    switch (activeTab) {
      case 'todos':
        return (
          <div>
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
      case 'ai':
        return <AIExample />;
      case 'rag':
        return <RAGExample />;
      case 'rtc':
        return <RTCExample />;
      default:
        return null;
    }
  };

  return (
    <div className="app">
      <nav className="tabs">
        <button 
          className={`tab ${activeTab === 'todos' ? 'active' : ''}`}
          onClick={() => setActiveTab('todos')}
        >
          Todo App
        </button>
        <button 
          className={`tab ${activeTab === 'ai' ? 'active' : ''}`}
          onClick={() => setActiveTab('ai')}
        >
          AI Context
        </button>
        <button 
          className={`tab ${activeTab === 'rag' ? 'active' : ''}`}
          onClick={() => setActiveTab('rag')}
        >
          RAG Engine
        </button>
        <button 
          className={`tab ${activeTab === 'rtc' ? 'active' : ''}`}
          onClick={() => setActiveTab('rtc')}
        >
          RTC Sync
        </button>
      </nav>
      
      <main className="tab-content">
        {renderTabContent()}
      </main>
    </div>
  );
}

export default App;
