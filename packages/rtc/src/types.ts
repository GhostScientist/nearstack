// ─── Hybrid Logical Clock ──────────────────────────────────────────

export interface HLCTimestamp {
  /** Wall-clock time in milliseconds */
  time: number;
  /** Logical counter for ordering events at the same wall-clock time */
  counter: number;
  /** Unique node identifier to break ties */
  nodeId: string;
}

// ─── CRDT Types ────────────────────────────────────────────────────

export interface LWWEntry<T = unknown> {
  value: T;
  timestamp: HLCTimestamp;
  deleted: boolean;
}

export interface LWWMapState<T = unknown> {
  entries: Record<string, LWWEntry<T>>;
}

export interface CRDTChange<T = unknown> {
  key: string;
  value: T;
  timestamp: HLCTimestamp;
  deleted: boolean;
}

// ─── Signaling Types ───────────────────────────────────────────────

export type SignalingMessageType =
  | 'join'
  | 'leave'
  | 'offer'
  | 'answer'
  | 'ice-candidate'
  | 'ping'
  | 'pong';

export interface SignalingMessage {
  type: SignalingMessageType;
  senderId: string;
  targetId?: string;
  roomId: string;
  payload: unknown;
}

export interface SignalingChannel {
  /** Send a signaling message */
  send(message: SignalingMessage): void;
  /** Register a handler for incoming messages */
  onMessage(handler: (message: SignalingMessage) => void): void;
  /** Join a room and announce presence */
  join(roomId: string, peerId: string): void;
  /** Leave the room */
  leave(): void;
  /** Clean up resources */
  dispose(): void;
}

// ─── Peer Types ────────────────────────────────────────────────────

export type PeerConnectionState =
  | 'new'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed'
  | 'closed';

export interface PeerInfo {
  id: string;
  state: PeerConnectionState;
  connection: RTCPeerConnection | null;
  dataChannel: RTCDataChannel | null;
}

export interface PeerManagerConfig {
  peerId: string;
  iceServers?: RTCIceServer[];
  onData: (peerId: string, data: DataChannelMessage) => void;
  onPeerConnected: (peerId: string) => void;
  onPeerDisconnected: (peerId: string) => void;
}

// ─── Data Channel Protocol ─────────────────────────────────────────

export type DataChannelMessageType =
  | 'sync-request'
  | 'sync-response'
  | 'change'
  | 'change-ack';

export interface DataChannelMessage {
  type: DataChannelMessageType;
  documentId: string;
  payload: unknown;
}

export interface SyncRequestPayload {
  /** Keys and their timestamps the sender knows about */
  knownEntries: Record<string, HLCTimestamp>;
}

export interface SyncResponsePayload {
  /** Full entries the receiver is missing or has stale versions of */
  entries: Record<string, LWWEntry>;
}

export interface ChangePayload<T = unknown> {
  changes: CRDTChange<T>[];
}

// ─── SyncEngine Types ──────────────────────────────────────────────

export interface SyncEngineConfig {
  /** Unique identifier for this peer/node */
  peerId?: string;
  /** Room to join for peer discovery */
  roomId: string;
  /** Signaling channel to use for WebRTC negotiation */
  signaling: SignalingChannel;
  /** ICE servers for NAT traversal */
  iceServers?: RTCIceServer[];
  /** Called when a synced document changes */
  onDocumentChange?: (documentId: string, state: LWWMapState) => void;
  /** Called when peer connectivity changes */
  onPeersChange?: (peers: PeerInfo[]) => void;
}

export interface SyncDocument<T extends { id: string } = { id: string }> {
  /** Unique document identifier */
  id: string;
  /** Get the current merged state */
  getState(): Record<string, T>;
  /** Apply a local change */
  set(key: string, value: T): void;
  /** Delete a key */
  delete(key: string): void;
  /** Subscribe to state changes */
  subscribe(callback: () => void): () => void;
}

// ─── Events ────────────────────────────────────────────────────────

export type SyncEventType =
  | 'connected'
  | 'disconnected'
  | 'peer-joined'
  | 'peer-left'
  | 'document-changed'
  | 'error';

export interface SyncEvent {
  type: SyncEventType;
  peerId?: string;
  documentId?: string;
  error?: Error;
}

export type SyncEventHandler = (event: SyncEvent) => void;
