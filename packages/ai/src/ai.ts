import type {
  AIConfig,
  AIState,
  Provider,
  BrowserProviderInterface,
  ProviderStatus,
  Message,
  ChatOptions,
  StreamChunk,
  ModelInfo,
  StateListener,
  Unsubscribe,
} from './types';
import { AIError, AIErrorCode } from './errors';
import { StateManager } from './state';
import { createUIHelpers, type UIHelpers } from './ui';
import { BrowserProvider } from './providers/browser';
import { OllamaProvider } from './providers/ollama';

/**
 * Normalize input to Message array.
 */
function normalizeInput(input: string | Message[]): Message[] {
  return typeof input === 'string'
    ? [{ role: 'user', content: input }]
    : input;
}

/**
 * Check if a provider supports model downloads.
 */
function isBrowserProvider(
  provider: Provider
): provider is BrowserProviderInterface {
  return 'downloadModel' in provider && typeof provider.downloadModel === 'function';
}

/**
 * Main AI class - the primary interface for @nearstack-dev/ai.
 * Orchestrates providers, state, and inference.
 */
export class AI {
  private stateManager: StateManager;
  private providerInstances: Map<string, Provider> = new Map();
  private initPromise: Promise<void> | null = null;
  private downloadAbortController: AbortController | null = null;
  private debug: boolean;
  private _ui: UIHelpers;

  /**
   * Model management methods.
   */
  readonly models = {
    /**
     * List all available models across all providers.
     */
    list: (): ModelInfo[] => {
      return this.stateManager.getState().models;
    },

    /**
     * Get information about a specific model.
     */
    get: (modelId: string): ModelInfo | undefined => {
      return this.stateManager.getState().models.find((m) => m.id === modelId);
    },

    /**
     * Download a model for browser inference.
     */
    download: async (modelId: string): Promise<void> => {
      const model = this.models.get(modelId);
      if (!model) {
        throw new AIError(
          AIErrorCode.MODEL_NOT_FOUND,
          `Model ${modelId} not found`
        );
      }

      const provider = this.providerInstances.get(model.provider);
      if (!provider || !isBrowserProvider(provider)) {
        throw new AIError(
          AIErrorCode.PROVIDER_NOT_AVAILABLE,
          `Provider ${model.provider} does not support model downloads`
        );
      }

      this.downloadAbortController = new AbortController();

      try {
        await provider.downloadModel(modelId, (progress) => {
          this.stateManager.setDownloading(modelId, progress);
          this.stateManager.updateModelStatus(modelId, {
            state: 'downloading',
            progress,
          });
        });

        this.stateManager.setDownloading(null);
        this.stateManager.updateModelStatus(modelId, { state: 'cached' });
      } catch (error) {
        this.stateManager.setDownloading(null);
        if (error instanceof AIError && error.code === AIErrorCode.DOWNLOAD_CANCELLED) {
          this.stateManager.updateModelStatus(modelId, { state: 'available' });
        } else {
          this.stateManager.updateModelStatus(modelId, {
            state: 'error',
            message: error instanceof Error ? error.message : 'Download failed',
          });
        }
        throw error;
      } finally {
        this.downloadAbortController = null;
      }
    },

    /**
     * Cancel an in-progress download.
     */
    cancelDownload: (): void => {
      const state = this.stateManager.getState();
      if (!state.downloading) return;

      const provider = this.findProviderForModel(state.downloading.modelId);
      if (provider && isBrowserProvider(provider)) {
        provider.cancelDownload();
      }

      this.downloadAbortController?.abort();
      this.stateManager.setDownloading(null);
    },

    /**
     * Delete a cached model.
     */
    delete: async (modelId: string): Promise<void> => {
      const model = this.models.get(modelId);
      if (!model) {
        throw new AIError(
          AIErrorCode.MODEL_NOT_FOUND,
          `Model ${modelId} not found`
        );
      }

      const provider = this.providerInstances.get(model.provider);
      if (!provider || !isBrowserProvider(provider)) {
        throw new AIError(
          AIErrorCode.PROVIDER_NOT_AVAILABLE,
          `Provider ${model.provider} does not support model deletion`
        );
      }

      await provider.deleteModel(modelId);
      this.stateManager.updateModelStatus(modelId, { state: 'available' });

      // Clear active model if it was deleted
      if (this.stateManager.getState().activeModel === modelId) {
        this.stateManager.setActiveModel(null);
      }
    },

    /**
     * Switch the active model.
     */
    use: async (modelId: string): Promise<void> => {
      const model = this.models.get(modelId);
      if (!model) {
        throw new AIError(
          AIErrorCode.MODEL_NOT_FOUND,
          `Model ${modelId} not found`
        );
      }

      // For Ollama, models are always ready
      if (model.status.state !== 'ready' && model.status.state !== 'cached') {
        // Check if it's an Ollama model
        const provider = this.providerInstances.get(model.provider);
        if (provider?.type !== 'ollama') {
          throw new AIError(
            AIErrorCode.MODEL_NOT_READY,
            `Model ${modelId} is not ready. Current state: ${model.status.state}`
          );
        }
      }

      this.stateManager.setActiveModel(modelId);
      this.stateManager.setActiveProvider(model.provider);
    },

    /**
     * Get the currently active model.
     */
    active: (): ModelInfo | null => {
      const state = this.stateManager.getState();
      if (!state.activeModel) return null;
      return this.models.get(state.activeModel) || null;
    },
  };

  /**
   * Provider management methods.
   */
  readonly providers = {
    /**
     * List all registered providers with their status.
     */
    list: (): ProviderStatus[] => {
      return this.stateManager.getState().providers;
    },

    /**
     * Add a provider at runtime.
     */
    add: (provider: Provider): void => {
      if (this.providerInstances.has(provider.id)) {
        this.log(`Provider ${provider.id} already exists, replacing`);
        this.providerInstances.get(provider.id)?.dispose();
      }

      this.providerInstances.set(provider.id, provider);

      // Initialize and refresh provider
      this.initializeProvider(provider).catch((error) => {
        this.log(`Failed to initialize provider ${provider.id}:`, error);
      });
    },

    /**
     * Remove a provider.
     */
    remove: (providerId: string): void => {
      const provider = this.providerInstances.get(providerId);
      if (!provider) return;

      provider.dispose();
      this.providerInstances.delete(providerId);
      this.stateManager.removeProvider(providerId);
    },

    /**
     * Refresh provider availability and model lists.
     */
    refresh: async (): Promise<void> => {
      const refreshPromises = Array.from(this.providerInstances.entries()).map(
        async ([id, provider]) => {
          try {
            const available = await provider.isAvailable();
            if (available) {
              const models = await provider.listModels();
              this.stateManager.addModels(models, id);
              this.stateManager.updateProviderStatus(id, {
                available: true,
                modelCount: models.length,
                error: undefined,
              });
            } else {
              this.stateManager.updateProviderStatus(id, {
                available: false,
                modelCount: 0,
              });
            }
          } catch (error) {
            this.stateManager.updateProviderStatus(id, {
              available: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }
      );

      await Promise.all(refreshPromises);
    },
  };

  /**
   * UI helper methods.
   */
  get ui(): UIHelpers {
    return this._ui;
  }

  constructor(config?: AIConfig) {
    this.debug = config?.debug ?? false;
    this.stateManager = new StateManager();
    this._ui = createUIHelpers(() => this.stateManager.getState());

    // If providers are specified, use them
    if (config?.providers && config.providers.length > 0) {
      for (const provider of config.providers) {
        this.providerInstances.set(provider.id, provider);
      }
    }

    // Auto-initialize unless explicitly disabled
    if (config?.autoInitialize !== false) {
      this.initPromise = this.initialize(config);
    }
  }

  /**
   * Generate a chat completion.
   */
  async chat(
    input: string | Message[],
    options?: ChatOptions
  ): Promise<string> {
    await this.ready();

    const messages = normalizeInput(input);
    const { provider, model } = this.getActiveProviderAndModel(options);

    this.log(`Chat with model ${model} via provider ${provider.id}`);

    return provider.chat(messages, { ...options, model });
  }

  /**
   * Generate a streaming chat completion.
   */
  async *stream(
    input: string | Message[],
    options?: ChatOptions
  ): AsyncGenerator<StreamChunk> {
    await this.ready();

    const messages = normalizeInput(input);
    const { provider, model } = this.getActiveProviderAndModel(options);

    this.log(`Stream with model ${model} via provider ${provider.id}`);

    yield* provider.stream(messages, { ...options, model });
  }

  /**
   * Get the current state snapshot.
   */
  getState(): AIState {
    return this.stateManager.getState();
  }

  /**
   * Subscribe to state changes.
   */
  subscribe(listener: StateListener): Unsubscribe {
    return this.stateManager.subscribe(listener);
  }

  /**
   * Wait until the AI instance is fully initialized.
   */
  async ready(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * Clean up all resources.
   */
  async dispose(): Promise<void> {
    const disposePromises = Array.from(this.providerInstances.values()).map(
      (provider) => provider.dispose()
    );
    await Promise.all(disposePromises);
    this.providerInstances.clear();
    this.stateManager.update({
      initialized: false,
      providers: [],
      models: [],
      activeModel: null,
      activeProvider: null,
    });
  }

  /**
   * Initialize the AI instance.
   */
  private async initialize(config?: AIConfig): Promise<void> {
    this.log('Initializing AI instance');

    try {
      // If no providers specified, auto-detect
      if (this.providerInstances.size === 0) {
        await this.autoDetectProviders();
      }

      // Initialize all providers
      const initPromises = Array.from(this.providerInstances.entries()).map(
        ([id, provider]) => this.initializeProvider(provider)
      );
      await Promise.all(initPromises);

      // Set default model if specified
      if (config?.defaultModel) {
        const model = this.models.get(config.defaultModel);
        if (model) {
          this.stateManager.setActiveModel(config.defaultModel);
          this.stateManager.setActiveProvider(model.provider);
        }
      } else {
        // Auto-select first ready model
        this.autoSelectModel();
      }

      this.stateManager.setInitialized(true);
      this.log('AI instance initialized');
    } catch (error) {
      this.stateManager.setError(
        error instanceof Error ? error.message : 'Initialization failed'
      );
      throw error;
    }
  }

  /**
   * Auto-detect available providers.
   */
  private async autoDetectProviders(): Promise<void> {
    this.log('Auto-detecting providers');

    // Try BrowserProvider first (higher priority for privacy)
    const browserProvider = new BrowserProvider();
    const browserAvailable = await browserProvider.isAvailable();
    if (browserAvailable) {
      this.log('BrowserProvider is available');
      this.providerInstances.set(browserProvider.id, browserProvider);
    }

    // Try OllamaProvider
    const ollamaProvider = new OllamaProvider();
    const ollamaAvailable = await ollamaProvider.isAvailable();
    if (ollamaAvailable) {
      this.log('OllamaProvider is available');
      this.providerInstances.set(ollamaProvider.id, ollamaProvider);
    }

    if (this.providerInstances.size === 0) {
      this.log('No providers available');
      this.stateManager.setError('No AI providers available');
    }
  }

  /**
   * Initialize a single provider.
   */
  private async initializeProvider(provider: Provider): Promise<void> {
    try {
      await provider.initialize();
      const available = await provider.isAvailable();

      this.stateManager.addProvider({
        id: provider.id,
        type: provider.type,
        available,
        modelCount: 0,
      });

      if (available) {
        const models = await provider.listModels();
        this.stateManager.addModels(models, provider.id);
        this.stateManager.updateProviderStatus(provider.id, {
          modelCount: models.length,
        });
      }
    } catch (error) {
      this.stateManager.addProvider({
        id: provider.id,
        type: provider.type,
        available: false,
        modelCount: 0,
        error: error instanceof Error ? error.message : 'Initialization failed',
      });
    }
  }

  /**
   * Auto-select the first ready model.
   * Only selects models that are actually ready to use.
   */
  private autoSelectModel(): void {
    const state = this.stateManager.getState();

    // First, try to find a ready or cached browser model
    const browserModel = state.models.find(
      (m) =>
        m.provider === 'browser' &&
        (m.status.state === 'ready' || m.status.state === 'cached')
    );
    if (browserModel) {
      this.stateManager.setActiveModel(browserModel.id);
      this.stateManager.setActiveProvider(browserModel.provider);
      return;
    }

    // Then try any ready Ollama model (Ollama models are always "ready" when listed)
    const ollamaModel = state.models.find(
      (m) => m.provider === 'ollama'
    );
    if (ollamaModel) {
      this.stateManager.setActiveModel(ollamaModel.id);
      this.stateManager.setActiveProvider(ollamaModel.provider);
      return;
    }

    // No ready models - don't select anything
    // User will need to download a browser model or start Ollama
    this.log('No ready models available for auto-selection');
  }

  /**
   * Get active provider and model for inference.
   */
  private getActiveProviderAndModel(options?: ChatOptions): {
    provider: Provider;
    model: string;
  } {
    const state = this.stateManager.getState();

    // Use model from options or active model
    let modelId = options?.model || state.activeModel;

    if (!modelId) {
      throw new AIError(
        AIErrorCode.MODEL_NOT_FOUND,
        'No model selected. Use ai.models.use(modelId) to select a model.'
      );
    }

    const model = this.models.get(modelId);
    if (!model) {
      throw new AIError(
        AIErrorCode.MODEL_NOT_FOUND,
        `Model ${modelId} not found`
      );
    }

    const provider = this.providerInstances.get(model.provider);
    if (!provider) {
      throw new AIError(
        AIErrorCode.PROVIDER_NOT_AVAILABLE,
        `Provider ${model.provider} not available`
      );
    }

    return { provider, model: modelId };
  }

  /**
   * Find the provider for a given model.
   */
  private findProviderForModel(modelId: string): Provider | undefined {
    const model = this.models.get(modelId);
    if (!model) return undefined;
    return this.providerInstances.get(model.provider);
  }

  /**
   * Debug logging.
   */
  private log(...args: unknown[]): void {
    if (this.debug) {
      console.log('[AI]', ...args);
    }
  }
}

/**
 * Create a new AI instance.
 */
export function createAI(config?: AIConfig): AI {
  return new AI(config);
}
