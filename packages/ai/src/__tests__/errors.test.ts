import { describe, it, expect } from 'vitest';
import { AIError, AIErrorCode } from '../errors';

describe('AIError', () => {
  describe('constructor', () => {
    it('should create error with code and default message', () => {
      const error = new AIError(AIErrorCode.MODEL_NOT_FOUND);

      expect(error.name).toBe('AIError');
      expect(error.code).toBe(AIErrorCode.MODEL_NOT_FOUND);
      expect(error.message).toBe(
        'The requested model was not found. Use ai.models.list() to see available models.'
      );
    });

    it('should create error with custom message', () => {
      const error = new AIError(
        AIErrorCode.MODEL_NOT_FOUND,
        'Custom error message'
      );

      expect(error.message).toBe('Custom error message');
    });

    it('should include cause error', () => {
      const cause = new Error('Original error');
      const error = new AIError(
        AIErrorCode.NETWORK_ERROR,
        'Network failed',
        cause
      );

      expect(error.cause).toBe(cause);
    });
  });

  describe('from', () => {
    it('should return same AIError if already an AIError', () => {
      const original = new AIError(AIErrorCode.TIMEOUT, 'Timeout');
      const result = AIError.from(original);

      expect(result).toBe(original);
    });

    it('should convert regular Error to AIError', () => {
      const original = new Error('Some error');
      const result = AIError.from(original);

      expect(result).toBeInstanceOf(AIError);
      expect(result.code).toBe(AIErrorCode.UNKNOWN);
      expect(result.message).toBe('Some error');
      expect(result.cause).toBe(original);
    });

    it('should detect AbortError', () => {
      const abortError = new Error('AbortError');
      abortError.name = 'AbortError';
      const result = AIError.from(abortError);

      expect(result.code).toBe(AIErrorCode.ABORTED);
    });

    it('should detect fetch TypeError', () => {
      const fetchError = new TypeError('Failed to fetch');
      const result = AIError.from(fetchError);

      expect(result.code).toBe(AIErrorCode.NETWORK_ERROR);
    });

    it('should use provided code', () => {
      const original = new Error('Some error');
      const result = AIError.from(original, AIErrorCode.INFERENCE_FAILED);

      expect(result.code).toBe(AIErrorCode.INFERENCE_FAILED);
    });

    it('should convert non-Error to AIError', () => {
      const result = AIError.from('String error');

      expect(result).toBeInstanceOf(AIError);
      expect(result.code).toBe(AIErrorCode.UNKNOWN);
      expect(result.message).toBe('String error');
    });
  });

  describe('isCode', () => {
    it('should return true for matching AIError', () => {
      const error = new AIError(AIErrorCode.TIMEOUT);

      expect(AIError.isCode(error, AIErrorCode.TIMEOUT)).toBe(true);
    });

    it('should return false for non-matching code', () => {
      const error = new AIError(AIErrorCode.TIMEOUT);

      expect(AIError.isCode(error, AIErrorCode.ABORTED)).toBe(false);
    });

    it('should return false for non-AIError', () => {
      const error = new Error('Regular error');

      expect(AIError.isCode(error, AIErrorCode.UNKNOWN)).toBe(false);
    });

    it('should return false for non-error', () => {
      expect(AIError.isCode('not an error', AIErrorCode.UNKNOWN)).toBe(false);
    });
  });

  describe('getMessage', () => {
    it('should return message for error code', () => {
      expect(AIError.getMessage(AIErrorCode.NO_PROVIDERS)).toBe(
        'No AI providers are available. Ensure at least one provider is configured or auto-detection finds an available backend.'
      );
    });
  });
});

describe('AIErrorCode', () => {
  it('should have all expected codes', () => {
    expect(AIErrorCode.PROVIDER_NOT_AVAILABLE).toBe('PROVIDER_NOT_AVAILABLE');
    expect(AIErrorCode.MODEL_NOT_FOUND).toBe('MODEL_NOT_FOUND');
    expect(AIErrorCode.MODEL_NOT_READY).toBe('MODEL_NOT_READY');
    expect(AIErrorCode.DOWNLOAD_FAILED).toBe('DOWNLOAD_FAILED');
    expect(AIErrorCode.DOWNLOAD_CANCELLED).toBe('DOWNLOAD_CANCELLED');
    expect(AIErrorCode.INFERENCE_FAILED).toBe('INFERENCE_FAILED');
    expect(AIErrorCode.TIMEOUT).toBe('TIMEOUT');
    expect(AIErrorCode.ABORTED).toBe('ABORTED');
    expect(AIErrorCode.NETWORK_ERROR).toBe('NETWORK_ERROR');
    expect(AIErrorCode.CONFIGURATION_ERROR).toBe('CONFIGURATION_ERROR');
    expect(AIErrorCode.INITIALIZATION_FAILED).toBe('INITIALIZATION_FAILED');
    expect(AIErrorCode.NO_PROVIDERS).toBe('NO_PROVIDERS');
    expect(AIErrorCode.UNKNOWN).toBe('UNKNOWN');
  });
});
