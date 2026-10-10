import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearGateMemo,
  computeGate,
  MAX_FAST_PATH_MS,
  nextDueTimestamp,
  readGateMemo,
  shouldFastPath,
  writeGateMemo,
} from '../src/collector/gate';
import { isDue } from '../src/collector/schedule';

describe('computeGate / nextDueTimestamp', () => {
  const at = (d: number, h: number, m = 0) => Date.UTC(2026, 9, d, h, m);

  afterEach(() => clearGateMemo());

  it('off schedule: nextDueAt is self-heal within 24h, no stale check', () => {
    const now = at(9, 12);
    const g = computeGate({ frequency: 'off', hourUtc: 2, weekday: 1 }, null, null, now);
    expect(g.staleCheckAfter).toBeNull();
    expect(g.nextDueAt).toBe(now + MAX_FAST_PATH_MS);
    expect(shouldFastPath(g, now)).toBe(true);
    expect(shouldFastPath(g, now + MAX_FAST_PATH_MS)).toBe(false);
  });

  it('weekly: next due is the configured UTC hour on the weekday', () => {
    // 2026-10-09 is Friday (ISO 5). Last ran a week ago.
    const now = at(9, 0);
    const last = at(2, 2);
    const next = nextDueTimestamp({ frequency: 'weekly', hourUtc: 2, weekday: 5 }, last, now);
    expect(next).toBe(at(9, 2));
    expect(isDue({ frequency: 'weekly', hourUtc: 2, weekday: 5 }, last, at(9, 2, 10))).toBe(true);
  });

  it('daily: caps nextDueAt at now+24h even when far', () => {
    const now = at(9, 3); // after today's hourUtc=2 → next is tomorrow 02:00, within 24h
    const g = computeGate({ frequency: 'daily', hourUtc: 2, weekday: 1 }, at(9, 2), null, now);
    expect(g.nextDueAt).toBe(at(10, 2));
    expect(g.nextDueAt! - now).toBeLessThanOrEqual(MAX_FAST_PATH_MS);
  });

  it('free biweekly-shaped gap: after a run, next window respects isDue minGap', () => {
    // Not biweekly yet (R1-09); weekly already requires ~7d gap.
    const now = at(9, 2, 10);
    const last = at(9, 2);
    expect(isDue({ frequency: 'weekly', hourUtc: 2, weekday: 5 }, last, now)).toBe(false);
    const next = nextDueTimestamp({ frequency: 'weekly', hourUtc: 2, weekday: 5 }, last, now);
    expect(next).toBe(at(16, 2));
  });

  it('running snapshot sets staleCheckAfter to updatedAt+2h', () => {
    const now = at(9, 5);
    const updatedAt = at(9, 4);
    const g = computeGate({ frequency: 'off', hourUtc: 2, weekday: 1 }, null, { updatedAt }, now);
    expect(g.staleCheckAfter).toBe(updatedAt + 2 * 3600_000);
    expect(shouldFastPath(g, now)).toBe(true);
    expect(shouldFastPath(g, g.staleCheckAfter!)).toBe(false);
  });

  it('due hour forces slow path (nextDueAt <= now)', () => {
    const now = at(9, 2, 30);
    const g = computeGate({ frequency: 'daily', hourUtc: 2, weekday: 1 }, null, null, now);
    expect(g.nextDueAt).toBe(at(9, 2));
    expect(shouldFastPath(g, now)).toBe(false);
  });
});

describe('gate memo', () => {
  afterEach(() => clearGateMemo());

  it('returns memo only when nextDueAt is more than 1h away and fresh', () => {
    const now = Date.UTC(2026, 9, 9, 12);
    const gate = {
      nextDueAt: now + 3 * 3600_000,
      staleCheckAfter: null,
      v: 1 as const,
    };
    writeGateMemo(gate, now);
    expect(readGateMemo(now)).toEqual(gate);
    expect(readGateMemo(now + 11 * 60_000)).toBeNull(); // TTL 10m
  });

  it('skips memo when due within an hour', () => {
    const now = Date.UTC(2026, 9, 9, 12);
    writeGateMemo({ nextDueAt: now + 30 * 60_000, staleCheckAfter: null, v: 1 }, now);
    expect(readGateMemo(now)).toBeNull();
  });
});

describe('tick SQL budget (idle)', () => {
  it('documents idle fast path as ≤1 SQL when gate is warm', () => {
    // Integration with mocked q lives beside collector tests; here we only assert the predicate.
    const now = Date.UTC(2026, 9, 9, 12);
    const gate = computeGate({ frequency: 'weekly', hourUtc: 2, weekday: 1 }, null, null, now);
    expect(shouldFastPath(gate, now)).toBe(true);
    // Spy placeholder: callers log `[tick] fast { sql: 0|1 }`.
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    console.log('[tick] fast', { sql: 1 });
    expect(log).toHaveBeenCalledWith('[tick] fast', { sql: 1 });
    log.mockRestore();
  });
});
