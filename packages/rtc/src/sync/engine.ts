import type {
  SyncEngineConfig,
  SyncEvent,
  SyncEventHandler,
  DataChannelMessage,
  SyncRequestPayload,
  SyncResponsePayload,
  ChangePayload,
  PeerInfo,
  LWWMapState,
} from '../types.js';
import { LWWMap } from '../crdt/lww-map.js';
import { HLC } from '../crdt/hlc.js';
import { PeerManager } from '../peer/manager.js';

/**
 * SyncEngine orchestrates WebRTC peer connections and CRDT document
 * synchronization.
 *
 * It manages the full sync lifecycle:
 * 1. Joins a room via the provided signaling channel
 * 2. Establishes WebRTC data channels with discovered peers
 * 3. Performs initial full-state sync when peers connect
 * 4. Broadcasts incremental CRDT changes in real-time
 * 5. Merges remote changes using LWW conflict resolution
 *
 * Usage:
 * ```ts
 * const engine = new SyncEngine({
 *   roomId: 'my-room',
 *   signaling: new BroadcastSignaling(),
 * });
 *
 * const doc = engine.document('todos');
 * doc.set('todo-1', { id: 'todo-1', text: 'Buy milk', done: false });
 *
 * doc.subscribe(() => {
 *   console.log('State changed:', doc.getState());
 * });
 *
 * await engine.connect();
 * ```
 */
export class SyncEngine {
  private peerId: string;
  private peerManager: PeerManager;
  private documents: Map<string, LWWMap> = new Map();
  private clock: HLC;
  private connected = false;
  private eventHandlers: Set<SyncEventHandler> = new Set();
  private config: SyncEngineConfig;

  constructor(config: SyncEngineConfig) {
    this.config = config;
    this.peerId = config.peerId ?? crypto.randomUUID();
    this.clock = new HLC(this.peerId);

    this.peerManager = new PeerManager({
      peerId: this.peerId,
      iceServers: config.iceServers,
      onData: (peerId, data) => this.handleData(peerId, data),
      onPeerConnected: (peerId) => this.handlePeerConnected(peerId),
      onPeerDisconnected: (peerId) => this.handlePeerDisconnected(peerId),
    });
  }

  /** Connect to the room and start syncing. */
  async connect(): Promise<void> {
    if (this.connected) return;

    this.peerManager.attach(this.config.signaling, this.config.roomId);
    this.connected = true;

    this.emit({ type: 'connected' });
  }

  /** Disconnect from the room. */
  async disconnect(): Promise<void> {
    if (!this.connected) return;

    this.peerManager.detach();
    this.connected = false;

    this.emit({ type: 'disconnected' });
  }

  /**
   * Get or create a synced CRDT document.
   *
   * Each document is an independent LWW-Map that syncs its state
   * with all connected peers. Documents map naturally to nearstack
   * models — use the model name as the document ID.
   */
  document<T = unknown>(documentId: string): SyncDocumentHandle<T> {
    let doc = this.documents.get(documentId) as LWWMap<T> | undefined;
    if (!doc) {
      doc = new LWWMap<T>(this.clock);
      this.documents.set(documentId, doc as LWWMap);
    }
    return new SyncDocumentHandle(documentId, doc, (docId, changes) => {
      this.broadcastChanges(docId, changes);
    });
  }

  /** Get the local peer ID. */
  getPeerId(): string {
    return this.peerId;
  }

  /** Get info about connected peers. */
  getPeers(): PeerInfo[] {
    return this.peerManager.getPeers();
  }

  /** Check if connected to the room. */
  isConnected(): boolean {
    return this.connected;
  }

  /** Subscribe to sync events. */
  on(handler: SyncEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  /** Clean up all resources. */
  dispose(): void {
    this.disconnect();
    this.documents.clear();
    this.eventHandlers.clear();
  }

  private handlePeerConnected(peerId: string): void {
    this.emit({ type: 'peer-joined', peerId });
    this.config.onPeersChange?.(this.peerManager.getPeers());

    // Initiate full sync with the new peer for all documents
    for (const [docId, doc] of this.documents) {
      const knownEntries = doc.getKnownEntries();
      this.peerManager.sendTo(peerId, {
        type: 'sync-request',
        documentId: docId,
        payload: { knownEntries } satisfies SyncRequestPayload,
      });
    }
  }

  private handlePeerDisconnected(peerId: string): void {
    this.emit({ type: 'peer-left', peerId });
    this.config.onPeersChange?.(this.peerManager.getPeers());
  }

  private handleData(peerId: string, message: DataChannelMessage): void {
    switch (message.type) {
      case 'sync-request':
        this.handleSyncRequest(peerId, message);
        break;
      case 'sync-response':
        this.handleSyncResponse(message);
        break;
      case 'change':
        this.handleRemoteChange(message);
        break;
    }
  }

  /**
   * Handle a sync request from a peer. Compute what entries the
   * remote peer is missing and send them back.
   */
  private handleSyncRequest(
    peerId: string,
    message: DataChannelMessage
  ): void {
    const { knownEntries } = message.payload as SyncRequestPayload;
    const doc = this.documents.get(message.documentId);

    // Even if we don't have the document yet, respond so the peer
    // can send us their full state.
    const missingEntries = doc ? doc.diffFrom(knownEntries) : {};

    this.peerManager.sendTo(peerId, {
      type: 'sync-response',
      documentId: message.documentId,
      payload: { entries: missingEntries } satisfies SyncResponsePayload,
    });

    // Also request entries we're missing from the peer
    if (doc) {
      // The remote told us what they know; we may be missing some of those
      const ourKnown = doc.getKnownEntries();
      const weNeed: Record<string, unknown> = {};
      for (const key of Object.keys(knownEntries)) {
        if (!ourKnown[key]) {
          weNeed[key] = true;
        }
      }

      if (Object.keys(weNeed).length > 0) {
        this.peerManager.sendTo(peerId, {
          type: 'sync-request',
          documentId: message.documentId,
          payload: { knownEntries: ourKnown } satisfies SyncRequestPayload,
        });
      }
    }
  }

  /**
   * Handle a sync response from a peer. Merge the received entries
   * into our local CRDT state.
   */
  private handleSyncResponse(message: DataChannelMessage): void {
    const { entries } = message.payload as SyncResponsePayload;

    let doc = this.documents.get(message.documentId);
    if (!doc) {
      doc = new LWWMap(this.clock);
      this.documents.set(message.documentId, doc);
    }

    const applied = doc.merge(entries);
    if (applied.length > 0) {
      this.emit({
        type: 'document-changed',
        documentId: message.documentId,
      });
      this.config.onDocumentChange?.(message.documentId, doc.toState());
    }
  }

  /**
   * Handle an incremental change broadcast from a peer.
   */
  private handleRemoteChange(message: DataChannelMessage): void {
    const { changes } = message.payload as ChangePayload;

    let doc = this.documents.get(message.documentId);
    if (!doc) {
      doc = new LWWMap(this.clock);
      this.documents.set(message.documentId, doc);
    }

    let anyApplied = false;
    for (const change of changes) {
      if (doc.applyRemote(change)) {
        anyApplied = true;
      }
    }

    if (anyApplied) {
      this.emit({
        type: 'document-changed',
        documentId: message.documentId,
      });
      this.config.onDocumentChange?.(message.documentId, doc.toState());
    }
  }

  private broadcastChanges(
    documentId: string,
    changes: ChangePayload
  ): void {
    if (!this.connected) return;

    this.peerManager.broadcast({
      type: 'change',
      documentId,
      payload: changes,
    });
  }

  private emit(event: SyncEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch {
        // Don't let handler errors break the engine
      }
    }
  }
}

/**
 * Handle for interacting with a single synced CRDT document.
 * Provides a clean API for reading/writing data and subscribing
 * to changes.
 */
export class SyncDocumentHandle<T = unknown> {
  constructor(
    readonly id: string,
    private map: LWWMap<T>,
    private onLocalChange: (documentId: string, changes: ChangePayload<T>) => void
  ) {}

  /** Get the current state as a plain object of live entries. */
  getState(): Record<string, T> {
    return this.map.getAll();
  }

  /** Get a single value by key. */
  get(key: string): T | undefined {
    return this.map.get(key);
  }

  /** Set a value, broadcasting the change to peers. */
  set(key: string, value: T): void {
    const change = this.map.set(key, value);
    this.onLocalChange(this.id, { changes: [change] });
  }

  /** Delete a key, broadcasting the tombstone to peers. */
  delete(key: string): void {
    const change = this.map.delete(key);
    if (change) {
      this.onLocalChange(this.id, { changes: [change] });
    }
  }

  /** Subscribe to changes (both local and remote). Returns unsubscribe fn. */
  subscribe(callback: () => void): () => void {
    return this.map.subscribe(callback);
  }

  /** Get the number of live (non-deleted) entries. */
  get size(): number {
    return this.map.size;
  }

  /** Export the full CRDT state for debugging/serialization. */
  toState(): LWWMapState<T> {
    return this.map.toState();
  }
}
