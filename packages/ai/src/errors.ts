// ═══════════════════════════════════════════════════════════════════════════
// @nearstack-dev/ai Error System
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Error codes for AI-related errors.
 */
export enum AIErrorCode {
  /** Provider is not available (e.g., no WebGPU, Ollama not running) */
  PROVIDER_NOT_AVAILABLE = 'PROVIDER_NOT_AVAILABLE',
  /** Requested model was not found */
  MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
  /** Model is not ready for inference (needs download or loading) */
  MODEL_NOT_READY = 'MODEL_NOT_READY',
  /** Model download failed */
  DOWNLOAD_FAILED = 'DOWNLOAD_FAILED',
  /** Download was cancelled by user */
  DOWNLOAD_CANCELLED = 'DOWNLOAD_CANCELLED',
  /** Inference request failed */
  INFERENCE_FAILED = 'INFERENCE_FAILED',
  /** Request timed out */
  TIMEOUT = 'TIMEOUT',
  /** Request was aborted */
  ABORTED = 'ABORTED',
  /** Network error occurred */
  NETWORK_ERROR = 'NETWORK_ERROR',
  /** Configuration error */
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  /** Provider initialization failed */
  INITIALIZATION_FAILED = 'INITIALIZATION_FAILED',
  /** No providers available */
  NO_PROVIDERS = 'NO_PROVIDERS',
  /** Unknown error */
  UNKNOWN = 'UNKNOWN',
}

/**
 * User-friendly error messages with remediation suggestions.
 */
const ERROR_MESSAGES: Record<AIErrorCode, string> = {
  [AIErrorCode.PROVIDER_NOT_AVAILABLE]:
    'AI provider is not available. For browser inference, ensure your browser supports WebGPU or WebAssembly. For Ollama, ensure the server is running at the configured URL.',
  [AIErrorCode.MODEL_NOT_FOUND]:
    'The requested model was not found. Use ai.models.list() to see available models.',
  [AIErrorCode.MODEL_NOT_READY]:
    'The model is not ready for inference. Download it first with ai.models.download(modelId).',
  [AIErrorCode.DOWNLOAD_FAILED]:
    'Model download failed. Check your network connection and try again.',
  [AIErrorCode.DOWNLOAD_CANCELLED]: 'Model download was cancelled.',
  [AIErrorCode.INFERENCE_FAILED]:
    'Inference request failed. The model may have encountered an error.',
  [AIErrorCode.TIMEOUT]:
    'Request timed out. The server may be overloaded or the model too large.',
  [AIErrorCode.ABORTED]: 'Request was aborted.',
  [AIErrorCode.NETWORK_ERROR]:
    'Network error occurred. Check your connection and try again.',
  [AIErrorCode.CONFIGURATION_ERROR]:
    'Invalid configuration. Check the AIConfig options.',
  [AIErrorCode.INITIALIZATION_FAILED]:
    'Provider initialization failed. Check the provider configuration and dependencies.',
  [AIErrorCode.NO_PROVIDERS]:
    'No AI providers are available. Ensure at least one provider is configured or auto-detection finds an available backend.',
  [AIErrorCode.UNKNOWN]: 'An unexpected error occurred.',
};

/**
 * Custom error class for AI-related errors.
 * Provides structured error information with codes and user-friendly messages.
 */
export class AIError extends Error {
  /** Error code for programmatic handling */
  readonly code: AIErrorCode;
  /** Original error that caused this error (if any) */
  readonly cause?: Error;

  constructor(code: AIErrorCode, message?: string, cause?: Error) {
    const fullMessage = message || ERROR_MESSAGES[code];
    super(fullMessage);
    this.name = 'AIError';
    this.code = code;
    this.cause = cause;

    // Maintains proper stack trace in V8 environments
    const ErrorWithCapture = Error as typeof Error & {
      captureStackTrace?: (target: object, constructor?: Function) => void;
    };
    if (typeof ErrorWithCapture.captureStackTrace === 'function') {
      ErrorWithCapture.captureStackTrace(this, AIError);
    }
  }

  /**
   * Create an AIError from an unknown error.
   */
  static from(error: unknown, code?: AIErrorCode): AIError {
    if (error instanceof AIError) {
      return error;
    }

    if (error instanceof Error) {
      // Check for specific error types
      if (error.name === 'AbortError') {
        return new AIError(AIErrorCode.ABORTED, 'Request was aborted', error);
      }
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        return new AIError(AIErrorCode.NETWORK_ERROR, error.message, error);
      }
      return new AIError(
        code || AIErrorCode.UNKNOWN,
        error.message,
        error
      );
    }

    return new AIError(
      code || AIErrorCode.UNKNOWN,
      String(error)
    );
  }

  /**
   * Check if an error is an AIError with a specific code.
   */
  static isCode(error: unknown, code: AIErrorCode): error is AIError {
    return error instanceof AIError && error.code === code;
  }

  /**
   * Get a user-friendly message for an error code.
   */
  static getMessage(code: AIErrorCode): string {
    return ERROR_MESSAGES[code];
  }
}
