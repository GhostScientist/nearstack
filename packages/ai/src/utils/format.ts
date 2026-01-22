import type { ProviderType } from '../types';

/**
 * Format bytes to human-readable string.
 * @param bytes - Number of bytes
 * @returns Human-readable string (e.g., '2.2 GB')
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);

  // Determine decimal places based on value
  // For values >= 100, use 0 decimals
  // For values >= 10, use 1 decimal
  // Otherwise use 2 decimals
  let formatted: string;
  if (value >= 100) {
    formatted = Math.round(value).toString();
  } else if (value >= 10) {
    formatted = value.toFixed(1);
  } else {
    formatted = value.toFixed(2);
  }

  return `${formatted} ${units[i]}`;
}

/**
 * Get display label for a provider type.
 * @param type - Provider type
 * @returns Human-readable label
 */
export function getProviderLabel(type: ProviderType): string {
  switch (type) {
    case 'browser':
      return 'Browser (WebLLM)';
    case 'ollama':
      return 'Ollama';
    case 'openai-compatible':
      return 'OpenAI Compatible';
    default:
      return type;
  }
}

/**
 * Capitalize first letter of a string.
 * @param str - String to capitalize
 * @returns Capitalized string
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Get model status label for display.
 * @param state - Model status state
 * @returns Human-readable status label
 */
export function getModelStatusLabel(
  state: 'available' | 'downloading' | 'cached' | 'loading' | 'ready' | 'error'
): string {
  switch (state) {
    case 'available':
      return 'Available';
    case 'downloading':
      return 'Downloading';
    case 'cached':
      return 'Downloaded';
    case 'loading':
      return 'Loading';
    case 'ready':
      return 'Ready';
    case 'error':
      return 'Error';
    default:
      return state;
  }
}
