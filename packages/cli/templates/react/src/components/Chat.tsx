import { useState, useRef, useEffect, useMemo } from 'react';
import Markdown from 'react-markdown';
import { useChat } from '@nearstack-dev/react/ai';
import { useLiveQuery } from '@nearstack-dev/react';
import { TodoModel, type Todo } from '../models/Todo';

function buildSystemPrompt(todos: Todo[]): string | undefined {
  if (todos.length === 0) return undefined;

  const capped = todos.slice(0, 50);
  const pending = capped.filter((t) => !t.completed);
  const completed = capped.filter((t) => t.completed);

  let prompt = 'You are a helpful assistant. The user has a local todo list.\n\n';

  if (pending.length > 0) {
    prompt += 'Pending todos:\n';
    for (const t of pending) {
      prompt += `- ${t.title}\n`;
    }
  }

  if (completed.length > 0) {
    prompt += '\nCompleted todos:\n';
    for (const t of completed) {
      prompt += `- ${t.title}\n`;
    }
  }

  prompt += '\nUse this context to answer questions about their todos when relevant.';
  return prompt;
}

export function Chat() {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: todos = [] } = useLiveQuery(
    () => TodoModel.table().getAll(),
    [],
    TodoModel
  );

  const systemPrompt = useMemo(() => buildSystemPrompt(todos), [todos]);

  const { messages, send, isStreaming, error, clear } = useChat(undefined, {
    systemPrompt,
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const message = input;
    setInput('');
    await send(message);
  };

  return (
    <section className="card">
      <div className="row">
        <h2>AI Chat</h2>
        <button onClick={clear}>Clear</button>
      </div>
      <div className="chat-messages">
        {messages.length === 0 && !isStreaming ? (
          <p className="chat-placeholder">
            Ask your local AI about your todos, or anything else.
          </p>
        ) : null}
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`bubble ${message.role}`}>
            {message.role === 'assistant' ? (
              <Markdown>{message.content}</Markdown>
            ) : (
              message.content
            )}
          </div>
        ))}
        {isStreaming && messages[messages.length - 1]?.role !== 'assistant' ? (
          <div className="bubble assistant streaming-indicator">Thinking...</div>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={onSubmit} className="todo-form">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about your todos..."
        />
        <button type="submit" disabled={isStreaming}>
          Send
        </button>
      </form>
    </section>
  );
}
