// Text splitter + embedding + vector search (stub)

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

export class TextSplitter {
  constructor(private chunkSize: number = 512, private overlap: number = 50) {}

  split(text: string): TextChunk[] {
    const chunks: TextChunk[] = [];
    
    // First, split by paragraphs to preserve document structure
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    let chunkId = 0;
    let currentChunk = '';
    
    for (const paragraph of paragraphs) {
      const sentences = this.splitIntoSentences(paragraph);
      
      for (const sentence of sentences) {
        // If adding this sentence would exceed chunk size, save current chunk
        if (currentChunk.length + sentence.length > this.chunkSize && currentChunk.length > 0) {
          chunks.push({
            id: `chunk-${chunkId++}`,
            text: currentChunk.trim(),
            metadata: { 
              wordCount: currentChunk.split(/\s+/).length,
              charCount: currentChunk.length 
            }
          });
          
          // Start new chunk with overlap from previous chunk
          if (this.overlap > 0) {
            const words = currentChunk.split(/\s+/);
            const overlapWords = words.slice(-Math.floor(this.overlap / 10)); // Rough word-based overlap
            currentChunk = overlapWords.join(' ') + ' ';
          } else {
            currentChunk = '';
          }
        }
        
        currentChunk += sentence + ' ';
      }
      
      // Add paragraph break
      currentChunk += '\n';
    }
    
    // Add final chunk if it has content
    if (currentChunk.trim().length > 0) {
      chunks.push({
        id: `chunk-${chunkId++}`,
        text: currentChunk.trim(),
        metadata: { 
          wordCount: currentChunk.split(/\s+/).length,
          charCount: currentChunk.length 
        }
      });
    }

    return chunks;
  }
  
  private splitIntoSentences(text: string): string[] {
    // Simple sentence splitting - in production, use a proper NLP library
    return text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .map(s => s + '.');
  }
}

export class VectorStore {
  private embeddings: Embedding[] = [];

  async addEmbedding(embedding: Embedding): Promise<void> {
    // Stub: Will implement vector storage logic
    this.embeddings.push(embedding);
  }

  async search(_queryVector: number[], _k: number = 5): Promise<SearchResult[]> {
    // Stub: Will implement vector similarity search
    return [];
  }
}

export async function createEmbedding(_text: string): Promise<number[]> {
  // Stub: Will implement embedding generation (WebLLM or similar)
  return new Array(384).fill(0);
}

export interface RAGSearchResult {
  content: string;
  score: number;
  id: string;
}

export class RAGEngine {
  private vectorStore = new VectorStore();
  private chunks: TextChunk[] = [];

  async addDocument(text: string): Promise<void> {
    const chunk: TextChunk = {
      id: `doc-${this.chunks.length}`,
      text,
    };
    this.chunks.push(chunk);
    
    const vector = await createEmbedding(text);
    await this.vectorStore.addEmbedding({
      id: chunk.id,
      vector,
      chunk,
    });
  }

  async search(query: string, k: number = 5): Promise<RAGSearchResult[]> {
    // Enhanced text matching with scoring
    const results: RAGSearchResult[] = [];
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2); // Filter short words
    
    for (const chunk of this.chunks) {
      const text = chunk.text.toLowerCase();
      let score = 0;
      let matchCount = 0;
      
      // Exact phrase match (highest score)
      if (text.includes(queryLower)) {
        score += 2.0;
        matchCount++;
      }
      
      // Individual word matches
      for (const word of queryWords) {
        if (text.includes(word)) {
          // Count frequency of word in chunk
          const wordCount = (text.match(new RegExp(word, 'g')) || []).length;
          score += wordCount * 0.5;
          matchCount++;
        }
      }
      
      // Boost score based on chunk metadata if available
      if (chunk.metadata?.wordCount) {
        // Prefer shorter, more focused chunks for better relevance
        const lengthPenalty = Math.min(chunk.metadata.wordCount / 100, 0.5);
        score = score * (1 - lengthPenalty);
      }
      
      // Only include chunks with matches
      if (matchCount > 0) {
        // Calculate relative score based on match percentage
        const relativeScore = matchCount / queryWords.length;
        results.push({
          content: chunk.text,
          score: score * relativeScore,
          id: chunk.id,
        });
      }
    }
    
    // Sort by score (descending) and return top k results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }
}

export function createRAGEngine(): RAGEngine {
  return new RAGEngine();
}
