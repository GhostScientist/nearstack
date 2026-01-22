import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OllamaProvider } from '../ollama';
import { AIErrorCode } from '../../errors';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('OllamaProvider', () => {
  let provider: OllamaProvider;

  beforeEach(() => {
    provider = new OllamaProvider();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should use default config', () => {
      expect(provider.id).toBe('ollama');
      expect(provider.type).toBe('ollama');
    });

    it('should accept custom config', () => {
      const customProvider = new OllamaProvider({
        id: 'custom-ollama',
        baseUrl: 'http://192.168.1.100:11434',
        timeout: 60000,
      });

      expect(customProvider.id).toBe('custom-ollama');
    });

    it('should remove trailing slash from baseUrl', () => {
      const providerWithSlash = new OllamaProvider({
        baseUrl: 'http://localhost:11434/',
      });

      // We'll verify this works by checking a fetch call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ models: [] }),
      });

      providerWithSlash.listModels();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/tags',
        expect.anything()
      );
    });
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      await expect(provider.initialize()).resolves.toBeUndefined();
    });
  });

  describe('dispose', () => {
    it('should dispose successfully', async () => {
      await provider.initialize();
      await expect(provider.dispose()).resolves.toBeUndefined();
    });
  });

  describe('isAvailable', () => {
    it('should return true when server is reachable', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      const result = await provider.isAvailable();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/tags',
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('should return false when server is not reachable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await provider.isAvailable();

      expect(result).toBe(false);
    });

    it('should return false when server returns error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await provider.isAvailable();

      expect(result).toBe(false);
    });
  });

  describe('listModels', () => {
    it('should return list of models', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            models: [
              {
                name: 'llama3.2:3b',
                model: 'llama3.2:3b',
                modified_at: '2024-01-01T00:00:00Z',
                size: 2000000000,
                digest: 'abc123',
                details: {
                  quantization_level: 'Q4_0',
                },
              },
              {
                name: 'mistral:7b',
                model: 'mistral:7b',
                modified_at: '2024-01-01T00:00:00Z',
                size: 4000000000,
                digest: 'def456',
              },
            ],
          }),
      });

      const models = await provider.listModels();

      expect(models).toHaveLength(2);
      expect(models[0]).toEqual({
        id: 'llama3.2:3b',
        name: 'llama3.2:3b',
        provider: 'ollama',
        size: 2000000000,
        quantization: 'Q4_0',
        contextLength: 4096,
        status: { state: 'ready' },
      });
    });

    it('should detect context length from model name', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            models: [
              {
                name: 'llama3.2:3b-128k',
                model: 'llama3.2:3b-128k',
                modified_at: '2024-01-01T00:00:00Z',
                size: 2000000000,
                digest: 'abc123',
              },
            ],
          }),
      });

      const models = await provider.listModels();

      expect(models[0].contextLength).toBe(131072);
    });

    it('should throw error when request fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(provider.listModels()).rejects.toMatchObject({
        code: AIErrorCode.NETWORK_ERROR,
      });
    });
  });

  describe('chat', () => {
    it('should throw error when no model specified', async () => {
      await expect(
        provider.chat([{ role: 'user', content: 'Hello' }], {})
      ).rejects.toMatchObject({
        code: AIErrorCode.MODEL_NOT_FOUND,
      });
    });

    it('should send chat request and return response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            model: 'llama3.2:3b',
            message: {
              role: 'assistant',
              content: 'Hello! How can I help you?',
            },
            done: true,
          }),
      });

      const response = await provider.chat(
        [{ role: 'user', content: 'Hello' }],
        { model: 'llama3.2:3b' }
      );

      expect(response).toBe('Hello! How can I help you?');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/chat',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"stream":false'),
        })
      );
    });

    it('should include chat options', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            model: 'llama3.2:3b',
            message: { role: 'assistant', content: 'Response' },
            done: true,
          }),
      });

      await provider.chat([{ role: 'user', content: 'Hello' }], {
        model: 'llama3.2:3b',
        temperature: 0.8,
        maxTokens: 100,
        stopSequences: ['END'],
      });

      const call = mockFetch.mock.calls[0];
      const body = JSON.parse(call[1].body);

      expect(body.options).toEqual({
        temperature: 0.8,
        num_predict: 100,
        stop: ['END'],
      });
    });
  });

  describe('stream', () => {
    it('should throw error when no model specified', async () => {
      const generator = provider.stream([{ role: 'user', content: 'Hello' }], {});

      await expect(generator.next()).rejects.toMatchObject({
        code: AIErrorCode.MODEL_NOT_FOUND,
      });
    });

    it('should stream response chunks', async () => {
      // Create a mock readable stream
      const chunks = [
        '{"model":"llama3.2:3b","message":{"role":"assistant","content":"Hello"},"done":false}\n',
        '{"model":"llama3.2:3b","message":{"role":"assistant","content":"!"},"done":true}\n',
      ];

      let chunkIndex = 0;
      const mockReader = {
        read: vi.fn().mockImplementation(() => {
          if (chunkIndex < chunks.length) {
            const chunk = new TextEncoder().encode(chunks[chunkIndex++]);
            return Promise.resolve({ done: false, value: chunk });
          }
          return Promise.resolve({ done: true, value: undefined });
        }),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => mockReader,
        },
      });

      const generator = provider.stream([{ role: 'user', content: 'Hello' }], {
        model: 'llama3.2:3b',
      });

      const results: { content: string; done: boolean }[] = [];
      for await (const chunk of generator) {
        results.push({ content: chunk.content, done: chunk.done });
      }

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ content: 'Hello', done: false });
      expect(results[1]).toEqual({ content: '!', done: true });
    });

    it('should throw error when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const generator = provider.stream([{ role: 'user', content: 'Hello' }], {
        model: 'llama3.2:3b',
      });

      await expect(generator.next()).rejects.toMatchObject({
        code: AIErrorCode.INFERENCE_FAILED,
      });
    });
  });
});
