import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StateManager, createInitialState } from '../manager';
import type { AIState, ProviderStatus, ModelInfo } from '../../types';

describe('StateManager', () => {
  let manager: StateManager;

  beforeEach(() => {
    manager = new StateManager();
  });

  describe('createInitialState', () => {
    it('should return correct initial state', () => {
      const state = createInitialState();
      expect(state).toEqual({
        initialized: false,
        providers: [],
        models: [],
        activeModel: null,
        activeProvider: null,
        downloading: null,
        error: null,
      });
    });
  });

  describe('getState', () => {
    it('should return current state', () => {
      const state = manager.getState();
      expect(state.initialized).toBe(false);
      expect(state.providers).toEqual([]);
    });
  });

  describe('subscribe', () => {
    it('should notify listeners on state change', () => {
      const listener = vi.fn();
      manager.subscribe(listener);

      manager.update({ initialized: true });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ initialized: true })
      );
    });

    it('should return unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = manager.subscribe(listener);

      manager.update({ initialized: true });
      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      manager.update({ initialized: false });
      expect(listener).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    it('should support multiple listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      manager.subscribe(listener1);
      manager.subscribe(listener2);

      manager.update({ initialized: true });

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should catch and log listener errors', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const badListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const goodListener = vi.fn();

      manager.subscribe(badListener);
      manager.subscribe(goodListener);

      manager.update({ initialized: true });

      expect(badListener).toHaveBeenCalledTimes(1);
      expect(goodListener).toHaveBeenCalledTimes(1); // Should still be called
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('update', () => {
    it('should merge partial updates immutably', () => {
      const originalState = manager.getState();

      manager.update({ initialized: true });

      const newState = manager.getState();
      expect(newState).not.toBe(originalState);
      expect(newState.initialized).toBe(true);
      expect(newState.providers).toEqual(originalState.providers);
    });

    it('should update multiple properties', () => {
      manager.update({
        initialized: true,
        error: 'Test error',
      });

      const state = manager.getState();
      expect(state.initialized).toBe(true);
      expect(state.error).toBe('Test error');
    });
  });

  describe('updateModelStatus', () => {
    it('should update specific model status', () => {
      const models: ModelInfo[] = [
        {
          id: 'model-1',
          name: 'Model 1',
          provider: 'test',
          size: 100,
          contextLength: 4096,
          status: { state: 'available' },
        },
        {
          id: 'model-2',
          name: 'Model 2',
          provider: 'test',
          size: 200,
          contextLength: 4096,
          status: { state: 'available' },
        },
      ];

      manager.update({ models });
      manager.updateModelStatus('model-1', { state: 'downloading', progress: 0.5 });

      const state = manager.getState();
      expect(state.models[0].status).toEqual({ state: 'downloading', progress: 0.5 });
      expect(state.models[1].status).toEqual({ state: 'available' });
    });
  });

  describe('updateProviderStatus', () => {
    it('should update specific provider status', () => {
      const providers: ProviderStatus[] = [
        { id: 'provider-1', type: 'browser', available: false, modelCount: 0 },
        { id: 'provider-2', type: 'ollama', available: true, modelCount: 5 },
      ];

      manager.update({ providers });
      manager.updateProviderStatus('provider-1', { available: true, modelCount: 3 });

      const state = manager.getState();
      expect(state.providers[0]).toEqual({
        id: 'provider-1',
        type: 'browser',
        available: true,
        modelCount: 3,
      });
    });
  });

  describe('addProvider', () => {
    it('should add new provider', () => {
      const provider: ProviderStatus = {
        id: 'new-provider',
        type: 'browser',
        available: true,
        modelCount: 2,
      };

      manager.addProvider(provider);

      const state = manager.getState();
      expect(state.providers).toHaveLength(1);
      expect(state.providers[0]).toEqual(provider);
    });

    it('should update existing provider if already exists', () => {
      const provider: ProviderStatus = {
        id: 'provider-1',
        type: 'browser',
        available: false,
        modelCount: 0,
      };

      manager.addProvider(provider);
      manager.addProvider({ ...provider, available: true, modelCount: 5 });

      const state = manager.getState();
      expect(state.providers).toHaveLength(1);
      expect(state.providers[0].available).toBe(true);
      expect(state.providers[0].modelCount).toBe(5);
    });
  });

  describe('removeProvider', () => {
    it('should remove provider and its models', () => {
      manager.update({
        providers: [
          { id: 'keep', type: 'browser', available: true, modelCount: 1 },
          { id: 'remove', type: 'ollama', available: true, modelCount: 2 },
        ],
        models: [
          {
            id: 'model-keep',
            name: 'Keep',
            provider: 'keep',
            size: 100,
            contextLength: 4096,
            status: { state: 'ready' },
          },
          {
            id: 'model-remove',
            name: 'Remove',
            provider: 'remove',
            size: 100,
            contextLength: 4096,
            status: { state: 'ready' },
          },
        ],
      });

      manager.removeProvider('remove');

      const state = manager.getState();
      expect(state.providers).toHaveLength(1);
      expect(state.providers[0].id).toBe('keep');
      expect(state.models).toHaveLength(1);
      expect(state.models[0].id).toBe('model-keep');
    });

    it('should reset active provider if removed', () => {
      manager.update({
        providers: [
          { id: 'provider-1', type: 'browser', available: true, modelCount: 1 },
        ],
        activeProvider: 'provider-1',
        activeModel: 'model-1',
      });

      manager.removeProvider('provider-1');

      const state = manager.getState();
      expect(state.activeProvider).toBe(null);
      expect(state.activeModel).toBe(null);
    });
  });

  describe('setModels', () => {
    it('should replace all models', () => {
      manager.update({
        models: [
          {
            id: 'old-model',
            name: 'Old',
            provider: 'test',
            size: 100,
            contextLength: 4096,
            status: { state: 'ready' },
          },
        ],
      });

      const newModels: ModelInfo[] = [
        {
          id: 'new-model',
          name: 'New',
          provider: 'test',
          size: 200,
          contextLength: 8192,
          status: { state: 'available' },
        },
      ];

      manager.setModels(newModels);

      const state = manager.getState();
      expect(state.models).toHaveLength(1);
      expect(state.models[0].id).toBe('new-model');
    });
  });

  describe('addModels', () => {
    it('should add models for a provider, replacing existing ones from same provider', () => {
      manager.update({
        models: [
          {
            id: 'other-provider-model',
            name: 'Other',
            provider: 'other',
            size: 100,
            contextLength: 4096,
            status: { state: 'ready' },
          },
          {
            id: 'test-provider-old',
            name: 'Old',
            provider: 'test',
            size: 100,
            contextLength: 4096,
            status: { state: 'ready' },
          },
        ],
      });

      const newModels: ModelInfo[] = [
        {
          id: 'test-provider-new',
          name: 'New',
          provider: 'test',
          size: 200,
          contextLength: 8192,
          status: { state: 'available' },
        },
      ];

      manager.addModels(newModels, 'test');

      const state = manager.getState();
      expect(state.models).toHaveLength(2);
      expect(state.models.find((m) => m.id === 'other-provider-model')).toBeDefined();
      expect(state.models.find((m) => m.id === 'test-provider-new')).toBeDefined();
      expect(state.models.find((m) => m.id === 'test-provider-old')).toBeUndefined();
    });
  });

  describe('setDownloading', () => {
    it('should set downloading state', () => {
      manager.setDownloading('model-1', 0.5);

      const state = manager.getState();
      expect(state.downloading).toEqual({
        modelId: 'model-1',
        progress: 0.5,
      });
    });

    it('should clear downloading state when null', () => {
      manager.setDownloading('model-1', 0.5);
      manager.setDownloading(null);

      const state = manager.getState();
      expect(state.downloading).toBe(null);
    });
  });

  describe('setError', () => {
    it('should set error state', () => {
      manager.setError('Test error');

      const state = manager.getState();
      expect(state.error).toBe('Test error');
    });

    it('should clear error when null', () => {
      manager.setError('Test error');
      manager.setError(null);

      const state = manager.getState();
      expect(state.error).toBe(null);
    });
  });

  describe('setInitialized', () => {
    it('should set initialized state', () => {
      manager.setInitialized(true);

      const state = manager.getState();
      expect(state.initialized).toBe(true);
    });
  });

  describe('setActiveModel', () => {
    it('should set active model', () => {
      manager.setActiveModel('model-1');

      const state = manager.getState();
      expect(state.activeModel).toBe('model-1');
    });
  });

  describe('setActiveProvider', () => {
    it('should set active provider', () => {
      manager.setActiveProvider('provider-1');

      const state = manager.getState();
      expect(state.activeProvider).toBe('provider-1');
    });
  });
});
