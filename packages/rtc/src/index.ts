// WebRTC + CRDT sync layer (stub for now)

export interface SyncPeer {
  id: string;
  connection: RTCPeerConnection | null;
}

export interface CRDTDocument {
  id: string;
  data: any;
  version: number;
}

export interface SyncEvent {
  type: string;
  data: any;
}

export interface SyncEngineConfig {
  roomId: string;
  onSync: (event: SyncEvent) => void;
}

export class SyncEngine {
  private peers: Map<string, SyncPeer> = new Map();
  private documents: Map<string, CRDTDocument> = new Map();
  private connected = false;
  private config: SyncEngineConfig;

  constructor(config: SyncEngineConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    // Stub: Will implement WebRTC connection logic
    console.log(`Connecting to room: ${this.config.roomId}`);
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    // Stub: Will implement disconnect logic
    console.log(`Disconnecting from room: ${this.config.roomId}`);
    this.connected = false;
  }

  async broadcast(type: string, data: any): Promise<void> {
    // Stub: Will implement broadcast logic
    console.log(`Broadcasting ${type}:`, data);
    
    // Simulate receiving own message for demo
    setTimeout(() => {
      this.config.onSync({ type, data: `Remote: ${data}` });
    }, 1000);
  }

  async sync(documentId: string): Promise<void> {
    // Stub: Will implement CRDT sync logic
    console.log(`Syncing document: ${documentId}`);
  }

  isConnected(): boolean {
    return this.connected;
  }
}

export function createSyncEngine(config: SyncEngineConfig): SyncEngine {
  return new SyncEngine(config);
}
