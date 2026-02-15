import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyncEngine } from '../sync/engine.js';
import type {
  SignalingChannel,
  SignalingMessage,
  DataChannelMessage,
} from '../types.js';

/**
 * In-memory signaling channel for testing.
 * Routes messages between multiple peers without any network.
 */
class MockSignaling implements SignalingChannel {
  private handler: ((message: SignalingMessage) => void) | null = null;
  private peerId: string | null = null;
  private roomId: string | null = null;

  constructor(private hub: MockSignalingHub) {}

  send(message: SignalingMessage): void {
    this.hub.route(message, this);
  }

  onMessage(handler: (message: SignalingMessage) => void): void {
    this.handler = handler;
  }

  join(roomId: string, peerId: string): void {
    this.peerId = peerId;
    this.roomId = roomId;
    this.hub.register(this, roomId);

    this.send({
      type: 'join',
      senderId: peerId,
      roomId,
      payload: null,
    });
  }

  leave(): void {
    if (this.peerId && this.roomId) {
      this.send({
        type: 'leave',
        senderId: this.peerId,
        roomId: this.roomId,
        payload: null,
      });
    }
    this.hub.unregister(this);
  }

  dispose(): void {
    this.leave();
    this.handler = null;
  }

  deliver(message: SignalingMessage): void {
    if (message.senderId === this.peerId) return;
    if (message.targetId && message.targetId !== this.peerId) return;
    this.handler?.(message);
  }

  getPeerId(): string | null {
    return this.peerId;
  }
}

class MockSignalingHub {
  private channels: Map<string, Set<MockSignaling>> = new Map();

  createChannel(): MockSignaling {
    return new MockSignaling(this);
  }

  register(channel: MockSignaling, roomId: string): void {
    let room = this.channels.get(roomId);
    if (!room) {
      room = new Set();
      this.channels.set(roomId, room);
    }
    room.add(channel);
  }

  unregister(channel: MockSignaling): void {
    for (const room of this.channels.values()) {
      room.delete(channel);
    }
  }

  route(message: SignalingMessage, sender: MockSignaling): void {
    const room = this.channels.get(message.roomId);
    if (!room) return;

    for (const channel of room) {
      if (channel !== sender) {
        channel.deliver(message);
      }
    }
  }
}

describe('SyncEngine', () => {
  let hub: MockSignalingHub;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    hub = new MockSignalingHub();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a sync engine with a peer ID', () => {
    const signaling = hub.createChannel();
    const engine = new SyncEngine({
      peerId: 'peer-a',
      roomId: 'room-1',
      signaling,
    });

    expect(engine.getPeerId()).toBe('peer-a');
    expect(engine.isConnected()).toBe(false);
  });

  it('connects and disconnects', async () => {
    const signaling = hub.createChannel();
    const engine = new SyncEngine({
      peerId: 'peer-a',
      roomId: 'room-1',
      signaling,
    });

    await engine.connect();
    expect(engine.isConnected()).toBe(true);

    await engine.disconnect();
    expect(engine.isConnected()).toBe(false);
  });

  it('emits connected/disconnected events', async () => {
    const signaling = hub.createChannel();
    const engine = new SyncEngine({
      peerId: 'peer-a',
      roomId: 'room-1',
      signaling,
    });

    const events: string[] = [];
    engine.on((event) => events.push(event.type));

    await engine.connect();
    await engine.disconnect();

    expect(events).toEqual(['connected', 'disconnected']);
  });

  it('creates and interacts with documents', () => {
    const signaling = hub.createChannel();
    const engine = new SyncEngine({
      peerId: 'peer-a',
      roomId: 'room-1',
      signaling,
    });

    const doc = engine.document<{ id: string; text: string }>('todos');

    doc.set('todo-1', { id: 'todo-1', text: 'Buy milk' });
    doc.set('todo-2', { id: 'todo-2', text: 'Walk dog' });

    expect(doc.get('todo-1')).toEqual({ id: 'todo-1', text: 'Buy milk' });
    expect(doc.size).toBe(2);

    doc.delete('todo-1');
    expect(doc.get('todo-1')).toBeUndefined();
    expect(doc.size).toBe(1);
  });

  it('returns the same document handle for the same ID', () => {
    const signaling = hub.createChannel();
    const engine = new SyncEngine({
      peerId: 'peer-a',
      roomId: 'room-1',
      signaling,
    });

    const doc1 = engine.document('todos');
    doc1.set('key', 'value');

    const doc2 = engine.document('todos');
    expect(doc2.get('key')).toBe('value');
  });

  it('documents subscribe to changes', () => {
    const signaling = hub.createChannel();
    const engine = new SyncEngine({
      peerId: 'peer-a',
      roomId: 'room-1',
      signaling,
    });

    const doc = engine.document<string>('test');
    const callback = vi.fn();
    doc.subscribe(callback);

    doc.set('key', 'value');
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes event handlers', async () => {
    const signaling = hub.createChannel();
    const engine = new SyncEngine({
      peerId: 'peer-a',
      roomId: 'room-1',
      signaling,
    });

    const events: string[] = [];
    const unsub = engine.on((event) => events.push(event.type));

    await engine.connect();
    expect(events).toEqual(['connected']);

    unsub();
    await engine.disconnect();
    expect(events).toEqual(['connected']); // no 'disconnected'
  });

  it('dispose cleans up everything', async () => {
    const signaling = hub.createChannel();
    const engine = new SyncEngine({
      peerId: 'peer-a',
      roomId: 'room-1',
      signaling,
    });

    await engine.connect();
    engine.document('test').set('key', 'val');

    engine.dispose();
    expect(engine.isConnected()).toBe(false);
  });

  it('getState returns current document state', () => {
    const signaling = hub.createChannel();
    const engine = new SyncEngine({
      peerId: 'peer-a',
      roomId: 'room-1',
      signaling,
    });

    const doc = engine.document<{ id: string; done: boolean }>('todos');
    doc.set('t1', { id: 't1', done: false });
    doc.set('t2', { id: 't2', done: true });

    const state = doc.getState();
    expect(state).toEqual({
      t1: { id: 't1', done: false },
      t2: { id: 't2', done: true },
    });
  });

  it('toState exports CRDT state', () => {
    const signaling = hub.createChannel();
    const engine = new SyncEngine({
      peerId: 'peer-a',
      roomId: 'room-1',
      signaling,
    });

    const doc = engine.document<string>('test');
    doc.set('k', 'v');

    const state = doc.toState();
    expect(state.entries['k']).toBeDefined();
    expect(state.entries['k'].value).toBe('v');
    expect(state.entries['k'].deleted).toBe(false);
    expect(state.entries['k'].timestamp.nodeId).toBe('peer-a');
  });
});
