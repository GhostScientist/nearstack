import { useEffect, useMemo, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import { useChat } from '@nearstack-dev/react/ai';
import { useLiveQuery } from '@nearstack-dev/react';
import { TodoModel, type Todo } from '../models/Todo';

function buildSystemPrompt(todos: Todo[]): string | undefined {
  if (todos.length === 0) return undefined;

  const pending = todos.filter((todo) => !todo.completed).map((todo) => `- ${todo.title}`).join('\n');
  const complete = todos.filter((todo) => todo.completed).map((todo) => `- ${todo.title}`).join('\n');

  return [
    'You are a helpful assistant with local todo context.',
    pending ? `Pending todos:\n${pending}` : '',
    complete ? `Completed todos:\n${complete}` : '',
    'Use this context when it helps answer questions.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function Chat() {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const { data: todos = [] } = useLiveQuery(() => TodoModel.table().getAll(), [], TodoModel);
  const systemPrompt = useMemo(() => buildSystemPrompt(todos), [todos]);
  const { messages, send, isStreaming, error, clear } = useChat(undefined, { systemPrompt });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold">AI Chat</h2>
        <button className="text-sm text-slate-300" onClick={clear}>Clear</button>
      </div>
      <div className="h-80 space-y-2 overflow-y-auto rounded-md border border-slate-700 bg-slate-950 p-2">
        {messages.length === 0 ? <p className="text-sm text-slate-400">Ask AI about your todos.</p> : null}
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`max-w-[90%] rounded-md px-3 py-2 text-sm ${
              message.role === 'assistant' ? 'bg-slate-800' : 'ml-auto bg-cyan-500 text-slate-950'
            }`}
          >
            {message.role === 'assistant' ? <Markdown>{message.content}</Markdown> : message.content}
          </div>
        ))}
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        <div ref={bottomRef} />
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          const value = input.trim();
          if (!value) return;
          setInput('');
          await send(value);
        }}
      >
        <input
          className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about your todos..."
        />
        <button className="rounded-md bg-cyan-500 px-4 py-2 font-medium text-slate-950" disabled={isStreaming}>
          Send
        </button>
      </form>
    </section>
  );
}
