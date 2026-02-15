import type { SignalingChannel, SignalingMessage } from '../types.js';

/**
 * WebSocket-based signaling for cross-device peers.
 *
 * Connects to a signaling server via WebSocket for exchanging WebRTC
 * negotiation messages across devices/networks. The signaling server
 * is responsible for routing messages between peers in the same room.
 *
 * Expected server protocol:
 * - Client sends JSON-encoded SignalingMessage objects
 * - Server broadcasts messages to all other clients in the same room
 * - Server routes targeted messages (with targetId) to the specific peer
 */
export class WebSocketSignaling implements SignalingChannel {
  private ws: WebSocket | null = null;
  private handler: ((message: SignalingMessage) => void) | null = null;
  private peerId: string | null = null;
  private roomId: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private disposed = false;

  constructor(
    private url: string,
    private options: {
      maxReconnectAttempts?: number;
      reconnectBaseDelay?: number;
    } = {}
  ) {
    if (options.maxReconnectAttempts !== undefined) {
      this.maxReconnectAttempts = options.maxReconnectAttempts;
    }
  }

  send(message: SignalingMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(message));
  }

  onMessage(handler: (message: SignalingMessage) => void): void {
    this.handler = handler;
  }

  join(roomId: string, peerId: string): void {
    this.peerId = peerId;
    this.roomId = roomId;
    this.disposed = false;
    this.connect();
  }

  leave(): void {
    if (!this.ws || !this.peerId || !this.roomId) return;

    this.send({
      type: 'leave',
      senderId: this.peerId,
      roomId: this.roomId,
      payload: null,
    });

    this.cleanup();
  }

  dispose(): void {
    this.disposed = true;
    this.cleanup();
    this.handler = null;
  }

  private connect(): void {
    if (this.disposed) return;

    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;

      if (this.peerId && this.roomId) {
        this.send({
          type: 'join',
          senderId: this.peerId,
          roomId: this.roomId,
          payload: null,
        });
      }
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const message: SignalingMessage = JSON.parse(event.data as string);
        // Ignore messages from self
        if (message.senderId === this.peerId) return;
        // Ignore messages targeted at other peers
        if (message.targetId && message.targetId !== this.peerId) return;
        this.handler?.(message);
      } catch {
        // Ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      if (!this.disposed) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // onclose will fire after onerror, triggering reconnect
    };
  }

  private scheduleReconnect(): void {
    if (this.disposed || this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    const baseDelay = this.options.reconnectBaseDelay ?? 1000;
    const delay = baseDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private cleanup(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      if (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      ) {
        this.ws.close();
      }
      this.ws = null;
    }
  }
}
