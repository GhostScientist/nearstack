export interface TextChunk {
    id: string;
    text: string;
    metadata?: Record<string, any>;
}
export interface Embedding {
    id: string;
    vector: number[];
    chunk: TextChunk;
}
export interface SearchResult {
    chunk: TextChunk;
    score: number;
}
export declare class TextSplitter {
    private chunkSize;
    private overlap;
    constructor(chunkSize?: number, overlap?: number);
    split(text: string): TextChunk[];
}
export declare class VectorStore {
    private embeddings;
    addEmbedding(embedding: Embedding): Promise<void>;
    search(queryVector: number[], k?: number): Promise<SearchResult[]>;
}
export declare function createEmbedding(text: string): Promise<number[]>;
//# sourceMappingURL=index.d.ts.map