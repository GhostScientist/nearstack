import { useEffect, useState } from 'react';
import { ai as defaultAI } from '@nearstack-dev/ai';
import type { AI, AIState } from '@nearstack-dev/ai';

export function useAI(instance: AI = defaultAI) {
  const [state, setState] = useState<AIState>(instance.getState());
  const [isLoading, setIsLoading] = useState(!instance.getState().initialized);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = instance.subscribe((nextState) => {
      setState(nextState);
      setIsLoading(!nextState.initialized);
      setError(nextState.error);
    });

    instance.ready().catch((readyError) => {
      setError(readyError instanceof Error ? readyError.message : String(readyError));
      setIsLoading(false);
    });

    return unsubscribe;
  }, [instance]);

  return {
    state,
    ai: instance,
    isReady: state.initialized,
    isLoading,
    error,
  };
}
