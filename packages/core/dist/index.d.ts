export interface Store<T = any> {
    get(id: string): Promise<T | undefined>;
    set(id: string, value: T): Promise<void>;
    delete(id: string): Promise<void>;
    getAll(): Promise<T[]>;
}
export interface Model<T = any> {
    name: string;
    store: Store<T>;
}
export declare function defineModel<T = any>(name: string): Model<T>;
export { defineModule } from './legacy.js';
//# sourceMappingURL=index.d.ts.map