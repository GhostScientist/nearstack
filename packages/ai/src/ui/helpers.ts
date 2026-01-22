import type {
  AIState,
  ModelChoice,
  ProviderChoice,
  ProviderType,
} from '../types';
import { formatBytes, getProviderLabel, getModelStatusLabel } from '../utils';

/**
 * UI helper functions factory.
 * Creates helpers that read from the provided state getter.
 */
export function createUIHelpers(getState: () => AIState) {
  /**
   * Get model choices formatted for dropdown/select components.
   * Groups models by provider and includes status information.
   */
  function getModelChoices(): ModelChoice[] {
    const state = getState();
    const choices: ModelChoice[] = [];

    for (const model of state.models) {
      const provider = state.providers.find((p) => p.id === model.provider);
      const providerLabel = provider
        ? getProviderLabel(provider.type as ProviderType)
        : model.provider;

      // Determine if model should be disabled
      const isDisabled =
        model.status.state === 'downloading' ||
        model.status.state === 'loading' ||
        model.status.state === 'error';

      // Build description based on status
      let description: string | undefined;
      if (model.status.state === 'downloading') {
        description = `Downloading: ${Math.round(model.status.progress * 100)}%`;
      } else if (model.status.state === 'error') {
        description = model.status.message;
      } else if (model.quantization) {
        description = model.quantization;
      }

      choices.push({
        value: model.id,
        label: model.name,
        group: providerLabel,
        size: formatBytes(model.size),
        status: model.status,
        disabled: isDisabled,
        description,
      });
    }

    // Sort by provider group, then by name within group
    choices.sort((a, b) => {
      if (a.group !== b.group) {
        return a.group.localeCompare(b.group);
      }
      return a.label.localeCompare(b.label);
    });

    return choices;
  }

  /**
   * Get provider choices formatted for UI.
   */
  function getProviderChoices(): ProviderChoice[] {
    const state = getState();

    return state.providers.map((provider) => ({
      value: provider.id,
      label: getProviderLabel(provider.type as ProviderType),
      available: provider.available,
      modelCount: provider.modelCount,
    }));
  }

  /**
   * Format bytes to human-readable string.
   * Re-exported for convenience.
   */
  function formatSize(bytes: number): string {
    return formatBytes(bytes);
  }

  /**
   * Get a human-readable label for a model's status.
   */
  function getStatusLabel(
    state: 'available' | 'downloading' | 'cached' | 'loading' | 'ready' | 'error'
  ): string {
    return getModelStatusLabel(state);
  }

  return {
    getModelChoices,
    getProviderChoices,
    formatSize,
    getStatusLabel,
  };
}

export type UIHelpers = ReturnType<typeof createUIHelpers>;
