import { useState } from 'react';
import { ai as defaultAI } from '@nearstack-dev/ai';
import type { AI, ChatOptions, Message } from '@nearstack-dev/ai';

export function useChat(instance: AI = defaultAI) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (content: string, options?: ChatOptions) => {
    if (!content.trim()) return;

    const nextMessages: Message[] = [...messages, { role: 'user', content }];
    setMessages(nextMessages);
    setIsStreaming(true);
    setError(null);

    let assistantText = '';

    try {
      for await (const chunk of instance.stream(nextMessages, options)) {
        assistantText += chunk.content;
        setMessages([...nextMessages, { role: 'assistant', content: assistantText }]);
      }
    } catch (streamError) {
      setError(streamError instanceof Error ? streamError.message : String(streamError));
    } finally {
      setIsStreaming(false);
    }
  };

  const clear = () => {
    setMessages([]);
    setError(null);
  };

  return { messages, send, clear, isStreaming, error };
}
