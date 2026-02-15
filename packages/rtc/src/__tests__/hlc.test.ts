import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HLC, compareTimestamps } from '../crdt/hlc.js';
import type { HLCTimestamp } from '../types.js';

describe('HLC', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('generates timestamps with the current wall-clock time', () => {
    const hlc = new HLC('node-a');
    const ts = hlc.now();

    expect(ts.time).toBe(1000);
    expect(ts.counter).toBe(0);
    expect(ts.nodeId).toBe('node-a');
  });

  it('increments counter for events at the same wall-clock time', () => {
    const hlc = new HLC('node-a');

    const ts1 = hlc.now();
    const ts2 = hlc.now();
    const ts3 = hlc.now();

    expect(ts1.counter).toBe(0);
    expect(ts2.counter).toBe(1);
    expect(ts3.counter).toBe(2);
    expect(ts1.time).toBe(ts2.time);
  });

  it('resets counter when wall clock advances', () => {
    const hlc = new HLC('node-a');

    hlc.now(); // counter = 0
    hlc.now(); // counter = 1

    vi.setSystemTime(2000);
    const ts = hlc.now();

    expect(ts.time).toBe(2000);
    expect(ts.counter).toBe(0);
  });

  it('merges remote timestamps and advances the clock', () => {
    const hlc = new HLC('node-a');

    const remote: HLCTimestamp = {
      time: 5000,
      counter: 3,
      nodeId: 'node-b',
    };

    const merged = hlc.receive(remote);

    // Remote time is higher than wall clock, so adopt remote time
    expect(merged.time).toBe(5000);
    expect(merged.counter).toBe(4); // remote counter + 1
    expect(merged.nodeId).toBe('node-a');
  });

  it('takes max of local and remote when both exceed wall clock', () => {
    const hlc = new HLC('node-a');

    // Advance local clock past wall clock
    const farFuture: HLCTimestamp = {
      time: 9000,
      counter: 2,
      nodeId: 'node-c',
    };
    hlc.receive(farFuture);

    // Now receive a timestamp with the same high time
    const remote: HLCTimestamp = {
      time: 9000,
      counter: 5,
      nodeId: 'node-b',
    };
    const merged = hlc.receive(remote);

    expect(merged.time).toBe(9000);
    // max(local counter after first receive, remote counter) + 1
    expect(merged.counter).toBe(6);
  });

  it('uses wall clock when it exceeds both local and remote', () => {
    const hlc = new HLC('node-a');

    vi.setSystemTime(99999);

    const remote: HLCTimestamp = {
      time: 500,
      counter: 10,
      nodeId: 'node-b',
    };
    const merged = hlc.receive(remote);

    expect(merged.time).toBe(99999);
    expect(merged.counter).toBe(0);
  });

  it('preserves monotonicity across receive calls', () => {
    const hlc = new HLC('node-a');

    const timestamps: HLCTimestamp[] = [];
    for (let i = 0; i < 10; i++) {
      timestamps.push(hlc.now());
    }

    for (let i = 1; i < timestamps.length; i++) {
      expect(compareTimestamps(timestamps[i - 1], timestamps[i])).toBeLessThan(0);
    }
  });
});

describe('compareTimestamps', () => {
  it('compares by time first', () => {
    const a: HLCTimestamp = { time: 100, counter: 5, nodeId: 'z' };
    const b: HLCTimestamp = { time: 200, counter: 0, nodeId: 'a' };

    expect(compareTimestamps(a, b)).toBeLessThan(0);
    expect(compareTimestamps(b, a)).toBeGreaterThan(0);
  });

  it('compares by counter when times are equal', () => {
    const a: HLCTimestamp = { time: 100, counter: 2, nodeId: 'z' };
    const b: HLCTimestamp = { time: 100, counter: 5, nodeId: 'a' };

    expect(compareTimestamps(a, b)).toBeLessThan(0);
    expect(compareTimestamps(b, a)).toBeGreaterThan(0);
  });

  it('compares by nodeId when time and counter are equal', () => {
    const a: HLCTimestamp = { time: 100, counter: 2, nodeId: 'alpha' };
    const b: HLCTimestamp = { time: 100, counter: 2, nodeId: 'beta' };

    expect(compareTimestamps(a, b)).toBeLessThan(0);
    expect(compareTimestamps(b, a)).toBeGreaterThan(0);
  });

  it('returns 0 for identical timestamps', () => {
    const a: HLCTimestamp = { time: 100, counter: 2, nodeId: 'node-a' };
    const b: HLCTimestamp = { time: 100, counter: 2, nodeId: 'node-a' };

    expect(compareTimestamps(a, b)).toBe(0);
  });
});
