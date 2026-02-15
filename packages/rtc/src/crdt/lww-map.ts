import type {
  HLCTimestamp,
  LWWEntry,
  LWWMapState,
  CRDTChange,
} from '../types.js';
import { HLC, compareTimestamps } from './hlc.js';

/**
 * Last-Write-Wins Element Map (LWW-Map) CRDT.
 *
 * Each key maps to a value plus an HLC timestamp. When two peers write to
 * the same key, the write with the higher timestamp wins. Deletes are
 * represented as tombstones (deleted=true) so they propagate correctly.
 *
 * This CRDT is designed to mirror the structure of nearstack's Store
 * interface, where records are keyed by `id`.
 */
export class LWWMap<T = unknown> {
  private entries: Map<string, LWWEntry<T>> = new Map();
  private clock: HLC;
  private listeners: Set<() => void> = new Set();

  constructor(nodeId: string);
  constructor(clock: HLC);
  constructor(nodeIdOrClock: string | HLC) {
    this.clock =
      typeof nodeIdOrClock === 'string'
        ? new HLC(nodeIdOrClock)
        : nodeIdOrClock;
  }

  /** Set a key to a value, generating a new HLC timestamp. */
  set(key: string, value: T): CRDTChange<T> {
    const timestamp = this.clock.now();
    const entry: LWWEntry<T> = { value, timestamp, deleted: false };
    this.entries.set(key, entry);
    this.notify();
    return { key, value, timestamp, deleted: false };
  }

  /** Mark a key as deleted via tombstone. */
  delete(key: string): CRDTChange<T> | null {
    const existing = this.entries.get(key);
    if (!existing || existing.deleted) return null;

    const timestamp = this.clock.now();
    const entry: LWWEntry<T> = {
      value: existing.value,
      timestamp,
      deleted: true,
    };
    this.entries.set(key, entry);
    this.notify();
    return { key, value: existing.value, timestamp, deleted: true };
  }

  /** Get the value for a key, or undefined if missing/deleted. */
  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry || entry.deleted) return undefined;
    return entry.value;
  }

  /** Get the raw entry including tombstone info. */
  getEntry(key: string): LWWEntry<T> | undefined {
    return this.entries.get(key);
  }

  /** Get all live (non-deleted) entries as a plain object. */
  getAll(): Record<string, T> {
    const result: Record<string, T> = {};
    for (const [key, entry] of this.entries) {
      if (!entry.deleted) {
        result[key] = entry.value;
      }
    }
    return result;
  }

  /** Get all keys including tombstoned ones, with their timestamps. */
  getKnownEntries(): Record<string, HLCTimestamp> {
    const result: Record<string, HLCTimestamp> = {};
    for (const [key, entry] of this.entries) {
      result[key] = entry.timestamp;
    }
    return result;
  }

  /**
   * Apply a remote change. Returns true if the change was applied
   * (i.e., the remote timestamp was newer).
   */
  applyRemote(change: CRDTChange<T>): boolean {
    this.clock.receive(change.timestamp);

    const existing = this.entries.get(change.key);
    if (existing && compareTimestamps(existing.timestamp, change.timestamp) >= 0) {
      return false; // local version is newer or equal
    }

    this.entries.set(change.key, {
      value: change.value,
      timestamp: change.timestamp,
      deleted: change.deleted,
    });
    this.notify();
    return true;
  }

  /**
   * Merge a full remote state snapshot. Used during initial sync
   * when a new peer connects and requests the full document state.
   */
  merge(remoteEntries: Record<string, LWWEntry<T>>): CRDTChange<T>[] {
    const applied: CRDTChange<T>[] = [];

    for (const [key, remoteEntry] of Object.entries(remoteEntries)) {
      this.clock.receive(remoteEntry.timestamp);

      const local = this.entries.get(key);
      if (!local || compareTimestamps(local.timestamp, remoteEntry.timestamp) < 0) {
        this.entries.set(key, remoteEntry);
        applied.push({
          key,
          value: remoteEntry.value,
          timestamp: remoteEntry.timestamp,
          deleted: remoteEntry.deleted,
        });
      }
    }

    if (applied.length > 0) {
      this.notify();
    }
    return applied;
  }

  /**
   * Compute which entries the remote peer is missing or has stale
   * versions of, given the remote's known timestamps.
   */
  diffFrom(remoteKnown: Record<string, HLCTimestamp>): Record<string, LWWEntry<T>> {
    const missing: Record<string, LWWEntry<T>> = {};

    for (const [key, entry] of this.entries) {
      const remoteTs = remoteKnown[key];
      if (!remoteTs || compareTimestamps(entry.timestamp, remoteTs) > 0) {
        missing[key] = entry;
      }
    }

    return missing;
  }

  /** Export the full state for serialization. */
  toState(): LWWMapState<T> {
    const entries: Record<string, LWWEntry<T>> = {};
    for (const [key, entry] of this.entries) {
      entries[key] = entry;
    }
    return { entries };
  }

  /** Import state from a serialized snapshot. */
  fromState(state: LWWMapState<T>): void {
    this.merge(state.entries);
  }

  /** Subscribe to changes. Returns an unsubscribe function. */
  subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  get size(): number {
    let count = 0;
    for (const entry of this.entries.values()) {
      if (!entry.deleted) count++;
    }
    return count;
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
