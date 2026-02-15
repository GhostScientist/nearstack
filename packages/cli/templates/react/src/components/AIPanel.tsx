import { useEffect, useMemo, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import { useChat, useModelSelector } from '@nearstack-dev/react/ai';
import type { Note } from '../models/Note';

interface AIPanelProps {
  notes: Note[];
}

function buildSystemPrompt(notes: Note[]): string | undefined {
  if (notes.length === 0) return undefined;

  const notesSummary = notes
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 20)
    .map(note => {
      const tags = note.tags.length > 0 ? ` [${note.tags.join(', ')}]` : '';
      return `- "${note.title || 'Untitled'}"${tags}: ${note.content.slice(0, 200)}`;
    })
    .join('\n');

  return [
    'You are a helpful AI assistant integrated into a personal notes app.',
    "You have access to the user's notes and can help find information, summarize content, suggest connections between notes, and answer questions.",
    `The user has ${notes.length} notes. Here are the most recent:`,
    notesSummary,
    'Be concise and helpful. Reference specific notes by title when relevant.',
  ].join('\n\n');
}

export function AIPanel({ notes }: AIPanelProps) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const systemPrompt = useMemo(() => buildSystemPrompt(notes), [notes]);
  const { messages, send, isStreaming, error, clear } = useChat(undefined, { systemPrompt });
  const {
    choices,
    selectModel,
    downloadModel,
    isDownloading,
    downloadProgress,
    currentSelection,
    selectedModel,
  } = useModelSelector();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const needsSetup =
    !selectedModel ||
    (selectedModel.status?.state !== 'cached' && selectedModel.status?.state !== 'ready');

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-2">
        <h2 className="text-sm font-semibold">AI Assistant</h2>
        {messages.length > 0 && (
          <button onClick={clear} className="text-xs text-neutral-400 hover:text-black">
            Clear
          </button>
        )}
      </div>

      {needsSetup ? (
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <p className="text-sm font-medium">Set up a local AI model</p>
          <p className="mt-1 text-xs text-neutral-500">
            Models run entirely on your device. No data leaves your browser.
          </p>

          <select
            className="mt-4 w-full border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-black focus:outline-none"
            value={currentSelection ?? ''}
            onChange={e => {
              if (e.target.value) void selectModel(e.target.value);
            }}
            disabled={isDownloading}
          >
            <option value="">Select a model</option>
            {choices.map(choice => (
              <option key={choice.value} value={choice.value} disabled={choice.disabled}>
                {choice.group} &middot; {choice.label}
              </option>
            ))}
          </select>

          {selectedModel?.status?.state === 'available' && (
            <button
              onClick={() => void downloadModel(selectedModel.id)}
              className="mt-3 w-full bg-black px-3 py-2 text-sm text-white hover:bg-neutral-800"
            >
              Download model
            </button>
          )}

          {isDownloading && (
            <div className="mt-3 w-full">
              <div className="h-1 w-full overflow-hidden bg-neutral-200">
                <div
                  className="h-full bg-black transition-all"
                  style={{ width: `${Math.round(downloadProgress * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                Downloading {Math.round(downloadProgress * 100)}%
              </p>
            </div>
          )}

          {selectedModel?.status?.state === 'error' && (
            <p className="mt-2 text-xs text-red-600">{selectedModel.status.message}</p>
          )}
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="flex h-full items-center justify-center">
                <div className="text-center text-neutral-400">
                  <p className="text-sm font-medium">Ask about your notes</p>
                  <div className="mt-3 space-y-1.5 text-xs">
                    <p className="text-neutral-500">&ldquo;Summarize my recent notes&rdquo;</p>
                    <p className="text-neutral-500">&ldquo;What topics come up most?&rdquo;</p>
                    <p className="text-neutral-500">&ldquo;Help me draft a note about...&rdquo;</p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`text-sm ${
                    message.role === 'assistant'
                      ? 'prose prose-sm prose-neutral max-w-none'
                      : 'ml-8 bg-neutral-100 px-3 py-2'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <Markdown>{message.content}</Markdown>
                  ) : (
                    message.content
                  )}
                </div>
              ))}
              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
            <div ref={bottomRef} />
          </div>

          <form
            className="border-t border-neutral-200 p-3"
            onSubmit={async e => {
              e.preventDefault();
              const value = input.trim();
              if (!value) return;
              setInput('');
              await send(value);
            }}
          >
            <div className="flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask anything..."
                className="flex-1 border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus:border-black focus:outline-none"
              />
              <button
                type="submit"
                disabled={isStreaming}
                className="bg-black px-3 py-2 text-sm text-white hover:bg-neutral-800 disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
