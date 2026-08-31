import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AIState, ModelInfo } from '@nearstack-dev/ai';
import { useModelSelector } from '../useModelSelector';

const baseState: AIState = {
  initialized: true,
  providers: [],
  models: [],
  activeModel: null,
  activeProvider: null,
  downloading: null,
  error: null,
};

function makeModel(id: string, status: ModelInfo['status']): ModelInfo {
  return {
    id,
    name: id,
    provider: 'browser',
    size: 1_000_000,
    contextLength: 4096,
    status,
  };
}

interface MockAI {
  state: AIState;
  download: ReturnType<typeof vi.fn>;
  use: ReturnType<typeof vi.fn>;
  ai: any;
}

function makeMockAI(models: ModelInfo[]): MockAI {
  const state: AIState = { ...baseState, models };
  const download = vi.fn().mockResolvedValue(undefined);
  const use = vi.fn().mockResolvedValue(undefined);
  const ai = {
    getState: () => state,
    subscribe: () => () => undefined,
    ready: vi.fn().mockResolvedValue(undefined),
    models: {
      get: (id: string) => state.models.find((m) => m.id === id),
      download,
      use,
    },
    ui: {
      getModelChoices: () => [],
    },
  };
  return { state, download, use, ai };
}

describe('useModelSelector', () => {
  it('selectModel on a model in error state stages it for retry without calling use()', async () => {
    const { ai, download, use } = makeMockAI([
      makeModel('model-a', { state: 'error', message: 'previous failure' }),
    ]);

    const { result } = renderHook(() => useModelSelector(ai));

    await act(async () => {
      await result.current.selectModel('model-a');
    });

    // Errored models should never auto-activate — that path throws.
    expect(use).not.toHaveBeenCalled();
    // Hook must not silently kick off a download either; explicit user
    // action via downloadModel drives the retry.
    expect(download).not.toHaveBeenCalled();
    // The selection is staged so the template can render the retry UI.
    expect(result.current.currentSelection).toBe('model-a');
    expect(result.current.selectedModel?.status.state).toBe('error');
  });

  it('downloadModel retries successfully after a previous failure', async () => {
    const { ai, download, use } = makeMockAI([
      makeModel('model-a', { state: 'error', message: 'previous failure' }),
    ]);

    const { result } = renderHook(() => useModelSelector(ai));

    await act(async () => {
      await result.current.downloadModel('model-a');
    });

    expect(download).toHaveBeenCalledWith('model-a');
    expect(use).toHaveBeenCalledWith('model-a');
  });

  it('downloadModel is a no-op while a download is already in flight', async () => {
    const { ai, download } = makeMockAI([
      makeModel('model-a', { state: 'available' }),
    ]);

    let resolveDownload: () => void;
    download.mockImplementation(
      () =>
        new Promise<void>((res) => {
          resolveDownload = res;
        })
    );

    const { result } = renderHook(() => useModelSelector(ai));

    let firstCall!: Promise<void>;
    act(() => {
      firstCall = result.current.downloadModel('model-a');
    });

    await waitFor(() => expect(result.current.isDownloading).toBe(true));

    // Second call while the first is still pending should not invoke
    // download again.
    await act(async () => {
      await result.current.downloadModel('model-a');
    });

    expect(download).toHaveBeenCalledTimes(1);

    // Let the first call finish so the hook returns to idle.
    await act(async () => {
      resolveDownload!();
      await firstCall;
    });
  });
});
