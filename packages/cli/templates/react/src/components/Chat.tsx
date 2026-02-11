import { useState } from 'react';
import { useChat } from '@nearstack-dev/react/ai';

export function Chat() {
  const [input, setInput] = useState('');
  const { messages, send, isStreaming, error, clear } = useChat();

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
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`bubble ${message.role}`}>
            <strong>{message.role}:</strong> {message.content}
          </div>
        ))}
        {isStreaming ? <p>Streaming response…</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </div>
      <form onSubmit={onSubmit} className="todo-form">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask your local model"
        />
        <button type="submit" disabled={isStreaming}>
          Send
        </button>
      </form>
    </section>
  );
}
