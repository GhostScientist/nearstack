// ═══════════════════════════════════════════════════════════════════════════
// @nearstack-dev/ai - Browser-native local AI inference
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// Main AI Class and Factory
// ─────────────────────────────────────────────────────────────────────────────

export { AI, createAI } from './ai';

// ─────────────────────────────────────────────────────────────────────────────
// Singleton Instance
// ─────────────────────────────────────────────────────────────────────────────

import { AI } from './ai';

/**
 * Default singleton AI instance.
 * Auto-detects available providers and initializes automatically.
 *
 * @example
 * ```typescript
 * import { ai } from '@nearstack-dev/ai';
 *
 * // Wait for initialization
 * await ai.ready();
 *
 * // Simple chat
 * const response = await ai.chat('Hello!');
 * ```
 */
export const ai = new AI();

// ─────────────────────────────────────────────────────────────────────────────
// Providers
// ─────────────────────────────────────────────────────────────────────────────

export { BrowserProvider } from './providers/browser';
export { OllamaProvider } from './providers/ollama';

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────

export { AIError, AIErrorCode } from './errors';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type {
  // Message types
  Message,
  ChatOptions,
  StreamChunk,

  // Model types
  ModelInfo,
  ModelStatus,

  // Provider types
  Provider,
  ProviderType,
  ProviderStatus,
  BrowserProviderInterface,

  // State types
  AIState,
  StateListener,
  Unsubscribe,

  // Configuration types
  AIConfig,
  BrowserProviderConfig,
  OllamaProviderConfig,
  OpenAICompatibleProviderConfig,

  // UI helper types
  ModelChoice,
  ProviderChoice,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Utilities (re-exported for convenience)
// ─────────────────────────────────────────────────────────────────────────────

export { formatBytes, getProviderLabel } from './utils';
