import type {
  PeerManagerConfig,
  PeerInfo,
  DataChannelMessage,
  SignalingMessage,
  SignalingChannel,
} from '../types.js';
import { PeerConnection } from './connection.js';

/**
 * Manages multiple WebRTC peer connections in a mesh topology.
 *
 * Handles the full peer lifecycle: discovery via signaling, WebRTC
 * negotiation (offer/answer/ICE), and data channel communication.
 * Each peer in the room is connected to every other peer.
 */
export class PeerManager {
  private peers: Map<string, PeerConnection> = new Map();
  private config: PeerManagerConfig;
  private signaling: SignalingChannel | null = null;
  private roomId: string | null = null;

  constructor(config: PeerManagerConfig) {
    this.config = config;
  }

  /** Start managing peers for a room using the given signaling channel. */
  attach(signaling: SignalingChannel, roomId: string): void {
    this.signaling = signaling;
    this.roomId = roomId;

    signaling.onMessage((message) => this.handleSignalingMessage(message));
    signaling.join(roomId, this.config.peerId);
  }

  /** Stop managing peers and close all connections. */
  detach(): void {
    for (const peer of this.peers.values()) {
      peer.close();
    }
    this.peers.clear();
    this.signaling?.leave();
    this.signaling = null;
    this.roomId = null;
  }

  /** Send data to a specific peer. */
  sendTo(peerId: string, message: DataChannelMessage): void {
    this.peers.get(peerId)?.send(message);
  }

  /** Broadcast data to all connected peers. */
  broadcast(message: DataChannelMessage): void {
    for (const peer of this.peers.values()) {
      peer.send(message);
    }
  }

  /** Get info about all peers. */
  getPeers(): PeerInfo[] {
    return Array.from(this.peers.values()).map((p) => p.getInfo());
  }

  /** Get the number of connected peers. */
  getConnectedCount(): number {
    return this.getPeers().filter((p) => p.state === 'connected').length;
  }

  private async handleSignalingMessage(message: SignalingMessage): Promise<void> {
    switch (message.type) {
      case 'join':
        await this.handlePeerJoin(message.senderId);
        break;
      case 'leave':
        this.handlePeerLeave(message.senderId);
        break;
      case 'offer':
        await this.handleOffer(message);
        break;
      case 'answer':
        await this.handleAnswer(message);
        break;
      case 'ice-candidate':
        await this.handleIceCandidate(message);
        break;
    }
  }

  /**
   * When a new peer joins, the peer with the lexicographically
   * higher ID initiates the connection (creates the offer).
   * This prevents both sides from simultaneously creating offers.
   */
  private async handlePeerJoin(remotePeerId: string): Promise<void> {
    if (this.peers.has(remotePeerId)) return;

    // Deterministic initiator selection: higher ID creates the offer
    if (this.config.peerId > remotePeerId) {
      await this.initiateConnection(remotePeerId);
    }
    // Otherwise, wait for the other peer's offer
  }

  private handlePeerLeave(remotePeerId: string): void {
    const peer = this.peers.get(remotePeerId);
    if (!peer) return;

    peer.close();
    this.peers.delete(remotePeerId);
    this.config.onPeerDisconnected(remotePeerId);
  }

  private async initiateConnection(remotePeerId: string): Promise<void> {
    const peer = this.createPeerConnection(remotePeerId);
    const offer = await peer.createOffer();

    this.sendSignaling({
      type: 'offer',
      senderId: this.config.peerId,
      targetId: remotePeerId,
      roomId: this.roomId!,
      payload: offer,
    });
  }

  private async handleOffer(message: SignalingMessage): Promise<void> {
    const remotePeerId = message.senderId;

    // Clean up any existing connection
    const existing = this.peers.get(remotePeerId);
    if (existing) {
      existing.close();
      this.peers.delete(remotePeerId);
    }

    const peer = this.createPeerConnection(remotePeerId);
    const answer = await peer.handleOffer(
      message.payload as RTCSessionDescriptionInit
    );

    this.sendSignaling({
      type: 'answer',
      senderId: this.config.peerId,
      targetId: remotePeerId,
      roomId: this.roomId!,
      payload: answer,
    });
  }

  private async handleAnswer(message: SignalingMessage): Promise<void> {
    const peer = this.peers.get(message.senderId);
    if (!peer) return;

    await peer.handleAnswer(message.payload as RTCSessionDescriptionInit);
  }

  private async handleIceCandidate(message: SignalingMessage): Promise<void> {
    const peer = this.peers.get(message.senderId);
    if (!peer) return;

    await peer.addIceCandidate(message.payload as RTCIceCandidateInit);
  }

  private createPeerConnection(remotePeerId: string): PeerConnection {
    const peer = new PeerConnection(
      remotePeerId,
      {
        onIceCandidate: (candidate) => {
          this.sendSignaling({
            type: 'ice-candidate',
            senderId: this.config.peerId,
            targetId: remotePeerId,
            roomId: this.roomId!,
            payload: candidate.toJSON(),
          });
        },
        onData: (data) => {
          this.config.onData(remotePeerId, data);
        },
        onStateChange: (state) => {
          if (state === 'connected') {
            this.config.onPeerConnected(remotePeerId);
          } else if (state === 'disconnected' || state === 'failed') {
            this.config.onPeerDisconnected(remotePeerId);
          }
        },
      },
      this.config.iceServers
    );

    this.peers.set(remotePeerId, peer);
    return peer;
  }

  private sendSignaling(message: SignalingMessage): void {
    this.signaling?.send(message);
  }
}
