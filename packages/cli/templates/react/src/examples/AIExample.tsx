import { useState } from 'react';
import { aiContext } from '../ai.context';

export function AIExample() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!message.trim()) return;
    
    setLoading(true);
    try {
      const reply = await aiContext.sendMessage(message);
      setResponse(reply);
    } catch (error) {
      setResponse('Error: ' + error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="example-container">
      <h2>AI Context Example</h2>
      <p>Using FakeAdapter for testing. Replace with WebLLMAdapter for real AI responses.</p>
      
      <div className="chat-container">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Ask the AI something..."
          className="chat-input"
          disabled={loading}
        />
        <button onClick={sendMessage} disabled={loading} className="send-button">
          {loading ? 'Thinking...' : 'Send'}
        </button>
      </div>

      {response && (
        <div className="response-box">
          <strong>AI Response:</strong>
          <p>{response}</p>
        </div>
      )}

      <pre className="code-example">
{`// Example usage:
import { createAIContext, FakeAdapter } from '@nearstack-dev/ai';

const ai = createAIContext(new FakeAdapter());
const response = await ai.sendMessage('Hello, AI!');`}
      </pre>
    </div>
  );
}