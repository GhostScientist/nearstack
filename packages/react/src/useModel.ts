import { useEffect, useState } from 'react';
import type { Model } from '@nearstack-dev/core';

export function useModel<T = any>(model: Model<T>, id: string) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    model.store.get(id)
      .then((value) => {
        if (!mounted) return;
        setData(value);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [model, id]);

  return { data, loading, error };
}
