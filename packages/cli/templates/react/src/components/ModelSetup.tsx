import { useModelSelector } from '@nearstack-dev/react/ai';

export function ModelSetup() {
  const {
    choices,
    selectModel,
    downloadModel,
    isDownloading,
    downloadProgress,
    currentSelection,
    selectedModel,
  } = useModelSelector();

  if (choices.length === 0) {
    return (
      <section className="card">
        <h2>Model Setup</h2>
        <p>No providers detected. Start Ollama or enable WebGPU for browser models.</p>
      </section>
    );
  }

  const status = selectedModel?.status;

  return (
    <section className="card">
      <h2>Model Setup</h2>
      <select
        value={currentSelection ?? ''}
        onChange={(event) => {
          const modelId = event.target.value;
          if (modelId) {
            void selectModel(modelId);
          }
        }}
        disabled={isDownloading}
      >
        <option value="">Select a model</option>
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value} disabled={choice.disabled}>
            {choice.group} · {choice.label} ({choice.size})
          </option>
        ))}
      </select>

      {selectedModel && status ? (
        <div className="model-status-card">
          {status.state === 'available' ? (
            <>
              <div className="model-status-info">
                <span className="model-status-name">{selectedModel.name}</span>
                <span className="model-status-size">
                  {formatBytes(selectedModel.size)}
                </span>
              </div>
              <button
                onClick={() => void downloadModel(selectedModel.id)}
                disabled={isDownloading}
              >
                Download Model
              </button>
            </>
          ) : null}

          {status.state === 'downloading' ? (
            <>
              <div className="model-status-info">
                <span className="model-status-name">{selectedModel.name}</span>
                <span className="model-status-detail">Downloading...</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${Math.round(downloadProgress * 100)}%` }}
                />
              </div>
              <span className="progress-text">
                {Math.round(downloadProgress * 100)}%
              </span>
            </>
          ) : null}

          {status.state === 'cached' ? (
            <div className="model-status-info">
              <span className="model-status-name">{selectedModel.name}</span>
              <span className="model-status-ready">&#10003; Downloaded &mdash; Ready to use</span>
            </div>
          ) : null}

          {status.state === 'ready' ? (
            <div className="model-status-info">
              <span className="model-status-name">{selectedModel.name}</span>
              <span className="model-status-active">&#9679; Active</span>
            </div>
          ) : null}

          {status.state === 'error' ? (
            <>
              <div className="model-status-info">
                <span className="model-status-name">{selectedModel.name}</span>
                <span className="model-status-error">{status.message}</span>
              </div>
              <button onClick={() => void downloadModel(selectedModel.id)}>
                Retry
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
