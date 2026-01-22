import type {
  AIState,
  StateListener,
  Unsubscribe,
  ProviderStatus,
  ModelInfo,
  ModelStatus,
} from '../types';

/**
 * Initial state for the AI instance.
 */
export function createInitialState(): AIState {
  return {
    initialized: false,
    providers: [],
    models: [],
    activeModel: null,
    activeProvider: null,
    downloading: null,
    error: null,
  };
}

/**
 * StateManager handles observable state for the AI instance.
 * Provides immutable state updates and synchronous listener notification.
 */
export class StateManager {
  private state: AIState;
  private listeners: Set<StateListener> = new Set();

  constructor(initialState?: Partial<AIState>) {
    this.state = { ...createInitialState(), ...initialState };
  }

  /**
   * Get the current state snapshot.
   */
  getState(): AIState {
    return this.state;
  }

  /**
   * Subscribe to state changes.
   * @param listener - Function called on each state change
   * @returns Unsubscribe function
   */
  subscribe(listener: StateListener): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Update state with partial updates (immutable).
   * @param updates - Partial state to merge
   */
  update(updates: Partial<AIState>): void {
    this.state = { ...this.state, ...updates };
    this.notifyListeners();
  }

  /**
   * Update a specific model's status.
   * @param modelId - The model to update
   * @param status - New status for the model
   */
  updateModelStatus(modelId: string, status: ModelStatus): void {
    const models = this.state.models.map((model) =>
      model.id === modelId ? { ...model, status } : model
    );
    this.update({ models });
  }

  /**
   * Update a specific provider's status.
   * @param providerId - The provider to update
   * @param updates - Partial status updates
   */
  updateProviderStatus(
    providerId: string,
    updates: Partial<ProviderStatus>
  ): void {
    const providers = this.state.providers.map((provider) =>
      provider.id === providerId ? { ...provider, ...updates } : provider
    );
    this.update({ providers });
  }

  /**
   * Add a new provider to state.
   * @param provider - Provider status to add
   */
  addProvider(provider: ProviderStatus): void {
    // Check if provider already exists
    if (this.state.providers.some((p) => p.id === provider.id)) {
      this.updateProviderStatus(provider.id, provider);
      return;
    }
    this.update({
      providers: [...this.state.providers, provider],
    });
  }

  /**
   * Remove a provider from state.
   * @param providerId - Provider ID to remove
   */
  removeProvider(providerId: string): void {
    const providers = this.state.providers.filter((p) => p.id !== providerId);
    const models = this.state.models.filter((m) => m.provider !== providerId);

    // Reset active provider/model if they belonged to removed provider
    const updates: Partial<AIState> = { providers, models };
    if (this.state.activeProvider === providerId) {
      updates.activeProvider = providers.length > 0 ? providers[0].id : null;
      updates.activeModel = null;
    }

    this.update(updates);
  }

  /**
   * Set the models list (replaces all models).
   * @param models - New models array
   */
  setModels(models: ModelInfo[]): void {
    this.update({ models });
  }

  /**
   * Add models to the existing list (for a specific provider).
   * @param newModels - Models to add
   * @param providerId - Provider these models belong to
   */
  addModels(newModels: ModelInfo[], providerId: string): void {
    // Remove existing models from this provider and add new ones
    const existingModels = this.state.models.filter(
      (m) => m.provider !== providerId
    );
    this.update({
      models: [...existingModels, ...newModels],
    });
  }

  /**
   * Set download progress.
   * @param modelId - Model being downloaded (or null to clear)
   * @param progress - Progress 0-1
   */
  setDownloading(modelId: string | null, progress = 0): void {
    this.update({
      downloading: modelId ? { modelId, progress } : null,
    });
  }

  /**
   * Set error state.
   * @param error - Error message (or null to clear)
   */
  setError(error: string | null): void {
    this.update({ error });
  }

  /**
   * Set initialized state.
   */
  setInitialized(initialized: boolean): void {
    this.update({ initialized });
  }

  /**
   * Set active model.
   * @param modelId - Model ID to set as active
   */
  setActiveModel(modelId: string | null): void {
    this.update({ activeModel: modelId });
  }

  /**
   * Set active provider.
   * @param providerId - Provider ID to set as active
   */
  setActiveProvider(providerId: string | null): void {
    this.update({ activeProvider: providerId });
  }

  /**
   * Notify all listeners of state change.
   * Catches errors to prevent one bad listener from breaking others.
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (error) {
        console.error('Error in state listener:', error);
      }
    }
  }
}
