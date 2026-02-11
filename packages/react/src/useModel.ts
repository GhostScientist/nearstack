import { useEffect, useState } from 'react';
import type { Model } from '@nearstack-dev/core';

export function useModel<T = any>(model: Model<T>, id: string) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    model.store.get(id).then((value) => {
      if (!mounted) return;
      setData(value);
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [model, id]);

  return { data, loading };
}
