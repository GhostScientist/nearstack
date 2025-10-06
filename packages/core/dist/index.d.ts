export interface Store<T = any> {
    get(id: string): Promise<T | undefined>;
    set(id: string, value: T): Promise<void>;
    delete(id: string): Promise<void>;
    getAll(): Promise<T[]>;
    insert(value: Omit<T, 'id'>): Promise<T>;
    update(id: string, value: Partial<T>): Promise<T | undefined>;
}
export interface Table<T = any> {
    insert(value: Omit<T, 'id'>): Promise<T>;
    update(id: string, value: Partial<T>): Promise<T | undefined>;
    delete(id: string): Promise<void>;
    get(id: string): Promise<T | undefined>;
    getAll(): Promise<T[]>;
    find(predicate: (item: T) => boolean): Promise<T[]>;
}
export interface Model<T = any> {
    name: string;
    store: Store<T>;
    table(): Table<T>;
}
export declare function defineModel<T extends {
    id: string;
}>(name: string): Model<T>;
export { defineModule } from './legacy.js';
//# sourceMappingURL=index.d.ts.map