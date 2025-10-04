// React bindings (useModel, useLiveQuery)

import { useState, useEffect } from 'react';
import type { Model } from '@nearstack-dev/core';

export function useModel<T = any>(model: Model<T>, id: string) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    model.store.get(id).then((value) => {
      if (mounted) {
        setData(value);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, [model, id]);

  return { data, loading };
}

export function useLiveQuery<T = any>(
  query: () => Promise<T>,
  deps: any[] = []
) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    query().then((value) => {
      if (mounted) {
        setData(value);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, deps);

  return { data, loading };
}
