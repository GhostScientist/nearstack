import type { HLCTimestamp } from '../types.js';

/**
 * Hybrid Logical Clock (HLC) implementation.
 *
 * Combines wall-clock time with a logical counter to produce monotonically
 * increasing timestamps even when wall clocks drift or move backwards.
 * Each node maintains its own HLC and merges incoming timestamps from
 * remote peers to maintain causal ordering.
 */
export class HLC {
  private time: number;
  private counter: number;
  private nodeId: string;

  constructor(nodeId: string) {
    this.nodeId = nodeId;
    this.time = 0;
    this.counter = 0;
  }

  /** Generate a new timestamp for a local event. */
  now(): HLCTimestamp {
    const wallClock = Date.now();

    if (wallClock > this.time) {
      this.time = wallClock;
      this.counter = 0;
    } else {
      this.counter++;
    }

    return { time: this.time, counter: this.counter, nodeId: this.nodeId };
  }

  /** Merge a remote timestamp and advance the local clock. */
  receive(remote: HLCTimestamp): HLCTimestamp {
    const wallClock = Date.now();
    const maxTime = Math.max(wallClock, this.time, remote.time);

    if (maxTime === this.time && maxTime === remote.time) {
      this.counter = Math.max(this.counter, remote.counter) + 1;
    } else if (maxTime === this.time) {
      this.counter++;
    } else if (maxTime === remote.time) {
      this.counter = remote.counter + 1;
    } else {
      // wallClock is the max
      this.counter = 0;
    }

    this.time = maxTime;
    return { time: this.time, counter: this.counter, nodeId: this.nodeId };
  }

  getNodeId(): string {
    return this.nodeId;
  }
}

/** Compare two HLC timestamps. Returns negative if a < b, positive if a > b, 0 if equal. */
export function compareTimestamps(a: HLCTimestamp, b: HLCTimestamp): number {
  if (a.time !== b.time) return a.time - b.time;
  if (a.counter !== b.counter) return a.counter - b.counter;
  return a.nodeId < b.nodeId ? -1 : a.nodeId > b.nodeId ? 1 : 0;
}
