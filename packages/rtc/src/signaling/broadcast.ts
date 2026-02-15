import type { SignalingChannel, SignalingMessage } from '../types.js';

/**
 * BroadcastChannel-based signaling for same-origin peers.
 *
 * Uses the browser's BroadcastChannel API to exchange WebRTC signaling
 * messages between tabs/windows of the same origin. No server required.
 * Ideal for local development and single-device multi-tab scenarios.
 */
export class BroadcastSignaling implements SignalingChannel {
  private channel: BroadcastChannel | null = null;
  private handler: ((message: SignalingMessage) => void) | null = null;
  private peerId: string | null = null;
  private roomId: string | null = null;

  constructor(private channelPrefix = 'nearstack-rtc') {}

  send(message: SignalingMessage): void {
    if (!this.channel) return;
    this.channel.postMessage(message);
  }

  onMessage(handler: (message: SignalingMessage) => void): void {
    this.handler = handler;
  }

  join(roomId: string, peerId: string): void {
    this.peerId = peerId;
    this.roomId = roomId;

    // Close any existing channel
    this.channel?.close();

    this.channel = new BroadcastChannel(`${this.channelPrefix}:${roomId}`);
    this.channel.onmessage = (event: MessageEvent<SignalingMessage>) => {
      const message = event.data;
      // Ignore messages from self
      if (message.senderId === this.peerId) return;
      // Ignore messages targeted at other peers
      if (message.targetId && message.targetId !== this.peerId) return;
      this.handler?.(message);
    };

    // Announce presence
    this.send({
      type: 'join',
      senderId: peerId,
      roomId,
      payload: null,
    });
  }

  leave(): void {
    if (!this.channel || !this.peerId || !this.roomId) return;

    this.send({
      type: 'leave',
      senderId: this.peerId,
      roomId: this.roomId,
      payload: null,
    });

    this.channel.close();
    this.channel = null;
  }

  dispose(): void {
    this.leave();
    this.handler = null;
  }
}
