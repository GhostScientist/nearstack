// @nearstack-dev/rtc — WebRTC + CRDT P2P sync layer
//
// Provides peer-to-peer data synchronization using WebRTC data channels
// and Last-Write-Wins CRDTs for conflict-free merging.

// ─── Core engine ───────────────────────────────────────────────────
export { SyncEngine, SyncDocumentHandle } from './sync/index.js';

// ─── CRDT primitives ───────────────────────────────────────────────
export { HLC, compareTimestamps } from './crdt/index.js';
export { LWWMap } from './crdt/index.js';

// ─── Signaling channels ───────────────────────────────────────────
export { BroadcastSignaling } from './signaling/index.js';
export { WebSocketSignaling } from './signaling/index.js';

// ─── Peer connection management ────────────────────────────────────
export { PeerConnection } from './peer/index.js';
export { PeerManager } from './peer/index.js';

// ─── Types ─────────────────────────────────────────────────────────
export type {
  HLCTimestamp,
  LWWEntry,
  LWWMapState,
  CRDTChange,
  SignalingMessageType,
  SignalingMessage,
  SignalingChannel,
  PeerConnectionState,
  PeerInfo,
  PeerManagerConfig,
  DataChannelMessageType,
  DataChannelMessage,
  SyncRequestPayload,
  SyncResponsePayload,
  ChangePayload,
  SyncEngineConfig,
  SyncDocument,
  SyncEventType,
  SyncEvent,
  SyncEventHandler,
} from './types.js';
