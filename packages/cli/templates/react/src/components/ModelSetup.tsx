import { useMemo } from 'react';
import { useModelSelector } from '@nearstack-dev/react/ai';

export function ModelSetup() {
  const { choices, activeModel, selectModel, downloadModel, isDownloading, downloadProgress } =
    useModelSelector();

  const selected = useMemo(() => choices.find((choice) => choice.value === activeModel), [choices, activeModel]);

  if (choices.length === 0) {
    return (
      <section className="card">
        <h2>Model Setup</h2>
        <p>No providers detected. Start Ollama or enable WebGPU for browser models.</p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>Model Setup</h2>
      <select
        value={activeModel ?? ''}
        onChange={(event) => {
          const modelId = event.target.value;
          if (modelId) {
            void selectModel(modelId);
          }
        }}
      >
        <option value="">Select a model</option>
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value} disabled={choice.disabled}>
            {choice.group} · {choice.label} ({choice.size})
          </option>
        ))}
      </select>

      {selected?.status.state === 'available' ? (
        <button
          onClick={() => {
            void downloadModel(selected.value);
          }}
          disabled={isDownloading}
        >
          {isDownloading ? `Downloading ${Math.round(downloadProgress * 100)}%` : 'Download for offline use'}
        </button>
      ) : null}
    </section>
  );
}
