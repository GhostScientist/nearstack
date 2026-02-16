import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AI, Message, ModelInfo } from '@nearstack-dev/ai';
import { Todo, TodoModel } from './models/todo.model';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html'
})
export class AppComponent implements OnInit {
  private readonly ai = new AI();

  todos: Todo[] = [];
  todoTitle = '';
  models: ModelInfo[] = [];
  selectedModel = '';
  isDownloading = false;
  downloadProgress = 0;
  messages: Message[] = [];
  chatInput = '';
  isSending = false;
  error = '';

  async ngOnInit() {
    await this.refreshTodos();
    await this.ai.ready();
    this.models = this.ai.models.list();
    this.selectedModel = this.ai.models.active()?.id ?? '';
  }

  private buildSystemPrompt(items: Todo[]): string | undefined {
    if (!items.length) return undefined;
    const pending = items.filter((todo) => !todo.completed).map((todo) => `- ${todo.title}`).join('\n');
    const complete = items.filter((todo) => todo.completed).map((todo) => `- ${todo.title}`).join('\n');
    return [
      'You are a helpful assistant with local todo context.',
      pending ? `Pending todos:\n${pending}` : '',
      complete ? `Completed todos:\n${complete}` : '',
      'Use this context when it helps answer questions.',
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  async refreshTodos() {
    this.todos = await TodoModel.table().getAll();
  }

  async addTodo() {
    if (!this.todoTitle.trim()) return;
    await TodoModel.table().insert({ title: this.todoTitle.trim(), completed: false, createdAt: Date.now() });
    this.todoTitle = '';
    await this.refreshTodos();
  }

  async toggle(todo: Todo) {
    await TodoModel.table().update(todo.id, { completed: !todo.completed });
    await this.refreshTodos();
  }

  async remove(id: string) {
    await TodoModel.table().delete(id);
    await this.refreshTodos();
  }

  async onModelChange(modelId: string) {
    this.selectedModel = modelId;
    const model = this.models.find((entry) => entry.id === modelId);
    if (!model) return;

    if (model.status.state === 'available') {
      this.isDownloading = true;
      const unsubscribe = this.ai.subscribe((state) => {
        if (state.downloading?.modelId === modelId) {
          this.downloadProgress = state.downloading.progress;
        }
      });
      try {
        await this.ai.models.download(modelId);
      } finally {
        unsubscribe();
        this.isDownloading = false;
      }
    }

    await this.ai.models.use(modelId);
    this.models = this.ai.models.list();
  }

  async sendMessage() {
    const text = this.chatInput.trim();
    if (!text || !this.selectedModel) return;

    this.chatInput = '';
    this.error = '';
    const next = [...this.messages, { role: 'user', content: text } as Message];
    this.messages = next;
    this.isSending = true;

    try {
      const systemPrompt = this.buildSystemPrompt(this.todos);
      const apiMessages: Message[] = systemPrompt
        ? [{ role: 'system', content: systemPrompt }, ...next]
        : next;
      const reply = await this.ai.chat(apiMessages);
      this.messages = [...next, { role: 'assistant', content: reply }];
    } catch (chatError) {
      this.error = chatError instanceof Error ? chatError.message : 'Chat failed';
    } finally {
      this.isSending = false;
    }
  }
}
