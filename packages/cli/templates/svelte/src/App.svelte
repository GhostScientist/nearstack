<script lang="ts">
  import { onMount } from 'svelte';
  import { TodoModel, type Todo } from './models/Todo';

  let todos: Todo[] = [];
  let newTodoTitle = '';

  onMount(async () => {
    await loadTodos();
  });

  async function loadTodos() {
    todos = await TodoModel.table().getAll();
  }

  async function addTodo(e: Event) {
    e.preventDefault();
    if (!newTodoTitle.trim()) return;

    const newTodo = await TodoModel.table().insert({
      title: newTodoTitle,
      completed: false,
      createdAt: Date.now(),
    });

    todos = [...todos, newTodo];
    newTodoTitle = '';
  }

  async function toggleTodo(id: string) {
    const todo = todos.find((t) => t.id === id);
    if (!todo) return;

    const updated = await TodoModel.table().update(id, {
      completed: !todo.completed,
    });

    if (updated) {
      todos = todos.map((t) => (t.id === id ? updated : t));
    }
  }

  async function deleteTodo(id: string) {
    await TodoModel.table().delete(id);
    todos = todos.filter((t) => t.id !== id);
  }

  $: remaining = todos.filter((t) => !t.completed).length;
</script>

<div class="app">
  <h1>Nearstack Todo App</h1>
  <p class="subtitle">Local-first, powered by @nearstack-dev/core</p>

  <form on:submit={addTodo} class="todo-form">
    <input
      type="text"
      bind:value={newTodoTitle}
      placeholder="What needs to be done?"
      class="todo-input"
    />
    <button type="submit" class="add-button">Add</button>
  </form>

  <div class="todo-list">
    {#if todos.length === 0}
      <p class="empty-state">No todos yet. Add one above!</p>
    {:else}
      {#each todos as todo (todo.id)}
        <div class="todo-item">
          <input
            type="checkbox"
            checked={todo.completed}
            on:change={() => toggleTodo(todo.id)}
            class="todo-checkbox"
          />
          <span class="todo-title" class:completed={todo.completed}>
            {todo.title}
          </span>
          <button on:click={() => deleteTodo(todo.id)} class="delete-button">
            Delete
          </button>
        </div>
      {/each}
    {/if}
  </div>

  <div class="stats">
    <span>{remaining} remaining</span>
    <span>{todos.length} total</span>
  </div>
</div>

<style>
  .app {
    max-width: 600px;
    margin: 0 auto;
    padding: 2rem;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
  }

  h1 {
    margin: 0 0 0.5rem;
    color: #000;
  }

  .subtitle {
    margin: 0 0 2rem;
    color: #666;
    font-size: 0.9rem;
  }

  .todo-form {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 2rem;
  }

  .todo-input {
    flex: 1;
    padding: 0.75rem;
    font-size: 1rem;
    border: 1px solid #d4d4d4;
  }

  .todo-input:focus {
    outline: none;
    border-color: #000;
  }

  .add-button {
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    background: #000;
    color: #fff;
    border: none;
    cursor: pointer;
  }

  .add-button:hover {
    background: #333;
  }

  .todo-list {
    margin-bottom: 1rem;
  }

  .empty-state {
    text-align: center;
    color: #999;
    padding: 2rem;
  }

  .todo-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: #fafafa;
    margin-bottom: 0.5rem;
    border: 1px solid #e5e5e5;
  }

  .todo-checkbox {
    width: 20px;
    height: 20px;
    cursor: pointer;
    accent-color: #000;
  }

  .todo-title {
    flex: 1;
    font-size: 1rem;
    color: #000;
  }

  .todo-title.completed {
    text-decoration: line-through;
    color: #999;
  }

  .delete-button {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    background: none;
    color: #999;
    border: 1px solid #d4d4d4;
    cursor: pointer;
  }

  .delete-button:hover {
    color: #000;
    border-color: #000;
  }

  .stats {
    display: flex;
    justify-content: space-between;
    color: #666;
    font-size: 0.875rem;
    padding-top: 1rem;
    border-top: 1px solid #e5e5e5;
  }
</style>
