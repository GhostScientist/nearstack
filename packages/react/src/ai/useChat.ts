import { useRef, useState } from 'react';
import { ai as defaultAI } from '@nearstack-dev/ai';
import type { AI, ChatOptions, Message } from '@nearstack-dev/ai';

export function useChat(instance: AI = defaultAI) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesRef = useRef<Message[]>([]);

  // Keep ref in sync with state
  messagesRef.current = messages;

  const send = async (content: string, options?: ChatOptions) => {
    if (!content.trim()) return;
    if (isStreaming) return; // Prevent concurrent sends

    const userMessage: Message = { role: 'user', content };
    setMessages((prev) => [...prev, userMessage]);
    messagesRef.current = [...messagesRef.current, userMessage];
    
    setIsStreaming(true);
    setError(null);

    let assistantText = '';

    try {
      for await (const chunk of instance.stream(messagesRef.current, options)) {
        assistantText += chunk.content;
        setMessages((prev) => {
          // Update only if last message is not assistant or needs updating
          const withoutIncomplete = prev[prev.length - 1]?.role === 'assistant' 
            ? prev.slice(0, -1) 
            : prev;
          return [...withoutIncomplete, { role: 'assistant', content: assistantText }];
        });
      }
    } catch (streamError) {
      setError(streamError instanceof Error ? streamError.message : String(streamError));
    } finally {
      setIsStreaming(false);
    }
  };

  const clear = () => {
    setMessages([]);
    messagesRef.current = [];
    setError(null);
  };

  return { messages, send, clear, isStreaming, error };
}
