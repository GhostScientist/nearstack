import { type Writable } from 'svelte/store';
import type { Model } from '@nearstack/core';
export declare function modelStore<T = any>(model: Model<T>, id: string): Writable<T | undefined>;
export declare function liveQuery<T = any>(query: () => Promise<T>): Writable<T | undefined>;
//# sourceMappingURL=index.d.ts.map