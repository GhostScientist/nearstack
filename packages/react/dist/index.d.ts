import type { Model } from '@nearstack-dev/core';
export declare function useModel<T = any>(model: Model<T>, id: string): {
    data: T | undefined;
    loading: boolean;
};
export declare function useLiveQuery<T = any>(query: () => Promise<T>, deps?: any[]): {
    data: T | undefined;
    loading: boolean;
};
//# sourceMappingURL=index.d.ts.map