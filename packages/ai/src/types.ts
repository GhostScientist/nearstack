// ═══════════════════════════════════════════════════════════════════════════
// @nearstack-dev/ai Type Definitions
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// Message Types (OpenAI-compatible)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A single message in a conversation.
 * Compatible with OpenAI chat completion format.
 */
export interface Message {
  /** The role of the message author */
  role: 'system' | 'user' | 'assistant';
  /** The content of the message */
  content: string;
}

/**
 * Options for chat completion requests.
 */
export interface ChatOptions {
  /** Override the active model for this request */
  model?: string;
  /** Sampling temperature (0-2). Higher = more creative */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Stop sequences to end generation */
  stopSequences?: string[];
  /** AbortController signal for cancellation */
  signal?: AbortSignal;
}

/**
 * A chunk of streamed response data.
 */
export interface StreamChunk {
  /** The generated text content */
  content: string;
  /** Whether this is the final chunk */
  done: boolean;
  /** The model that generated this chunk */
  model: string;
  /** The provider that served this request */
  provider: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Model Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Information about an available model.
 */
export interface ModelInfo {
  /** Unique identifier (e.g., 'llama-3.2-3b-instruct') */
  id: string;
  /** Human-readable name (e.g., 'Llama 3.2 3B Instruct') */
  name: string;
  /** Provider that serves this model */
  provider: string;
  /** Model size in bytes (for download estimation) */
  size: number;
  /** Quantization format (e.g., 'q4f16') */
  quantization?: string;
  /** Maximum context window size */
  contextLength: number;
  /** Current status of this model */
  status: ModelStatus;
}

/**
 * Possible states for a model.
 */
export type ModelStatus =
  | { state: 'available' }
  | { state: 'downloading'; progress: number }
  | { state: 'cached' }
  | { state: 'loading' }
  | { state: 'ready' }
  | { state: 'error'; message: string };

// ─────────────────────────────────────────────────────────────────────────────
// Provider Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Provider type identifiers.
 */
export type ProviderType = 'browser' | 'ollama' | 'openai-compatible';

/**
 * Interface that all providers must implement.
 */
export interface Provider {
  /** Unique identifier for this provider instance */
  readonly id: string;
  /** Type of provider */
  readonly type: ProviderType;

  /** Initialize the provider (called once) */
  initialize(): Promise<void>;
  /** Clean up resources */
  dispose(): Promise<void>;
  /** Check if this provider is currently available */
  isAvailable(): Promise<boolean>;
  /** List all models available from this provider */
  listModels(): Promise<ModelInfo[]>;
  /** Generate a chat completion (non-streaming) */
  chat(messages: Message[], options: ChatOptions): Promise<string>;
  /** Generate a streaming chat completion */
  stream(messages: Message[], options: ChatOptions): AsyncGenerator<StreamChunk>;
}

/**
 * Extended provider interface for browser providers that support model downloads.
 */
export interface BrowserProviderInterface extends Provider {
  /** Download a model to local cache */
  downloadModel(modelId: string, onProgress?: (progress: number) => void): Promise<void>;
  /** Delete a cached model */
  deleteModel(modelId: string): Promise<void>;
  /** Cancel an in-progress download */
  cancelDownload(): void;
}

/**
 * Status information for a provider.
 */
export interface ProviderStatus {
  /** Provider instance ID */
  id: string;
  /** Provider type */
  type: ProviderType;
  /** Whether the provider is currently available */
  available: boolean;
  /** Number of models available from this provider */
  modelCount: number;
  /** Currently active model (if any) */
  activeModel?: string;
  /** Error message (if unavailable) */
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// State Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Complete state snapshot of the AI instance.
 * This is the single source of truth for UI components.
 */
export interface AIState {
  /** Whether the AI instance has finished initializing */
  initialized: boolean;
  /** All registered providers and their status */
  providers: ProviderStatus[];
  /** All available models across all providers */
  models: ModelInfo[];
  /** Currently active model ID (or null if none) */
  activeModel: string | null;
  /** Currently active provider ID (or null if none) */
  activeProvider: string | null;
  /** Current download progress (or null if not downloading) */
  downloading: {
    modelId: string;
    progress: number;
  } | null;
  /** Current error (or null if none) */
  error: string | null;
}

/**
 * Function signature for state change listeners.
 */
export type StateListener = (state: AIState) => void;

/**
 * Function to unsubscribe from state changes.
 */
export type Unsubscribe = () => void;

// ─────────────────────────────────────────────────────────────────────────────
// Configuration Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuration options for creating an AI instance.
 */
export interface AIConfig {
  /**
   * Providers to use, in priority order.
   * First available provider becomes the default.
   * If not specified, auto-detects available providers.
   */
  providers?: Provider[];

  /**
   * Default model to use.
   * If not specified, uses first available model.
   */
  defaultModel?: string;

  /**
   * Whether to automatically initialize on creation.
   * @default true
   */
  autoInitialize?: boolean;

  /**
   * Enable debug logging.
   * @default false
   */
  debug?: boolean;
}

/**
 * Configuration for BrowserProvider.
 */
export interface BrowserProviderConfig {
  /** Custom provider ID */
  id?: string;
  /**
   * Preferred backend.
   * @default 'webgpu' (falls back to 'wasm' automatically)
   */
  backend?: 'webgpu' | 'wasm';
  /**
   * Whether to use Web Worker for inference.
   * @default true
   */
  useWorker?: boolean;
}

/**
 * Configuration for OllamaProvider.
 */
export interface OllamaProviderConfig {
  /** Custom provider ID */
  id?: string;
  /**
   * Ollama server base URL.
   * @default 'http://localhost:11434'
   */
  baseUrl?: string;
  /**
   * Request timeout in milliseconds.
   * @default 30000
   */
  timeout?: number;
}

/**
 * Configuration for OpenAI-compatible providers.
 */
export interface OpenAICompatibleProviderConfig {
  /** Required: Custom provider ID */
  id: string;
  /** Required: Server base URL */
  baseUrl: string;
  /** Optional: API key for authentication */
  apiKey?: string;
  /** Optional: Request timeout in milliseconds */
  timeout?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// UI Helper Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Model data formatted for UI dropdowns/selects.
 */
export interface ModelChoice {
  /** Value to use in form (model ID) */
  value: string;
  /** Display label */
  label: string;
  /** Group/category (provider name) */
  group: string;
  /** Human-readable size (e.g., '2.3 GB') */
  size: string;
  /** Current model status */
  status: ModelStatus;
  /** Whether this option should be disabled */
  disabled: boolean;
  /** Additional description */
  description?: string;
}

/**
 * Provider data formatted for UI.
 */
export interface ProviderChoice {
  /** Value to use in form (provider ID) */
  value: string;
  /** Display label */
  label: string;
  /** Whether this provider is available */
  available: boolean;
  /** Number of models available */
  modelCount: number;
}
