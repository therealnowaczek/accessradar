import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { contentHash, coverageHash, type StoredFact } from '../src/engine/facts';

describe('contentHash', () => {
  const facts: Array<Pick<StoredFact, 'kind' | 'fkey' | 'vhash'>> = [
    { kind: 'role', fkey: 'r2', vhash: 'bb' },
    { kind: 'group', fkey: 'g1', vhash: 'aa' },
    { kind: 'role', fkey: 'r1', vhash: 'cc' },
    { kind: 'project', fkey: 'p1', vhash: 'dd' },
  ];

  it('is independent of input order', () => {
    expect(contentHash(facts)).toBe(contentHash([...facts].reverse()));
  });

  it('sorts whole lines in JS, not by a SQL collation (":" vs digits, case, "_")', () => {
    // A case-insensitive or UCA collation orders these differently from JS; the hash must not.
    const tricky: Array<Pick<StoredFact, 'kind' | 'fkey' | 'vhash'>> = [
      { kind: 'grant', fkey: '10000:10001', vhash: '01' },
      { kind: 'grant', fkey: '100001:5', vhash: '02' },
      { kind: 'person', fkey: 'B-account', vhash: '03' },
      { kind: 'person', fkey: 'a-account', vhash: '04' },
      { kind: 'group_member', fkey: 'g_1:x', vhash: '05' },
      { kind: 'group_member', fkey: 'ga:x', vhash: '06' },
    ];
    const lines = tricky.map((f) => `${f.kind}\t${f.fkey}\t${f.vhash}`).sort();
    const expected = createHash('sha256').update(lines.join('\n'), 'utf8').digest('hex');
    expect(contentHash(tricky)).toBe(expected);
    expect(contentHash([...tricky].reverse())).toBe(expected);
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
