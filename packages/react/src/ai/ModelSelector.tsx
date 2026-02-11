import type { AI } from '@nearstack-dev/ai';
import { useModelSelector } from './useModelSelector';

interface ModelSelectorProps {
  ai?: AI;
}

export function ModelSelector({ ai }: ModelSelectorProps) {
  const {
    choices,
    activeModel,
    selectModel,
    downloadModel,
    downloadProgress,
    isDownloading,
  } = useModelSelector(ai);

  const groups = choices.reduce<Record<string, typeof choices>>((acc, choice) => {
    if (!acc[choice.group]) acc[choice.group] = [];
    acc[choice.group].push(choice);
    return acc;
  }, {});

  return (
    <div>
      <select
        value={activeModel ?? ''}
        onChange={(event) => {
          const selectedModel = event.target.value;
          if (selectedModel) {
            void selectModel(selectedModel);
          }
        }}
      >
        <option value="" disabled>
          Select a model
        </option>
        {Object.entries(groups).map(([group, items]) => (
          <optgroup key={group} label={group}>
            {items.map((choice) => (
              <option key={choice.value} value={choice.value} disabled={choice.disabled}>
                {choice.label} ({choice.size})
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {activeModel && (
        <button
          type="button"
          disabled={isDownloading}
          onClick={() => {
            void downloadModel(activeModel);
          }}
        >
          {isDownloading ? `Downloading ${Math.round(downloadProgress * 100)}%` : 'Download Model'}
        </button>
      )}
    </div>
  );
}
