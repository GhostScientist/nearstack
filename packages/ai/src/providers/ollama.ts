import type {
  Provider,
  OllamaProviderConfig,
  Message,
  ChatOptions,
  StreamChunk,
  ModelInfo,
} from '../types';
import { AIError, AIErrorCode } from '../errors';

/**
 * Default configuration for OllamaProvider.
 */
const DEFAULT_CONFIG: Required<OllamaProviderConfig> = {
  id: 'ollama',
  baseUrl: 'http://localhost:11434',
  timeout: 30000,
};

/**
 * Ollama API response types.
 */
interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    parameter_size?: string;
    quantization_level?: string;
    families?: string[];
  };
}

interface OllamaTagsResponse {
  models: OllamaModel[];
}

interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  done_reason?: string;
}

/**
 * OllamaProvider implements the Provider interface for Ollama server communication.
 * Uses native fetch API for REST communication with the Ollama server.
 */
export class OllamaProvider implements Provider {
  readonly id: string;
  readonly type = 'ollama' as const;

  private baseUrl: string;
  private timeout: number;
  private initialized = false;

  constructor(config?: OllamaProviderConfig) {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    this.id = mergedConfig.id;
    this.baseUrl = mergedConfig.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = mergedConfig.timeout;
  }

  /**
   * Initialize the provider.
   */
  async initialize(): Promise<void> {
    this.initialized = true;
  }

  /**
   * Clean up resources.
   */
  async dispose(): Promise<void> {
    this.initialized = false;
  }

  /**
   * Check if Ollama server is available.
   * Attempts to fetch the models list with a short timeout.
   */
  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout for availability check

      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * List all models available from Ollama.
   */
  async listModels(): Promise<ModelInfo[]> {
    try {
      const response = await this.fetchWithTimeout<OllamaTagsResponse>(
        '/api/tags',
        { method: 'GET' }
      );

      return response.models.map((model) => this.mapOllamaModel(model));
    } catch (error) {
      throw AIError.from(error, AIErrorCode.PROVIDER_NOT_AVAILABLE);
    }
  }

  /**
   * Generate a chat completion (non-streaming).
   */
  async chat(messages: Message[], options: ChatOptions = {}): Promise<string> {
    const model = options.model;
    if (!model) {
      throw new AIError(
        AIErrorCode.MODEL_NOT_FOUND,
        'No model specified for chat'
      );
    }

    try {
      const response = await this.fetchWithTimeout<OllamaChatResponse>(
        '/api/chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            stream: false,
            options: this.mapChatOptions(options),
          }),
          signal: options.signal,
        }
      );

      return response.message.content;
    } catch (error) {
      if (error instanceof AIError) throw error;
      throw AIError.from(error, AIErrorCode.INFERENCE_FAILED);
    }
  }

  /**
   * Generate a streaming chat completion.
   */
  async *stream(
    messages: Message[],
    options: ChatOptions = {}
  ): AsyncGenerator<StreamChunk> {
    const model = options.model;
    if (!model) {
      throw new AIError(
        AIErrorCode.MODEL_NOT_FOUND,
        'No model specified for streaming'
      );
    }

    const controller = new AbortController();
    const signal = options.signal;

    // Link external abort signal to our controller
    if (signal) {
      if (signal.aborted) {
        throw new AIError(AIErrorCode.ABORTED, 'Request was aborted');
      }
      signal.addEventListener('abort', () => controller.abort());
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          stream: true,
          options: this.mapChatOptions(options),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new AIError(
          AIErrorCode.INFERENCE_FAILED,
          `Ollama request failed: ${response.status} ${response.statusText}`
        );
      }

      if (!response.body) {
        throw new AIError(
          AIErrorCode.INFERENCE_FAILED,
          'No response body from Ollama'
        );
      }

      // Parse NDJSON stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const chunk = JSON.parse(line) as OllamaChatResponse;
            yield {
              content: chunk.message.content,
              done: chunk.done,
              model,
              provider: this.id,
            };
          } catch {
            // Skip malformed JSON lines
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        try {
          const chunk = JSON.parse(buffer) as OllamaChatResponse;
          yield {
            content: chunk.message.content,
            done: chunk.done,
            model,
            provider: this.id,
          };
        } catch {
          // Skip malformed JSON
        }
      }
    } catch (error) {
      if (error instanceof AIError) throw error;
      throw AIError.from(error, AIErrorCode.INFERENCE_FAILED);
    }
  }

  /**
   * Fetch with timeout support.
   */
  private async fetchWithTimeout<T>(
    path: string,
    init?: RequestInit
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    // Merge abort signals if one is provided
    const existingSignal = init?.signal;
    if (existingSignal) {
      existingSignal.addEventListener('abort', () => controller.abort());
    }

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new AIError(
          AIErrorCode.NETWORK_ERROR,
          `Request failed: ${response.status} ${response.statusText}`
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof AIError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AIError(AIErrorCode.TIMEOUT, 'Request timed out');
      }
      throw AIError.from(error, AIErrorCode.NETWORK_ERROR);
    }
  }

  /**
   * Map Ollama model to ModelInfo.
   */
  private mapOllamaModel(model: OllamaModel): ModelInfo {
    // Extract context length from model name if available
    // Default to 4096 for most models
    let contextLength = 4096;

    // Check for common context length indicators in model name
    const name = model.name.toLowerCase();
    if (name.includes('128k')) contextLength = 131072;
    else if (name.includes('32k')) contextLength = 32768;
    else if (name.includes('16k')) contextLength = 16384;
    else if (name.includes('8k')) contextLength = 8192;

    return {
      id: model.name,
      name: model.name,
      provider: this.id,
      size: model.size,
      quantization: model.details?.quantization_level,
      contextLength,
      status: { state: 'ready' }, // Ollama models are always ready if listed
    };
  }

  /**
   * Map ChatOptions to Ollama options format.
   */
  private mapChatOptions(
    options: ChatOptions
  ): Record<string, number | string[]> {
    const ollamaOptions: Record<string, number | string[]> = {};

    if (options.temperature !== undefined) {
      ollamaOptions.temperature = options.temperature;
    }
    if (options.maxTokens !== undefined) {
      ollamaOptions.num_predict = options.maxTokens;
    }
    if (options.stopSequences !== undefined) {
      ollamaOptions.stop = options.stopSequences;
    }

    return ollamaOptions;
  }
}
