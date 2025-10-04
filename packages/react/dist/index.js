// React bindings (useModel, useLiveQuery)
import { useState, useEffect } from 'react';
export function useModel(model, id) {
    const [data, setData] = useState(undefined);
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
export function useLiveQuery(query, deps = []) {
    const [data, setData] = useState(undefined);
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
//# sourceMappingURL=index.js.map