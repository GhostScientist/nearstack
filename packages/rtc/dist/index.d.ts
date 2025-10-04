export interface SyncPeer {
    id: string;
    connection: RTCPeerConnection | null;
}
export interface CRDTDocument {
    id: string;
    data: any;
    version: number;
}
export declare class SyncEngine {
    private peers;
    private documents;
    connect(peerId: string): Promise<void>;
    sync(documentId: string): Promise<void>;
    disconnect(peerId: string): Promise<void>;
}
export declare function createSyncEngine(): SyncEngine;
//# sourceMappingURL=index.d.ts.map