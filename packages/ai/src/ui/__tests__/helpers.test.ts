import { describe, it, expect } from 'vitest';
import { createUIHelpers } from '../helpers';
import type { AIState, ModelInfo, ProviderStatus } from '../../types';

function createMockState(overrides: Partial<AIState> = {}): AIState {
  return {
    initialized: true,
    providers: [],
    models: [],
    activeModel: null,
    activeProvider: null,
    downloading: null,
    error: null,
    ...overrides,
  };
}

describe('createUIHelpers', () => {
  describe('getModelChoices', () => {
    it('should return empty array when no models', () => {
      const state = createMockState();
      const helpers = createUIHelpers(() => state);

      expect(helpers.getModelChoices()).toEqual([]);
    });

    it('should format models for dropdown', () => {
      const providers: ProviderStatus[] = [
        { id: 'browser', type: 'browser', available: true, modelCount: 1 },
      ];

      const models: ModelInfo[] = [
        {
          id: 'llama-3.2-3b',
          name: 'Llama 3.2 3B',
          provider: 'browser',
          size: 2.2 * 1024 * 1024 * 1024, // 2.2 GB
          quantization: 'q4f16',
          contextLength: 8192,
          status: { state: 'ready' },
        },
      ];

      const state = createMockState({ providers, models });
      const helpers = createUIHelpers(() => state);
      const choices = helpers.getModelChoices();

      expect(choices).toHaveLength(1);
      expect(choices[0]).toEqual({
        value: 'llama-3.2-3b',
        label: 'Llama 3.2 3B',
        group: 'Browser (WebLLM)',
        size: '2.20 GB',
        status: { state: 'ready' },
        disabled: false,
        description: 'q4f16',
      });
    });

    it('should disable models that are downloading', () => {
      const models: ModelInfo[] = [
        {
          id: 'model-1',
          name: 'Model 1',
          provider: 'browser',
          size: 1000,
          contextLength: 4096,
          status: { state: 'downloading', progress: 0.5 },
        },
      ];

      const state = createMockState({
        providers: [{ id: 'browser', type: 'browser', available: true, modelCount: 1 }],
        models,
      });
      const helpers = createUIHelpers(() => state);
      const choices = helpers.getModelChoices();

      expect(choices[0].disabled).toBe(true);
      expect(choices[0].description).toBe('Downloading: 50%');
    });

    it('should disable models that are loading', () => {
      const models: ModelInfo[] = [
        {
          id: 'model-1',
          name: 'Model 1',
          provider: 'browser',
          size: 1000,
          contextLength: 4096,
          status: { state: 'loading' },
        },
      ];

      const state = createMockState({
        providers: [{ id: 'browser', type: 'browser', available: true, modelCount: 1 }],
        models,
      });
      const helpers = createUIHelpers(() => state);
      const choices = helpers.getModelChoices();

      expect(choices[0].disabled).toBe(true);
    });

    it('should disable models with errors', () => {
      const models: ModelInfo[] = [
        {
          id: 'model-1',
          name: 'Model 1',
          provider: 'browser',
          size: 1000,
          contextLength: 4096,
          status: { state: 'error', message: 'Download failed' },
        },
      ];

      const state = createMockState({
        providers: [{ id: 'browser', type: 'browser', available: true, modelCount: 1 }],
        models,
      });
      const helpers = createUIHelpers(() => state);
      const choices = helpers.getModelChoices();

      expect(choices[0].disabled).toBe(true);
      expect(choices[0].description).toBe('Download failed');
    });

    it('should sort by group then by name', () => {
      const providers: ProviderStatus[] = [
        { id: 'browser', type: 'browser', available: true, modelCount: 2 },
        { id: 'ollama', type: 'ollama', available: true, modelCount: 2 },
      ];

      const models: ModelInfo[] = [
        {
          id: 'ollama-b',
          name: 'Zmodel',
          provider: 'ollama',
          size: 100,
          contextLength: 4096,
          status: { state: 'ready' },
        },
        {
          id: 'browser-a',
          name: 'Amodel',
          provider: 'browser',
          size: 100,
          contextLength: 4096,
          status: { state: 'ready' },
        },
        {
          id: 'ollama-a',
          name: 'Amodel',
          provider: 'ollama',
          size: 100,
          contextLength: 4096,
          status: { state: 'ready' },
        },
        {
          id: 'browser-b',
          name: 'Bmodel',
          provider: 'browser',
          size: 100,
          contextLength: 4096,
          status: { state: 'ready' },
        },
      ];

      const state = createMockState({ providers, models });
      const helpers = createUIHelpers(() => state);
      const choices = helpers.getModelChoices();

      expect(choices.map((c) => c.value)).toEqual([
        'browser-a',
        'browser-b',
        'ollama-a',
        'ollama-b',
      ]);
    });
  });

  describe('getProviderChoices', () => {
    it('should return empty array when no providers', () => {
      const state = createMockState();
      const helpers = createUIHelpers(() => state);

      expect(helpers.getProviderChoices()).toEqual([]);
    });

    it('should format providers for dropdown', () => {
      const providers: ProviderStatus[] = [
        { id: 'browser', type: 'browser', available: true, modelCount: 5 },
        { id: 'ollama', type: 'ollama', available: false, modelCount: 0 },
      ];

      const state = createMockState({ providers });
      const helpers = createUIHelpers(() => state);
      const choices = helpers.getProviderChoices();

      expect(choices).toHaveLength(2);
      expect(choices[0]).toEqual({
        value: 'browser',
        label: 'Browser (WebLLM)',
        available: true,
        modelCount: 5,
      });
      expect(choices[1]).toEqual({
        value: 'ollama',
        label: 'Ollama',
        available: false,
        modelCount: 0,
      });
    });
  });

  describe('formatSize', () => {
    it('should format bytes correctly', () => {
      const helpers = createUIHelpers(() => createMockState());

      expect(helpers.formatSize(0)).toBe('0 B');
      expect(helpers.formatSize(1024 * 1024)).toBe('1.00 MB');
      expect(helpers.formatSize(2.5 * 1024 * 1024 * 1024)).toBe('2.50 GB');
    });
  });

  describe('getStatusLabel', () => {
    it('should return correct status labels', () => {
      const helpers = createUIHelpers(() => createMockState());

      expect(helpers.getStatusLabel('available')).toBe('Available');
      expect(helpers.getStatusLabel('downloading')).toBe('Downloading');
      expect(helpers.getStatusLabel('cached')).toBe('Downloaded');
      expect(helpers.getStatusLabel('loading')).toBe('Loading');
      expect(helpers.getStatusLabel('ready')).toBe('Ready');
      expect(helpers.getStatusLabel('error')).toBe('Error');
    });
  });
});
