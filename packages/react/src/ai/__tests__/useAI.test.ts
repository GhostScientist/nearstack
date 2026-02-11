import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAI } from '../useAI';
import type { AIState } from '@nearstack-dev/ai';

const baseState: AIState = {
  initialized: false,
  providers: [],
  models: [],
  activeModel: null,
  activeProvider: null,
  downloading: null,
  error: null,
};

describe('useAI', () => {
  it('subscribes to AI state updates', async () => {
    let listener: ((state: AIState) => void) | undefined;
    const ready = vi.fn().mockResolvedValue(undefined);
    const mockAI = {
      getState: vi.fn().mockReturnValue(baseState),
      subscribe: vi.fn((cb: (state: AIState) => void) => {
        listener = cb;
        return () => undefined;
      }),
      ready,
    } as any;

    const { result } = renderHook(() => useAI(mockAI));

    expect(result.current.isReady).toBe(false);
    act(() => {
      listener?.({ ...baseState, initialized: true });
    });

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
      expect(ready).toHaveBeenCalled();
    });
  });
});
