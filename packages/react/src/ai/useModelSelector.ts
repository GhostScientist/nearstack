import { useMemo, useState } from 'react';
import { ai as defaultAI } from '@nearstack-dev/ai';
import type { AI, ModelChoice, ModelInfo } from '@nearstack-dev/ai';
import { useAI } from './useAI';

export function useModelSelector(instance: AI = defaultAI) {
  const { state } = useAI(instance);
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);

  const choices = useMemo<ModelChoice[]>(() => {
    return instance.ui.getModelChoices();
  }, [instance, state]);

  const activeModel = state.activeModel;
  const downloadProgress = state.downloading?.progress ?? 0;

  // What the dropdown should show: the user's pending selection, or the active model
  const currentSelection = selectedModelId ?? activeModel;

  // Full ModelInfo for the currently selected model (for rendering status card)
  const selectedModel = useMemo<ModelInfo | undefined>(() => {
    if (!currentSelection) return undefined;
    return instance.models.get(currentSelection);
  }, [instance, currentSelection, state]);

  const selectModel = async (modelId: string) => {
    const model = instance.models.get(modelId);
    if (!model) return;

    // For ready/cached models or Ollama models, activate directly
    if (
      model.status.state === 'ready' ||
      model.status.state === 'cached' ||
      model.provider === 'ollama'
    ) {
      await instance.models.use(modelId);
      setSelectedModelId(null);
    } else {
      // For available browser models, just track the selection without calling use()
      setSelectedModelId(modelId);
    }
  };

  const downloadModel = async (modelId: string) => {
    setIsDownloading(true);
    try {
      await instance.models.download(modelId);
      // Auto-activate after successful download
      await instance.models.use(modelId);
      setSelectedModelId(null);
    } finally {
      setIsDownloading(false);
    }
  };

  return {
    choices,
    activeModel,
    selectModel,
    downloadModel,
    isDownloading,
    downloadProgress,
    currentSelection,
    selectedModel,
  };
}
