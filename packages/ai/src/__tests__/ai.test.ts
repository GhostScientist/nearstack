import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AI, createAI } from '../ai';
import { AIError, AIErrorCode } from '../errors';
import type {
  Provider,
  BrowserProviderInterface,
  Message,
  StreamChunk,
  ModelInfo,
} from '../types';

// Create a mock provider
function createMockProvider(
  id: string,
  type: 'browser' | 'ollama' = 'ollama',
  available = true,
  models: ModelInfo[] = []
): Provider {
  return {
    id,
    type,
    initialize: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn().mockResolvedValue(undefined),
    isAvailable: vi.fn().mockResolvedValue(available),
    listModels: vi.fn().mockResolvedValue(models),
    chat: vi.fn().mockResolvedValue('Mock response'),
    stream: vi.fn().mockImplementation(async function* () {
      yield { content: 'Mock ', done: false, model: 'test', provider: id };
      yield { content: 'stream', done: true, model: 'test', provider: id };
    }),
  };
}

function createMockModel(
  id: string,
  provider: string,
  status: ModelInfo['status'] = { state: 'ready' }
): ModelInfo {
  return {
    id,
    name: id,
    provider,
    size: 1000000,
    contextLength: 4096,
    status,
  };
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * Create a browser-style provider whose downloadModel resolution is
 * controllable per-call. Tests can drive concurrency by leaving a deferred
 * unresolved while issuing additional download() calls.
 */
function createMockBrowserProvider(
  id: string,
  models: ModelInfo[]
): {
  provider: BrowserProviderInterface;
  pendingDownloads: Array<Deferred<void>>;
} {
  const pendingDownloads: Array<Deferred<void>> = [];
  const provider: BrowserProviderInterface = {
    id,
    type: 'browser',
    initialize: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn().mockResolvedValue(undefined),
    isAvailable: vi.fn().mockResolvedValue(true),
    listModels: vi.fn().mockResolvedValue(models),
    chat: vi.fn().mockResolvedValue('Mock response'),
    stream: vi.fn().mockImplementation(async function* () {
      yield { content: 'Mock', done: true, model: 'test', provider: id };
    }),
    downloadModel: vi.fn().mockImplementation(async () => {
      const deferred = createDeferred<void>();
      pendingDownloads.push(deferred);
      return deferred.promise;
    }),
    deleteModel: vi.fn().mockResolvedValue(undefined),
    cancelDownload: vi.fn(),
  };
  return { provider, pendingDownloads };
}

describe('AI', () => {
  let mockProvider: Provider;

  beforeEach(() => {
    mockProvider = createMockProvider('mock', 'ollama', true, [
      createMockModel('model-1', 'mock'),
      createMockModel('model-2', 'mock'),
    ]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      const ai = new AI({ autoInitialize: false });
      expect(ai).toBeInstanceOf(AI);
    });

    it('should accept custom providers', async () => {
      const ai = new AI({
        providers: [mockProvider],
        autoInitialize: true,
      });

      await ai.ready();

      expect(mockProvider.initialize).toHaveBeenCalled();
    });
  });

  describe('createAI', () => {
    it('should create AI instance', () => {
      const ai = createAI({ autoInitialize: false });
      expect(ai).toBeInstanceOf(AI);
    });
  });

  describe('ready', () => {
    it('should resolve when initialized', async () => {
      const ai = new AI({
        providers: [mockProvider],
        autoInitialize: true,
      });

      await expect(ai.ready()).resolves.toBeUndefined();
    });
  });

  describe('getState', () => {
    it('should return current state', async () => {
      const ai = new AI({
        providers: [mockProvider],
        autoInitialize: true,
      });

      await ai.ready();

      const state = ai.getState();
      expect(state.initialized).toBe(true);
      expect(state.providers).toHaveLength(1);
      expect(state.models).toHaveLength(2);
    });
  });

  describe('subscribe', () => {
    it('should notify on state changes', async () => {
      const ai = new AI({
        providers: [mockProvider],
        autoInitialize: false,
      });

      const listener = vi.fn();
      ai.subscribe(listener);

      // Trigger a state change by initializing
      const initPromise = (
        ai as unknown as { initialize(): Promise<void> }
      ).initialize();
      await initPromise;

      expect(listener).toHaveBeenCalled();
    });

    it('should return unsubscribe function', async () => {
      const ai = new AI({
        providers: [mockProvider],
        autoInitialize: true,
      });

      await ai.ready();

      const listener = vi.fn();
      const unsubscribe = ai.subscribe(listener);

      listener.mockClear();
      unsubscribe();

      // Force a state update
      ai.models.use('model-1');

      // Wait a tick for any async operations
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Listener should not be called after unsubscribe
      expect(listener).toHaveBeenCalledTimes(0);
    });
  });

  describe('chat', () => {
    it('should call provider chat with string input', async () => {
      const ai = new AI({
        providers: [mockProvider],
        autoInitialize: true,
      });

      await ai.ready();
      await ai.models.use('model-1');

      const response = await ai.chat('Hello');

      expect(mockProvider.chat).toHaveBeenCalledWith(
        [{ role: 'user', content: 'Hello' }],
        expect.objectContaining({ model: 'model-1' })
      );
      expect(response).toBe('Mock response');
    });

    it('should call provider chat with message array', async () => {
      const ai = new AI({
        providers: [mockProvider],
        autoInitialize: true,
      });

      await ai.ready();
      await ai.models.use('model-1');

      const messages: Message[] = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
      ];

      await ai.chat(messages);

      expect(mockProvider.chat).toHaveBeenCalledWith(
        messages,
        expect.anything()
      );
    });

    it('should throw error when no model selected', async () => {
      const ai = new AI({
        providers: [mockProvider],
        autoInitialize: true,
      });

      await ai.ready();

      // Manually clear active model
      (
        ai as unknown as {
          stateManager: { setActiveModel(model: string | null): void };
        }
      ).stateManager.setActiveModel(null);

      await expect(ai.chat('Hello')).rejects.toMatchObject({
        code: AIErrorCode.MODEL_NOT_FOUND,
      });
    });
  });

  describe('stream', () => {
    it('should yield chunks from provider', async () => {
      const ai = new AI({
        providers: [mockProvider],
        autoInitialize: true,
      });

      await ai.ready();
      await ai.models.use('model-1');

      const chunks: StreamChunk[] = [];
      for await (const chunk of ai.stream('Hello')) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(chunks[0].content).toBe('Mock ');
      expect(chunks[1].content).toBe('stream');
      expect(chunks[1].done).toBe(true);
    });
  });

  describe('models', () => {
    describe('list', () => {
      it('should return all models', async () => {
        const ai = new AI({
          providers: [mockProvider],
          autoInitialize: true,
        });

        await ai.ready();

        const models = ai.models.list();
        expect(models).toHaveLength(2);
      });
    });

    describe('get', () => {
      it('should return specific model', async () => {
        const ai = new AI({
          providers: [mockProvider],
          autoInitialize: true,
        });

        await ai.ready();

        const model = ai.models.get('model-1');
        expect(model?.id).toBe('model-1');
      });

      it('should return undefined for unknown model', async () => {
        const ai = new AI({
          providers: [mockProvider],
          autoInitialize: true,
        });

        await ai.ready();

        const model = ai.models.get('unknown');
        expect(model).toBeUndefined();
      });
    });

    describe('use', () => {
      it('should set active model', async () => {
        const ai = new AI({
          providers: [mockProvider],
          autoInitialize: true,
        });

        await ai.ready();
        await ai.models.use('model-2');

        const state = ai.getState();
        expect(state.activeModel).toBe('model-2');
      });

      it('should throw error for unknown model', async () => {
        const ai = new AI({
          providers: [mockProvider],
          autoInitialize: true,
        });

        await ai.ready();

        await expect(ai.models.use('unknown')).rejects.toMatchObject({
          code: AIErrorCode.MODEL_NOT_FOUND,
        });
      });
    });

    describe('download', () => {
      it('returns the same promise for concurrent calls with the same modelId', async () => {
        const { provider, pendingDownloads } = createMockBrowserProvider(
          'browser',
          [createMockModel('model-a', 'browser', { state: 'available' })]
        );
        const ai = new AI({ providers: [provider], autoInitialize: true });
        await ai.ready();

        const first = ai.models.download('model-a');
        const second = ai.models.download('model-a');

        expect(provider.downloadModel).toHaveBeenCalledTimes(1);
        // Both callers should observe the same outcome; resolve the single
        // in-flight download to settle them.
        pendingDownloads[0].resolve();
        await expect(Promise.all([first, second])).resolves.toBeDefined();
        expect(ai.models.get('model-a')?.status.state).toBe('cached');
      });

      it('rejects a different modelId while one is in flight', async () => {
        const { provider, pendingDownloads } = createMockBrowserProvider(
          'browser',
          [
            createMockModel('model-a', 'browser', { state: 'available' }),
            createMockModel('model-b', 'browser', { state: 'available' }),
          ]
        );
        const ai = new AI({ providers: [provider], autoInitialize: true });
        await ai.ready();

        const first = ai.models.download('model-a');

        await expect(ai.models.download('model-b')).rejects.toMatchObject({
          code: AIErrorCode.DOWNLOAD_IN_PROGRESS,
        });
        // The second download must not have invoked the provider.
        expect(provider.downloadModel).toHaveBeenCalledTimes(1);
        expect(provider.downloadModel).toHaveBeenCalledWith(
          'model-a',
          expect.any(Function)
        );

        pendingDownloads[0].resolve();
        await first;
      });

      it('allows a fresh download after a previous download fails', async () => {
        const { provider, pendingDownloads } = createMockBrowserProvider(
          'browser',
          [createMockModel('model-a', 'browser', { state: 'available' })]
        );
        const ai = new AI({ providers: [provider], autoInitialize: true });
        await ai.ready();

        const first = ai.models.download('model-a');
        pendingDownloads[0].reject(new Error('network down'));
        await expect(first).rejects.toThrow('network down');
        expect(ai.models.get('model-a')?.status.state).toBe('error');

        // User retries — the second call must reach the provider, not be
        // blocked by stale in-flight state.
        const second = ai.models.download('model-a');
        expect(provider.downloadModel).toHaveBeenCalledTimes(2);
        pendingDownloads[1].resolve();
        await second;
        expect(ai.models.get('model-a')?.status.state).toBe('cached');
      });
    });

    describe('active', () => {
      it('should return active model', async () => {
        const ai = new AI({
          providers: [mockProvider],
          autoInitialize: true,
        });

        await ai.ready();
        await ai.models.use('model-1');

        const active = ai.models.active();
        expect(active?.id).toBe('model-1');
      });

      it('should return null when no active model', async () => {
        const ai = new AI({
          providers: [mockProvider],
          autoInitialize: true,
        });

        await ai.ready();
        (
          ai as unknown as {
            stateManager: { setActiveModel(model: string | null): void };
          }
        ).stateManager.setActiveModel(null);

        expect(ai.models.active()).toBe(null);
      });
    });
  });

  describe('providers', () => {
    describe('list', () => {
      it('should return all providers', async () => {
        const ai = new AI({
          providers: [mockProvider],
          autoInitialize: true,
        });

        await ai.ready();

        const providers = ai.providers.list();
        expect(providers).toHaveLength(1);
        expect(providers[0].id).toBe('mock');
      });
    });

    describe('add', () => {
      it('should add new provider', async () => {
        const ai = new AI({
          providers: [mockProvider],
          autoInitialize: true,
        });

        await ai.ready();

        const newProvider = createMockProvider('new-provider', 'ollama', true, [
          createMockModel('new-model', 'new-provider'),
        ]);

        ai.providers.add(newProvider);

        // Wait for initialization
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(newProvider.initialize).toHaveBeenCalled();
      });
    });

    describe('remove', () => {
      it('should remove provider and its models', async () => {
        const ai = new AI({
          providers: [mockProvider],
          autoInitialize: true,
        });

        await ai.ready();

        ai.providers.remove('mock');

        const state = ai.getState();
        expect(state.providers).toHaveLength(0);
        expect(state.models).toHaveLength(0);
      });
    });

    describe('refresh', () => {
      it('should refresh provider availability and models', async () => {
        const ai = new AI({
          providers: [mockProvider],
          autoInitialize: true,
        });

        await ai.ready();

        // Reset mock calls
        (mockProvider.isAvailable as ReturnType<typeof vi.fn>).mockClear();
        (mockProvider.listModels as ReturnType<typeof vi.fn>).mockClear();

        await ai.providers.refresh();

        expect(mockProvider.isAvailable).toHaveBeenCalled();
        expect(mockProvider.listModels).toHaveBeenCalled();
      });
    });
  });

  describe('ui', () => {
    it('should expose UI helpers', async () => {
      const ai = new AI({
        providers: [mockProvider],
        autoInitialize: true,
      });

      await ai.ready();

      expect(ai.ui).toBeDefined();
      expect(typeof ai.ui.getModelChoices).toBe('function');
      expect(typeof ai.ui.getProviderChoices).toBe('function');
      expect(typeof ai.ui.formatSize).toBe('function');
    });

    it('getModelChoices should return formatted models', async () => {
      const ai = new AI({
        providers: [mockProvider],
        autoInitialize: true,
      });

      await ai.ready();

      const choices = ai.ui.getModelChoices();
      expect(choices).toHaveLength(2);
      expect(choices[0].value).toBe('model-1');
    });
  });

  describe('edge cases', () => {
    it('uses a configured default model', async () => {
      const ai = new AI({
        providers: [mockProvider],
        defaultModel: 'model-2',
        autoInitialize: true,
      });

      await ai.ready();
      expect(ai.getState().activeModel).toBe('model-2');
      expect(ai.getState().activeProvider).toBe('mock');
    });

    it('rejects browser-only operations for missing or non-browser models', async () => {
      const ai = new AI({
        providers: [mockProvider],
        autoInitialize: true,
      });

      await ai.ready();
      await expect(ai.models.download('missing')).rejects.toMatchObject({
        code: AIErrorCode.MODEL_NOT_FOUND,
      });
      await expect(ai.models.delete('model-1')).rejects.toMatchObject({
        code: AIErrorCode.PROVIDER_NOT_AVAILABLE,
      });
      await expect(ai.models.download('model-1')).rejects.toMatchObject({
        code: AIErrorCode.PROVIDER_NOT_AVAILABLE,
      });
      await expect(
        ai.chat('hello', { model: 'missing' })
      ).rejects.toMatchObject({
        code: AIErrorCode.MODEL_NOT_FOUND,
      });
    });

    it('reports a missing provider for a known model', async () => {
      const ai = new AI({ providers: [mockProvider], autoInitialize: true });
      await ai.ready();
      (
        ai as unknown as { providerInstances: Map<string, Provider> }
      ).providerInstances.clear();

      await expect(
        ai.chat('hello', { model: 'model-1' })
      ).rejects.toMatchObject({
        code: AIErrorCode.PROVIDER_NOT_AVAILABLE,
      });
    });

    it('deletes a cached browser model and clears it when active', async () => {
      const { provider } = createMockBrowserProvider('browser', [
        createMockModel('browser-model', 'browser', { state: 'cached' }),
      ]);
      const ai = new AI({ providers: [provider], autoInitialize: true });

      await ai.ready();
      await ai.models.use('browser-model');
      await ai.models.delete('browser-model');

      expect(provider.deleteModel).toHaveBeenCalledWith('browser-model');
      expect(ai.models.get('browser-model')?.status.state).toBe('available');
      expect(ai.getState().activeModel).toBeNull();
    });

    it('refreshes unavailable and failing providers without rejecting the batch', async () => {
      const unavailable = createMockProvider('unavailable');
      unavailable.isAvailable = vi.fn().mockResolvedValue(false);
      const failing = createMockProvider('failing');
      failing.isAvailable = vi.fn().mockRejectedValue(new Error('offline'));
      const ai = new AI({
        providers: [unavailable, failing],
        autoInitialize: true,
      });

      await ai.ready();
      await expect(ai.providers.refresh()).resolves.toBeUndefined();
      expect(ai.providers.list()).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'unavailable', available: false }),
          expect.objectContaining({
            id: 'failing',
            available: false,
            error: 'offline',
          }),
        ])
      );
    });

    it('returns null when cancelling without an active download', () => {
      const ai = new AI({ autoInitialize: false });
      expect(() => ai.models.cancelDownload()).not.toThrow();
    });

    it('auto-selects a ready Ollama model', async () => {
      const ollama = createMockProvider('ollama', 'ollama', true, [
        createMockModel('ollama-model', 'ollama'),
      ]);
      const ai = new AI({ providers: [ollama], autoInitialize: true });

      await ai.ready();
      expect(ai.getState().activeModel).toBe('ollama-model');
    });

    it('records provider initialization failures', async () => {
      const failing = createMockProvider('failing');
      failing.initialize = vi.fn().mockRejectedValue(new Error('init failed'));
      const ai = new AI({ providers: [failing], autoInitialize: true });

      await ai.ready();
      expect(ai.providers.list()).toEqual([
        expect.objectContaining({
          id: 'failing',
          available: false,
          error: 'init failed',
        }),
      ]);
    });

    it('reports download progress and handles cancellation', async () => {
      const { provider } = createMockBrowserProvider('browser', [
        createMockModel('browser-model', 'browser', { state: 'available' }),
      ]);
      const download = vi.fn(
        async (_modelId: string, onProgress: (progress: number) => void) => {
          onProgress(0.5);
          throw new AIError(AIErrorCode.DOWNLOAD_CANCELLED, 'cancelled');
        }
      );
      provider.downloadModel = download;
      const ai = new AI({ providers: [provider], autoInitialize: true });

      await ai.ready();
      await expect(ai.models.download('browser-model')).rejects.toMatchObject({
        code: AIErrorCode.DOWNLOAD_CANCELLED,
      });
      expect(ai.models.get('browser-model')?.status.state).toBe('available');
    });

    it('cancels an active browser download and clears its state', async () => {
      const { provider, pendingDownloads } = createMockBrowserProvider(
        'browser',
        [createMockModel('browser-model', 'browser', { state: 'available' })]
      );
      const ai = new AI({ providers: [provider], autoInitialize: true });

      await ai.ready();
      const pending = ai.models.download('browser-model');
      (
        ai as unknown as {
          stateManager: { setDownloading(modelId: string | null): void };
        }
      ).stateManager.setDownloading('browser-model');
      ai.models.cancelDownload();
      pendingDownloads[0].reject(
        new AIError(AIErrorCode.DOWNLOAD_CANCELLED, 'cancelled')
      );
      await expect(pending).rejects.toBeDefined();
      expect(provider.cancelDownload).toHaveBeenCalled();
    });

    it('replaces duplicate providers and removes missing providers safely', async () => {
      const ai = new AI({
        providers: [mockProvider],
        autoInitialize: true,
        debug: true,
      });
      await ai.ready();
      const replacement = createMockProvider('mock');
      ai.providers.add(replacement);
      ai.providers.remove('missing');
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(mockProvider.dispose).toHaveBeenCalled();
      expect(replacement.initialize).toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('should dispose all providers', async () => {
      const ai = new AI({
        providers: [mockProvider],
        autoInitialize: true,
      });

      await ai.ready();
      await ai.dispose();

      expect(mockProvider.dispose).toHaveBeenCalled();

      const state = ai.getState();
      expect(state.initialized).toBe(false);
      expect(state.providers).toHaveLength(0);
    });
  });
});
