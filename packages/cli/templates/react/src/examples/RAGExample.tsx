import { useState } from 'react';
import { createRAGEngine, TextSplitter } from '@nearstack-dev/rag';

export function RAGExample() {
  const [document, setDocument] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const searchDocument = async () => {
    if (!document.trim() || !query.trim()) return;
    
    setLoading(true);
    try {
      const ragEngine = createRAGEngine();
      const splitter = new TextSplitter();
      
      // Split document into chunks
      const chunks = splitter.split(document);
      
      // Add chunks to vector store
      for (const chunk of chunks) {
        await ragEngine.addDocument(chunk);
      }
      
      // Search for relevant chunks
      const searchResults = await ragEngine.search(query, 3);
      setResults(searchResults.map(r => r.content));
    } catch (error) {
      setResults(['Error: ' + error]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="example-container">
      <h2>RAG (Retrieval-Augmented Generation) Example</h2>
      <p>Using stub implementation for testing. Replace with real embedding model for production.</p>
      
      <div className="rag-container">
        <div className="input-section">
          <h3>Document</h3>
          <textarea
            value={document}
            onChange={(e) => setDocument(e.target.value)}
            placeholder="Paste your document here..."
            className="document-input"
            rows={6}
          />
          
          <h3>Search Query</h3>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchDocument()}
            placeholder="What do you want to find?"
            className="query-input"
            disabled={loading}
          />
          <button onClick={searchDocument} disabled={loading} className="search-button">
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {results.length > 0 && (
          <div className="results-section">
            <h3>Relevant Chunks:</h3>
            {results.map((result, index) => (
              <div key={index} className="result-item">
                <strong>Chunk {index + 1}:</strong>
                <p>{result}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <pre className="code-example">
{`// Example usage:
import { createRAGEngine, TextSplitter } from '@nearstack-dev/rag';

const ragEngine = createRAGEngine();
const splitter = new TextSplitter();

const chunks = splitter.split(document);
for (const chunk of chunks) {
  await ragEngine.addDocument(chunk);
}

const results = await ragEngine.search('query', 3);`}
      </pre>
    </div>
  );
}