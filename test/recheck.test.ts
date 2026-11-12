import { describe, expect, it } from 'vitest';
import {
  accessFingerprint,
  findStale,
  recheckBlockMessage,
  type DecidedItem,
} from '../src/engine/recheck';
import type { ReviewItemDraft } from '../src/engine/review';

const draft = (key: string, permissions: string[], pathCodes: string[]): ReviewItemDraft => ({
  itemKey: key,
  subjectType: 'user',
  subjectId: 'u1',
  projectId: 'p1',
  groupId: null,
  permissions,
  reasons: [],
  pathCodes,
  change: null,
  risk: 10,
});
const item = (over: Partial<DecidedItem> = {}): DecidedItem => ({
  idx: 0,
  itemKey: 'k1',
  permissions: ['ADMINISTER_PROJECTS'],
  pathCodes: ['direct'],
  change: 'unchanged',
  decision: 'keep',
  ackFp: null,
  ...over,
});
const cur = (...d: ReviewItemDraft[]) => new Map(d.map((x) => [x.itemKey, x]));

describe('accessFingerprint', () => {
  it('ignores order and duplicates', () => {
    expect(accessFingerprint(['B', 'A', 'A'], ['y', 'x'])).toBe(
      accessFingerprint(['A', 'B'], ['x', 'y']),
    );
  });
  it('changes with permissions or paths', () => {
    const base = accessFingerprint(['A'], ['x']);
    expect(accessFingerprint(['A', 'B'], ['x'])).not.toBe(base);
    expect(accessFingerprint(['A'], ['x', 'group:g'])).not.toBe(base);
  });
});

describe('findStale', () => {
  it('is empty when access is unchanged', () => {
    expect(findStale([item()], cur(draft('k1', ['ADMINISTER_PROJECTS'], ['direct'])))).toEqual([]);
  });
  it('flags a decision when permissions or paths changed', () => {
    const a = findStale(
      [item()],
      cur(draft('k1', ['ADMINISTER_PROJECTS', 'BROWSE_PROJECTS'], ['direct'])),
    );
    expect(a).toHaveLength(1);
    expect(a[0].currentPermissions).toContain('BROWSE_PROJECTS');
    expect(
      findStale([item()], cur(draft('k1', ['ADMINISTER_PROJECTS'], ['group:g']))),
    ).toHaveLength(1);
  });
  it('skips undecided, removed and vanished items', () => {
    const now = cur(draft('k1', ['X'], ['y']));
    expect(findStale([item({ decision: null })], now)).toEqual([]);
    expect(findStale([item({ change: 'removed' })], now)).toEqual([]);
    expect(findStale([item({ itemKey: 'gone' })], now)).toEqual([]);
  });
  it('a re-decision stores the current fingerprint, so the item is no longer stale', () => {
    const now = cur(draft('k1', ['X'], ['y']));
    const [s] = findStale([item()], now);
    expect(findStale([item({ ackFp: s.currentFp })], now)).toEqual([]);
    // ...until access changes again
    expect(
      findStale([item({ ackFp: s.currentFp })], cur(draft('k1', ['X', 'Z'], ['y']))),
    ).toHaveLength(1);
  });
  it('compares on the 20 path codes that are stored', () => {
    const codes = Array.from({ length: 25 }, (_, i) => `c${String(i).padStart(2, '0')}`);
    expect(
      findStale(
        [item({ permissions: ['X'], pathCodes: codes.slice(0, 20) })],
        cur(draft('k1', ['X'], codes)),
      ),
    ).toEqual([]);
  });
});

describe('recheckBlockMessage', () => {
  it('names the count and the way out', () => {
    expect(recheckBlockMessage(2)).toMatch(/^2 decision\(s\) need a recheck.*Decide them again/);
  });
});
