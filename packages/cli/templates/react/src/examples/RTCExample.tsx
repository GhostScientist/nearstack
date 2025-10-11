import { useState, useEffect } from 'react';
import { createSyncEngine, type SyncEvent } from '@nearstack-dev/rtc';

export function RTCExample() {
  const [roomId, setRoomId] = useState('demo-room');
  const [connected, setConnected] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<string[]>([]);
  const [syncEngine, setSyncEngine] = useState<ReturnType<typeof createSyncEngine> | null>(null);

  const connect = async () => {
    try {
      const engine = createSyncEngine({
        roomId,
        onSync: (event: SyncEvent) => {
          if (event.type === 'message') {
            setMessages(prev => [...prev, event.data as string]);
          }
        }
      });
      
      await engine.connect();
      setSyncEngine(engine);
      setConnected(true);
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  };

  const disconnect = async () => {
    if (syncEngine) {
      await syncEngine.disconnect();
      setSyncEngine(null);
      setConnected(false);
    }
  };

  const sendMessage = async () => {
    if (!syncEngine || !message.trim()) return;
    
    try {
      await syncEngine.broadcast('message', message);
      setMessages(prev => [...prev, `You: ${message}`]);
      setMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  useEffect(() => {
    return () => {
      if (syncEngine) {
        syncEngine.disconnect();
      }
    };
  }, [syncEngine]);

  return (
    <div className="example-container">
      <h2>RTC (Real-Time Collaboration) Example</h2>
      <p>Using stub implementation for testing. Replace with real WebRTC signaling for production.</p>
      
      <div className="rtc-container">
        <div className="connection-section">
          <input
            type="text"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="Room ID"
            className="room-input"
            disabled={connected}
          />
          <button 
            onClick={connected ? disconnect : connect} 
            className={connected ? "disconnect-button" : "connect-button"}
          >
            {connected ? 'Disconnect' : 'Connect'}
          </button>
          <span className={`status ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? '🟢 Connected' : '🔴 Disconnected'}
          </span>
        </div>

        {connected && (
          <div className="chat-section">
            <div className="messages">
              {messages.length === 0 ? (
                <p className="empty-messages">No messages yet. Send one below!</p>
              ) : (
                messages.map((msg, index) => (
                  <div key={index} className="message">
                    {msg}
                  </div>
                ))
              )}
            </div>
            
            <div className="message-input-section">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type a message..."
                className="message-input"
              />
              <button onClick={sendMessage} className="send-button">
                Send
              </button>
            </div>
          </div>
        )}
      </div>

      <pre className="code-example">
{`// Example usage:
import { createSyncEngine } from '@nearstack-dev/rtc';

const syncEngine = createSyncEngine({
  roomId: 'my-room',
  onSync: (event) => {
    console.log('Sync event:', event);
  }
});

await syncEngine.connect();
await syncEngine.broadcast('message', 'Hello, world!');`}
      </pre>
    </div>
  );
}