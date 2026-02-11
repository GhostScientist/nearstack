import { useModelSelector } from '@nearstack-dev/react/ai';

export function ModelSetup() {
  const { choices, selectModel, downloadModel, isDownloading, downloadProgress, currentSelection, selectedModel } =
    useModelSelector();

  return (
    <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
      <h2 className="text-xl font-semibold">Model Setup</h2>
      {choices.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">No providers detected. Start Ollama or enable WebGPU.</p>
      ) : (
        <>
          <select
            className="mt-3 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2"
            value={currentSelection ?? ''}
            onChange={(event) => {
              if (event.target.value) {
                void selectModel(event.target.value);
              }
            }}
            disabled={isDownloading}
          >
            <option value="">Select a model</option>
            {choices.map((choice) => (
              <option key={choice.value} value={choice.value} disabled={choice.disabled}>
                {choice.group} · {choice.label}
              </option>
            ))}
          </select>

          {selectedModel?.status?.state === 'available' ? (
            <button
              className="mt-3 rounded-md bg-cyan-500 px-4 py-2 font-medium text-slate-950"
              onClick={() => void downloadModel(selectedModel.id)}
            >
              Download model
            </button>
          ) : null}

          {selectedModel?.status?.state === 'downloading' ? (
            <p className="mt-3 text-sm text-slate-300">Downloading {Math.round(downloadProgress * 100)}%</p>
          ) : null}

          {selectedModel?.status?.state === 'cached' || selectedModel?.status?.state === 'ready' ? (
            <p className="mt-3 text-sm text-emerald-300">{selectedModel.name} is ready.</p>
          ) : null}

          {selectedModel?.status?.state === 'error' ? (
            <p className="mt-3 text-sm text-rose-300">{selectedModel.status.message}</p>
          ) : null}
        </>
      )}
    </section>
  );
}
