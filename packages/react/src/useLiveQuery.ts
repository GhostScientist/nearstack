import { useEffect, useState } from 'react';
import type { Model } from '@nearstack-dev/core';

export function useLiveQuery<T = any>(
  query: () => Promise<T>,
  deps: any[] = [],
  model?: Model<any>
) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const runQuery = async () => {
      setLoading(true);
      setError(null);
      try {
        const value = await query();
        if (!mounted) return;
        setData(value);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void runQuery();

    const unsubscribe = model?.subscribe?.(() => {
      void runQuery();
    });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [model, ...deps]);

  return { data, loading, error };
}
