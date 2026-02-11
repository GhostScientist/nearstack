import { useMemo, useState } from 'react';
import { ai as defaultAI } from '@nearstack-dev/ai';
import type { AI, ModelChoice } from '@nearstack-dev/ai';
import { useAI } from './useAI';

export function useModelSelector(instance: AI = defaultAI) {
  const { state } = useAI(instance);
  const [isDownloading, setIsDownloading] = useState(false);

  const choices = useMemo<ModelChoice[]>(() => {
    return instance.ui.getModelChoices();
  }, [instance, state]);

  const activeModel = state.activeModel;
  const downloadProgress = state.downloading?.progress ?? 0;

  const selectModel = async (modelId: string) => {
    await instance.models.use(modelId);
  };

  const downloadModel = async (modelId: string) => {
    setIsDownloading(true);
    try {
      await instance.models.download(modelId);
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
  };
}
