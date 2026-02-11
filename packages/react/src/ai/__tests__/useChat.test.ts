import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useChat } from '../useChat';

async function* streamChunks() {
  yield { content: 'Hello' };
  yield { content: ' world' };
}

describe('useChat', () => {
  it('streams assistant responses into message history', async () => {
    const mockAI = {
      stream: () => streamChunks(),
    } as any;

    const { result } = renderHook(() => useChat(mockAI));

    await act(async () => {
      await result.current.send('Hi');
    });

    await waitFor(() => {
      expect(result.current.messages).toEqual([
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello world' },
      ]);
      expect(result.current.isStreaming).toBe(false);
    });
  });
});
