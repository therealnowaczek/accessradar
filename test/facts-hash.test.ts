import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { contentHash, contentHashUpdate, coverageHash, type StoredFact } from '../src/engine/facts';

describe('contentHash stream', () => {
  const facts: Array<Pick<StoredFact, 'kind' | 'fkey' | 'vhash'>> = [
    { kind: 'role', fkey: 'r2', vhash: 'bb' },
    { kind: 'group', fkey: 'g1', vhash: 'aa' },
    { kind: 'role', fkey: 'r1', vhash: 'cc' },
    { kind: 'project', fkey: 'p1', vhash: 'dd' },
  ];

  it('matches incremental update when facts are ordered by kind,fkey', () => {
    const ordered = [...facts].sort(
      (a, b) => a.kind.localeCompare(b.kind) || a.fkey.localeCompare(b.fkey),
    );
    const full = contentHash(facts);
    const hash = createHash('sha256');
    let started = false;
    // Two pages
    started = contentHashUpdate(hash, ordered.slice(0, 2), started);
    started = contentHashUpdate(hash, ordered.slice(2), started);
    expect(started).toBe(true);
    expect(hash.digest('hex')).toBe(full);
  });

  it('empty set hashes to sha256 of empty string', () => {
    expect(contentHash([])).toBe(createHash('sha256').update('', 'utf8').digest('hex'));
  });
});

describe('coverageHash', () => {
  it('is order-independent', () => {
    const a = [
      { area: 'x', target: '1', status: 'info', reason: 'a' },
      { area: 'y', target: '2', status: 'partial', reason: 'b' },
    ];
    expect(coverageHash(a)).toBe(coverageHash([...a].reverse()));
    expect(coverageHash(a)).not.toBe(coverageHash([a[0]]));
  });
});
