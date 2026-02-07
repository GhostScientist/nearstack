import type {
  BrowserProviderInterface,
  BrowserProviderConfig,
  Message,
  ChatOptions,
  StreamChunk,
  ModelInfo,
  ModelStatus
} from "../types";
import { AIError, AIErrorCode } from "../errors";

/**
 * Default configuration for BrowserProvider.
 */
const DEFAULT_CONFIG: Required<BrowserProviderConfig> = {
  id: "browser",
  backend: "webgpu",
  useWorker: true
};

/**
 * Curated list of browser models with their sizes.
 * These are tested and known to work well with WebLLM.
 */
const CURATED_MODELS: {
  id: string;
  name: string;
  size: number;
  quantization: string;
  contextLength: number;
}[] = [
  {
    id: "SmolLM2-360M-Instruct-q4f16_1-MLC",
    name: "SmolLM2 360M Instruct",
    size: 240 * 1024 * 1024, // 240 MB
    quantization: "q4f16",
    contextLength: 8192
  },
  {
    id: "SmolLM2-1.7B-Instruct-q4f16_1-MLC",
    name: "SmolLM2 1.7B Instruct",
    size: 1.1 * 1024 * 1024 * 1024, // 1.1 GB
    quantization: "q4f16",
    contextLength: 8192
  },
  {
    id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    name: "Llama 3.2 1B Instruct",
    size: 880 * 1024 * 1024, // 880 MB
    quantization: "q4f16",
    contextLength: 8192
  },
  {
    id: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    name: "Llama 3.2 3B Instruct",
    size: 2.2 * 1024 * 1024 * 1024, // 2.2 GB
    quantization: "q4f16",
    contextLength: 8192
  },
  {
    id: "Phi-3.5-mini-instruct-q4f16_1-MLC",
    name: "Phi 3.5 Mini Instruct",
    size: 2.4 * 1024 * 1024 * 1024, // 2.4 GB
    quantization: "q4f16",
    contextLength: 8192
  },
  {
    id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    name: "Qwen 2.5 1.5B Instruct",
    size: 1.1 * 1024 * 1024 * 1024, // 1.1 GB
    quantization: "q4f16",
    contextLength: 8192
  },
  {
    id: "gemma-2-2b-it-q4f16_1-MLC",
    name: "Gemma 2 2B Instruct",
    size: 1.5 * 1024 * 1024 * 1024, // 1.5 GB
    quantization: "q4f16",
    contextLength: 8192
  }
];

// Type for WebLLM engine (we'll use any to avoid direct dependency)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MLCEngine = any;

const CACHED_MODELS_KEY = "nearstack-ai:cached-models";

/**
 * BrowserProvider implements browser-based inference using WebLLM.
 * Uses dynamic imports to keep WebLLM out of the main bundle.
 */
export class BrowserProvider implements BrowserProviderInterface {
  readonly id: string;
  readonly type = "browser" as const;

  private backend: "webgpu" | "wasm";
  private engine: MLCEngine | null = null;
  private currentModelId: string | null = null;
  private modelStatuses = new Map<string, ModelStatus>();
  private downloadAbortController: AbortController | null = null;

  constructor(config?: BrowserProviderConfig) {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    this.id = mergedConfig.id;
    this.backend = mergedConfig.backend;

    // Initialize all models as 'available'
    for (const model of CURATED_MODELS) {
      this.modelStatuses.set(model.id, { state: "available" });
    }
  }

  /**
   * Initialize the provider.
   */
  async initialize(): Promise<void> {
    // Check for cached models and update their status
    await this.checkCachedModels();
  }

  /**
   * Clean up resources.
   */
  async dispose(): Promise<void> {
    if (this.engine) {
      try {
        await this.engine.unload();
      } catch {
        // Ignore errors during cleanup
      }
      this.engine = null;
      this.currentModelId = null;
    }
  }

  /**
   * Check if browser supports WebGPU or WebAssembly.
   */
  async isAvailable(): Promise<boolean> {
    // Check for WebGPU support
    if (this.backend === "webgpu") {
      if (typeof navigator !== "undefined" && "gpu" in navigator) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const gpu = (navigator as any).gpu;
          const adapter = await gpu.requestAdapter();
          if (adapter) return true;
        } catch {
          // WebGPU not available, fall through to WASM check
        }
      }
    }

    // Check for WebAssembly support
    if (typeof WebAssembly !== "undefined") {
      return true;
    }

    return false;
  }

  /**
   * List all available browser models.
   */
  async listModels(): Promise<ModelInfo[]> {
    return CURATED_MODELS.map((model) => ({
      id: model.id,
      name: model.name,
      provider: this.id,
      size: model.size,
      quantization: model.quantization,
      contextLength: model.contextLength,
      status: this.modelStatuses.get(model.id) || { state: "available" }
    }));
  }

  /**
   * Download a model to local cache.
   */
  async downloadModel(modelId: string, onProgress?: (progress: number) => void): Promise<void> {
    const model = CURATED_MODELS.find((m) => m.id === modelId);
    if (!model) {
      throw new AIError(AIErrorCode.MODEL_NOT_FOUND, `Model ${modelId} not found in curated list`);
    }

    this.downloadAbortController = new AbortController();

    try {
      this.modelStatuses.set(modelId, { state: "downloading", progress: 0 });

      const webllm = await this.loadWebLLM();

      // Use WebLLM's download functionality
      const engine = await webllm.CreateMLCEngine(modelId, {
        initProgressCallback: (report: { progress: number; text: string }) => {
          const progress = report.progress;
          this.modelStatuses.set(modelId, { state: "downloading", progress });
          onProgress?.(progress);
        }
      });

      // Unload immediately after download (we just wanted to cache it)
      await engine.unload();

      this.modelStatuses.set(modelId, { state: "cached" });
      this.persistCachedModel(modelId);
    } catch (error) {
      if (this.downloadAbortController?.signal.aborted) {
        this.modelStatuses.set(modelId, { state: "available" });
        throw new AIError(AIErrorCode.DOWNLOAD_CANCELLED, "Download cancelled");
      }

      this.modelStatuses.set(modelId, {
        state: "error",
        message: error instanceof Error ? error.message : "Download failed"
      });
      throw AIError.from(error, AIErrorCode.DOWNLOAD_FAILED);
    } finally {
      this.downloadAbortController = null;
    }
  }

  /**
   * Delete a cached model.
   */
  async deleteModel(modelId: string): Promise<void> {
    const model = CURATED_MODELS.find((m) => m.id === modelId);
    if (!model) {
      throw new AIError(AIErrorCode.MODEL_NOT_FOUND, `Model ${modelId} not found`);
    }

    // If this is the current model, unload it
    if (this.currentModelId === modelId && this.engine) {
      await this.engine.unload();
      this.engine = null;
      this.currentModelId = null;
    }

    // Clear from cache using the cache API
    try {
      const caches = await window.caches.keys();
      for (const cacheName of caches) {
        if (cacheName.includes(modelId) || cacheName.includes("webllm")) {
          await window.caches.delete(cacheName);
        }
      }
    } catch {
      // Cache deletion may fail in some environments, ignore
    }

    this.modelStatuses.set(modelId, { state: "available" });
    this.removeCachedModel(modelId);
  }

  /**
   * Cancel an in-progress download.
   */
  cancelDownload(): void {
    if (this.downloadAbortController) {
      this.downloadAbortController.abort();
    }
  }

  /**
   * Generate a chat completion (non-streaming).
   */
  async chat(messages: Message[], options: ChatOptions = {}): Promise<string> {
    const modelId = options.model;
    if (!modelId) {
      throw new AIError(AIErrorCode.MODEL_NOT_FOUND, "No model specified for chat");
    }

    await this.ensureModelLoaded(modelId);

    try {
      const response = await this.engine.chat.completions.create({
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content
        })),
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        stop: options.stopSequences,
        stream: false
      });

      return response.choices[0]?.message?.content || "";
    } catch (error) {
      throw AIError.from(error, AIErrorCode.INFERENCE_FAILED);
    }
  }

  /**
   * Generate a streaming chat completion.
   */
  async *stream(messages: Message[], options: ChatOptions = {}): AsyncGenerator<StreamChunk> {
    const modelId = options.model;
    if (!modelId) {
      throw new AIError(AIErrorCode.MODEL_NOT_FOUND, "No model specified for streaming");
    }

    await this.ensureModelLoaded(modelId);

    try {
      const stream = await this.engine.chat.completions.create({
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content
        })),
        temperature: options.temperature,
        max_tokens: options.maxTokens,
        stop: options.stopSequences,
        stream: true
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        const done = chunk.choices[0]?.finish_reason !== null;

        yield {
          content,
          done,
          model: modelId,
          provider: this.id
        };

        // Check for abort signal
        if (options.signal?.aborted) {
          throw new AIError(AIErrorCode.ABORTED, "Request was aborted");
        }
      }
    } catch (error) {
      if (error instanceof AIError) throw error;
      throw AIError.from(error, AIErrorCode.INFERENCE_FAILED);
    }
  }

  /**
   * Ensure a model is loaded and ready.
   */
  private async ensureModelLoaded(modelId: string): Promise<void> {
    if (this.currentModelId === modelId && this.engine) {
      return;
    }

    const status = this.modelStatuses.get(modelId);
    if (!status) {
      throw new AIError(AIErrorCode.MODEL_NOT_FOUND, `Model ${modelId} not found`);
    }

    // Unload current model if different
    if (this.engine && this.currentModelId !== modelId) {
      await this.engine.unload();
      this.engine = null;
      if (this.currentModelId) {
        // Mark previous model as cached
        this.modelStatuses.set(this.currentModelId, { state: "cached" });
      }
    }

    this.modelStatuses.set(modelId, { state: "loading" });

    try {
      const webllm = await this.loadWebLLM();

      this.engine = await webllm.CreateMLCEngine(modelId, {
        initProgressCallback: (report: { progress: number; text: string }) => {
          // Update status during loading
          if (report.progress < 1) {
            this.modelStatuses.set(modelId, {
              state: "loading"
            });
          }
        }
      });

      this.currentModelId = modelId;
      this.modelStatuses.set(modelId, { state: "ready" });
    } catch (error) {
      this.modelStatuses.set(modelId, {
        state: "error",
        message: error instanceof Error ? error.message : "Failed to load model"
      });
      throw AIError.from(error, AIErrorCode.INITIALIZATION_FAILED);
    }
  }

  /**
   * Check for cached models using localStorage.
   * Validates against actual browser cache and evicts stale entries.
   */
  private async checkCachedModels(): Promise<void> {
    const storedIds = this.loadCachedModelIds();
    const validIds: string[] = [];

    for (const id of storedIds) {
      if (this.modelStatuses.has(id)) {
        // Verify the model actually exists in browser cache
        const isActuallyCached = await this.isModelInCache(id);
        if (isActuallyCached) {
          this.modelStatuses.set(id, { state: "cached" });
          validIds.push(id);
        }
        // If not in cache, don't add to validIds (will be evicted)
      }
    }

    // Update localStorage to only include models that are actually cached
    // Compare sets to detect any difference in model IDs
    const storedIdSet = new Set(storedIds);
    const validIdSet = new Set(validIds);
    const hasChanges = storedIdSet.size !== validIdSet.size || 
                       [...storedIdSet].some(id => !validIdSet.has(id));
    
    if (hasChanges) {
      this.syncCachedModelIds(validIds);
    }
  }

  private loadCachedModelIds(): string[] {
    try {
      const raw = localStorage.getItem(CACHED_MODELS_KEY);
      if (raw === null) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((v): v is string => typeof v === "string");
    } catch {
      return [];
    }
  }

  private persistCachedModel(modelId: string): void {
    const ids = new Set(this.loadCachedModelIds());
    ids.add(modelId);
    try {
      localStorage.setItem(CACHED_MODELS_KEY, JSON.stringify([...ids]));
    } catch {
      // localStorage may be full or unavailable
    }
  }

  private removeCachedModel(modelId: string): void {
    const ids = new Set(this.loadCachedModelIds());
    ids.delete(modelId);
    try {
      localStorage.setItem(CACHED_MODELS_KEY, JSON.stringify([...ids]));
    } catch {
      // localStorage may be full or unavailable
    }
  }

  /**
   * Verify if a model exists in the browser cache.
   * WebLLM stores models in the browser's Cache API with cache names
   * that include "webllm" and potentially the model ID.
   */
  private async isModelInCache(modelId: string): Promise<boolean> {
    try {
      const cacheNames = await window.caches.keys();
      
      // Check if any cache name contains indicators of this model
      // WebLLM uses cache names like "webllm/model" or similar patterns
      // Use word boundaries or path separators to avoid false positives
      const modelIdPattern = new RegExp(`[/\\-_]${modelId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[/\\-_]|^${modelId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
      const hasModelCache = cacheNames.some(
        (name) => name.includes("webllm") && modelIdPattern.test(name)
      );
      
      if (hasModelCache) {
        return true;
      }

      // Also check the main webllm cache for this model's files
      // Check caches in order of likelihood to enable early termination
      const webllmCaches = cacheNames.filter((name) => name.includes("webllm"));
      
      for (const cacheName of webllmCaches) {
        const cache = await window.caches.open(cacheName);
        const requests = await cache.keys();
        
        // Check if any cached request URL contains this model ID with proper boundaries
        // WebLLM typically stores model files with paths containing the model ID
        const hasModelFiles = requests.some((req) => {
          const url = req.url;
          // Look for the model ID in path segments to avoid false positives
          return url.includes(`/${modelId}/`) || url.includes(`/${modelId}-`) || url.endsWith(`/${modelId}`);
        });
        
        if (hasModelFiles) {
          return true;
        }
      }
      
      return false;
    } catch {
      // If we can't access the cache API, assume not cached
      return false;
    }
  }

  /**
   * Sync localStorage with the provided list of valid cached model IDs.
   */
  private syncCachedModelIds(ids: string[]): void {
    try {
      localStorage.setItem(CACHED_MODELS_KEY, JSON.stringify(ids));
    } catch {
      // localStorage may be full or unavailable
    }
  }

  /**
   * Dynamically load WebLLM to keep it out of the main bundle.
   */
  private async loadWebLLM(): Promise<{
    CreateMLCEngine: (
      modelId: string,
      options?: {
        initProgressCallback?: (report: { progress: number; text: string }) => void;
      }
    ) => Promise<MLCEngine>;
  }> {
    try {
      // Dynamic import - keeps WebLLM out of main bundle
      const webllm = await import("@mlc-ai/web-llm");
      return webllm;
    } catch (error) {
      throw new AIError(
        AIErrorCode.INITIALIZATION_FAILED,
        "@mlc-ai/web-llm is not installed. Install it with: npm add @mlc-ai/web-llm",
        error instanceof Error ? error : undefined
      );
    }
  }
}