import type {
  PeerConnectionState,
  PeerInfo,
  DataChannelMessage,
} from '../types.js';

const DATA_CHANNEL_LABEL = 'nearstack-sync';

export interface PeerConnectionCallbacks {
  onIceCandidate: (candidate: RTCIceCandidate) => void;
  onData: (data: DataChannelMessage) => void;
  onStateChange: (state: PeerConnectionState) => void;
}

/**
 * Wraps a single RTCPeerConnection and its data channel.
 *
 * Handles the WebRTC connection lifecycle: creating offers/answers,
 * exchanging ICE candidates, and sending/receiving data over the
 * RTCDataChannel.
 */
export class PeerConnection {
  private pc: RTCPeerConnection;
  private dc: RTCDataChannel | null = null;
  private state: PeerConnectionState = 'new';
  private pendingCandidates: RTCIceCandidate[] = [];

  constructor(
    readonly remotePeerId: string,
    private callbacks: PeerConnectionCallbacks,
    iceServers: RTCIceServer[] = []
  ) {
    this.pc = new RTCPeerConnection({
      iceServers:
        iceServers.length > 0
          ? iceServers
          : [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.callbacks.onIceCandidate(event.candidate);
      }
    };

    this.pc.onconnectionstatechange = () => {
      const rtcState = this.pc.connectionState;
      const mapped = this.mapState(rtcState);
      if (mapped !== this.state) {
        this.state = mapped;
        this.callbacks.onStateChange(mapped);
      }
    };

    this.pc.ondatachannel = (event) => {
      this.setupDataChannel(event.channel);
    };
  }

  /** Create an SDP offer (caller side). */
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    // Create the data channel before generating the offer so it's
    // included in the SDP negotiation.
    this.dc = this.pc.createDataChannel(DATA_CHANNEL_LABEL, {
      ordered: true,
    });
    this.setupDataChannel(this.dc);

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    return offer;
  }

  /** Handle a received SDP offer and create an answer (callee side). */
  async handleOffer(
    offer: RTCSessionDescriptionInit
  ): Promise<RTCSessionDescriptionInit> {
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
    this.flushPendingCandidates();

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    return answer;
  }

  /** Handle a received SDP answer (caller side). */
  async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
    this.flushPendingCandidates();
  }

  /** Add a received ICE candidate. */
  async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (this.pc.remoteDescription) {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } else {
      // Buffer candidates until remote description is set
      this.pendingCandidates.push(new RTCIceCandidate(candidate));
    }
  }

  /** Send data over the data channel. */
  send(message: DataChannelMessage): void {
    if (!this.dc || this.dc.readyState !== 'open') return;
    this.dc.send(JSON.stringify(message));
  }

  /** Get current connection info. */
  getInfo(): PeerInfo {
    return {
      id: this.remotePeerId,
      state: this.state,
      connection: this.pc,
      dataChannel: this.dc,
    };
  }

  /** Close the connection and clean up. */
  close(): void {
    if (this.dc) {
      this.dc.onopen = null;
      this.dc.onmessage = null;
      this.dc.onclose = null;
      this.dc.close();
      this.dc = null;
    }
    this.pc.onicecandidate = null;
    this.pc.onconnectionstatechange = null;
    this.pc.ondatachannel = null;
    this.pc.close();
    this.state = 'closed';
  }

  private setupDataChannel(channel: RTCDataChannel): void {
    this.dc = channel;

    channel.onopen = () => {
      this.state = 'connected';
      this.callbacks.onStateChange('connected');
    };

    channel.onmessage = (event: MessageEvent) => {
      try {
        const data: DataChannelMessage = JSON.parse(event.data as string);
        this.callbacks.onData(data);
      } catch {
        // Ignore malformed messages
      }
    };

    channel.onclose = () => {
      if (this.state !== 'closed') {
        this.state = 'disconnected';
        this.callbacks.onStateChange('disconnected');
      }
    };
  }

  private flushPendingCandidates(): void {
    for (const candidate of this.pendingCandidates) {
      this.pc.addIceCandidate(candidate).catch(() => {
        // Candidate may be stale
      });
    }
    this.pendingCandidates = [];
  }

  private mapState(rtcState: RTCPeerConnectionState): PeerConnectionState {
    switch (rtcState) {
      case 'new':
        return 'new';
      case 'connecting':
        return 'connecting';
      case 'connected':
        return 'connected';
      case 'disconnected':
        return 'disconnected';
      case 'failed':
        return 'failed';
      case 'closed':
        return 'closed';
      default:
        return 'new';
    }
  }
}
