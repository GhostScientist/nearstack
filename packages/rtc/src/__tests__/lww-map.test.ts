import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LWWMap } from '../crdt/lww-map.js';
import { HLC } from '../crdt/hlc.js';
import type { CRDTChange } from '../types.js';

describe('LWWMap', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('basic operations', () => {
    it('sets and gets values', () => {
      const map = new LWWMap<string>('node-a');

      map.set('key1', 'value1');
      map.set('key2', 'value2');

      expect(map.get('key1')).toBe('value1');
      expect(map.get('key2')).toBe('value2');
      expect(map.size).toBe(2);
    });

    it('overwrites existing values', () => {
      const map = new LWWMap<string>('node-a');

      map.set('key1', 'first');
      map.set('key1', 'second');

      expect(map.get('key1')).toBe('second');
      expect(map.size).toBe(1);
    });

    it('returns undefined for missing keys', () => {
      const map = new LWWMap<string>('node-a');
      expect(map.get('missing')).toBeUndefined();
    });

    it('deletes values via tombstone', () => {
      const map = new LWWMap<string>('node-a');

      map.set('key1', 'value1');
      map.delete('key1');

      expect(map.get('key1')).toBeUndefined();
      expect(map.size).toBe(0);
    });

    it('delete returns null for missing keys', () => {
      const map = new LWWMap<string>('node-a');
      expect(map.delete('missing')).toBeNull();
    });

    it('delete returns null for already-deleted keys', () => {
      const map = new LWWMap<string>('node-a');
      map.set('key1', 'value1');
      map.delete('key1');
      expect(map.delete('key1')).toBeNull();
    });

    it('getAll returns only live entries', () => {
      const map = new LWWMap<string>('node-a');

      map.set('a', '1');
      map.set('b', '2');
      map.set('c', '3');
      map.delete('b');

      const all = map.getAll();
      expect(all).toEqual({ a: '1', c: '3' });
    });

    it('returns a CRDTChange on set', () => {
      const map = new LWWMap<string>('node-a');
      const change = map.set('key1', 'value1');

      expect(change.key).toBe('key1');
      expect(change.value).toBe('value1');
      expect(change.deleted).toBe(false);
      expect(change.timestamp.nodeId).toBe('node-a');
    });

    it('returns a CRDTChange on delete', () => {
      const map = new LWWMap<string>('node-a');
      map.set('key1', 'value1');
      const change = map.delete('key1');

      expect(change).not.toBeNull();
      expect(change!.key).toBe('key1');
      expect(change!.deleted).toBe(true);
    });
  });

  describe('conflict resolution', () => {
    it('accepts remote changes with newer timestamps', () => {
      const map = new LWWMap<string>('node-a');

      map.set('key1', 'local');

      const remoteChange: CRDTChange<string> = {
        key: 'key1',
        value: 'remote',
        timestamp: { time: 2000, counter: 0, nodeId: 'node-b' },
        deleted: false,
      };

      const applied = map.applyRemote(remoteChange);
      expect(applied).toBe(true);
      expect(map.get('key1')).toBe('remote');
    });

    it('rejects remote changes with older timestamps', () => {
      const map = new LWWMap<string>('node-a');

      vi.setSystemTime(5000);
      map.set('key1', 'local');

      const remoteChange: CRDTChange<string> = {
        key: 'key1',
        value: 'remote',
        timestamp: { time: 1000, counter: 0, nodeId: 'node-b' },
        deleted: false,
      };

      const applied = map.applyRemote(remoteChange);
      expect(applied).toBe(false);
      expect(map.get('key1')).toBe('local');
    });

    it('uses nodeId to break ties at same time and counter', () => {
      const map = new LWWMap<string>('node-b');

      map.set('key1', 'local-b');

      // node-z > node-b lexicographically, so this should win
      const remoteChange: CRDTChange<string> = {
        key: 'key1',
        value: 'remote-z',
        timestamp: { time: 1000, counter: 0, nodeId: 'node-z' },
        deleted: false,
      };

      const applied = map.applyRemote(remoteChange);
      expect(applied).toBe(true);
      expect(map.get('key1')).toBe('remote-z');
    });

    it('remote delete overwrites local value with newer timestamp', () => {
      const map = new LWWMap<string>('node-a');

      map.set('key1', 'local');

      const remoteDelete: CRDTChange<string> = {
        key: 'key1',
        value: 'local',
        timestamp: { time: 5000, counter: 0, nodeId: 'node-b' },
        deleted: true,
      };

      map.applyRemote(remoteDelete);
      expect(map.get('key1')).toBeUndefined();
      expect(map.size).toBe(0);
    });
  });

  describe('merge', () => {
    it('merges a full remote state snapshot', () => {
      const map = new LWWMap<string>('node-a');
      map.set('local-key', 'local-value');

      const applied = map.merge({
        'remote-key1': {
          value: 'rv1',
          timestamp: { time: 2000, counter: 0, nodeId: 'node-b' },
          deleted: false,
        },
        'remote-key2': {
          value: 'rv2',
          timestamp: { time: 2000, counter: 1, nodeId: 'node-b' },
          deleted: false,
        },
      });

      expect(applied).toHaveLength(2);
      expect(map.get('remote-key1')).toBe('rv1');
      expect(map.get('remote-key2')).toBe('rv2');
      expect(map.get('local-key')).toBe('local-value');
      expect(map.size).toBe(3);
    });

    it('merge skips entries where local is newer', () => {
      const map = new LWWMap<string>('node-a');

      vi.setSystemTime(5000);
      map.set('key1', 'local-newer');

      const applied = map.merge({
        key1: {
          value: 'remote-older',
          timestamp: { time: 1000, counter: 0, nodeId: 'node-b' },
          deleted: false,
        },
      });

      expect(applied).toHaveLength(0);
      expect(map.get('key1')).toBe('local-newer');
    });
  });

  describe('diffFrom', () => {
    it('returns entries the remote is missing', () => {
      const map = new LWWMap<string>('node-a');

      map.set('key1', 'v1');
      map.set('key2', 'v2');
      map.set('key3', 'v3');

      const diff = map.diffFrom({
        key1: { time: 1000, counter: 0, nodeId: 'node-a' },
        // key2 and key3 not known by remote
      });

      expect(Object.keys(diff)).toContain('key2');
      expect(Object.keys(diff)).toContain('key3');
      expect(Object.keys(diff)).not.toContain('key1');
    });

    it('returns entries where local is newer', () => {
      const map = new LWWMap<string>('node-a');

      vi.setSystemTime(5000);
      map.set('key1', 'updated');

      const diff = map.diffFrom({
        key1: { time: 1000, counter: 0, nodeId: 'node-b' },
      });

      expect(Object.keys(diff)).toContain('key1');
      expect(diff['key1'].value).toBe('updated');
    });
  });

  describe('state serialization', () => {
    it('round-trips through toState/fromState', () => {
      const map1 = new LWWMap<string>('node-a');
      map1.set('a', '1');
      map1.set('b', '2');
      map1.delete('b');

      const state = map1.toState();

      const map2 = new LWWMap<string>('node-b');
      map2.fromState(state);

      expect(map2.get('a')).toBe('1');
      expect(map2.get('b')).toBeUndefined();
      expect(map2.getEntry('b')?.deleted).toBe(true);
    });
  });

  describe('subscriptions', () => {
    it('notifies on set', () => {
      const map = new LWWMap<string>('node-a');
      const callback = vi.fn();

      map.subscribe(callback);
      map.set('key1', 'value1');

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('notifies on delete', () => {
      const map = new LWWMap<string>('node-a');
      map.set('key1', 'value1');

      const callback = vi.fn();
      map.subscribe(callback);
      map.delete('key1');

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('notifies on applyRemote when change is applied', () => {
      const map = new LWWMap<string>('node-a');
      const callback = vi.fn();
      map.subscribe(callback);

      map.applyRemote({
        key: 'key1',
        value: 'remote',
        timestamp: { time: 2000, counter: 0, nodeId: 'node-b' },
        deleted: false,
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('does not notify on applyRemote when change is rejected', () => {
      const map = new LWWMap<string>('node-a');

      vi.setSystemTime(5000);
      map.set('key1', 'local');

      const callback = vi.fn();
      map.subscribe(callback);

      map.applyRemote({
        key: 'key1',
        value: 'remote',
        timestamp: { time: 1000, counter: 0, nodeId: 'node-b' },
        deleted: false,
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it('unsubscribes correctly', () => {
      const map = new LWWMap<string>('node-a');
      const callback = vi.fn();

      const unsub = map.subscribe(callback);
      map.set('key1', 'v1');
      expect(callback).toHaveBeenCalledTimes(1);

      unsub();
      map.set('key2', 'v2');
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('shared HLC', () => {
    it('accepts an HLC instance for shared clocks', () => {
      const clock = new HLC('shared-node');
      const map = new LWWMap<string>(clock);

      const change = map.set('key1', 'value1');
      expect(change.timestamp.nodeId).toBe('shared-node');
    });
  });
});
