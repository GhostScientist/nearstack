import { describe, it, expect } from 'vitest';
import {
  formatBytes,
  getProviderLabel,
  capitalize,
  getModelStatusLabel,
} from '../format';

describe('formatBytes', () => {
  it('should format 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('should format bytes', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(5)).toBe('5.00 B');
  });

  it('should format kilobytes', () => {
    expect(formatBytes(1024)).toBe('1.00 KB');
    expect(formatBytes(1536)).toBe('1.50 KB');
  });

  it('should format megabytes', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
    expect(formatBytes(240 * 1024 * 1024)).toBe('240 MB');
  });

  it('should format gigabytes', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB');
    expect(formatBytes(2.2 * 1024 * 1024 * 1024)).toBe('2.20 GB');
  });

  it('should use fewer decimal places for larger values', () => {
    expect(formatBytes(10 * 1024 * 1024)).toBe('10.0 MB');
    expect(formatBytes(100 * 1024 * 1024)).toBe('100 MB');
  });
});

describe('getProviderLabel', () => {
  it('should return label for browser provider', () => {
    expect(getProviderLabel('browser')).toBe('Browser (WebLLM)');
  });

  it('should return label for ollama provider', () => {
    expect(getProviderLabel('ollama')).toBe('Ollama');
  });

  it('should return label for openai-compatible provider', () => {
    expect(getProviderLabel('openai-compatible')).toBe('OpenAI Compatible');
  });

  it('should return the type itself for unknown types', () => {
    // @ts-expect-error - testing unknown type
    expect(getProviderLabel('unknown')).toBe('unknown');
  });
});

describe('capitalize', () => {
  it('should capitalize first letter', () => {
    expect(capitalize('hello')).toBe('Hello');
  });

  it('should handle empty string', () => {
    expect(capitalize('')).toBe('');
  });

  it('should handle already capitalized', () => {
    expect(capitalize('Hello')).toBe('Hello');
  });

  it('should only capitalize first letter', () => {
    expect(capitalize('hELLO')).toBe('HELLO');
  });
});

describe('getModelStatusLabel', () => {
  it('should return correct labels', () => {
    expect(getModelStatusLabel('available')).toBe('Available');
    expect(getModelStatusLabel('downloading')).toBe('Downloading');
    expect(getModelStatusLabel('cached')).toBe('Downloaded');
    expect(getModelStatusLabel('loading')).toBe('Loading');
    expect(getModelStatusLabel('ready')).toBe('Ready');
    expect(getModelStatusLabel('error')).toBe('Error');
  });
});
