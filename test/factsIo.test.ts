import { beforeEach, describe, expect, it, vi } from 'vitest';

const { qMock, execMock } = vi.hoisted(() => ({ qMock: vi.fn(), execMock: vi.fn() }));

vi.mock('../src/db/sql', async (orig) => {
  const real = await orig<typeof import('../src/db/sql')>();
  return {
    ...real,
    q: (...args: unknown[]) => qMock(...args),
    exec: (...args: unknown[]) => execMock(...args),
  };
});

import { contentHash, factVersionHash } from '../src/engine/facts';
import {
  computeContentHash,
  idRanges,
  invalidateFactCache,
  loadFacts,
  mergeStage,
} from '../src/db/snapshots';
import { asStored, mergeOrder } from '../src/collector/steps';

type Row = { id: number; kind: string; fkey: string; vhash: string; attrs: string };

/** Fake fact table: answers the MIN/MAX bounds query and id-range pages like the SQL would. */
function fakeFactTable(rows: Row[]) {
  qMock.mockImplementation(async (sql: string, ...args: number[]) => {
    if (sql.startsWith('SELECT MIN(id)'))
      return [
        {
          lo: rows.length ? Math.min(...rows.map((r) => r.id)) : null,
          hi: rows.length ? Math.max(...rows.map((r) => r.id)) : null,
        },
      ];
    if (sql.includes('FROM fact WHERE first_seen')) {
      const [, , after, hi] = args;
      const limit = Number(/LIMIT (\d+)/.exec(sql)![1]);
      return rows
        .filter((r) => r.id > after && (hi === undefined || r.id <= hi))
        .sort((a, b) => a.id - b.id)
        .slice(0, limit)
        .map((r) =>
          sql.includes('attrs') ? r : { id: r.id, kind: r.kind, fkey: r.fkey, vhash: r.vhash },
        );
    }
    throw new Error(`unexpected query ${sql}`);
  });
}

const makeRows = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    kind: i % 2 ? 'person' : 'group',
    fkey: `k${String(n - i).padStart(6, '0')}`,
    vhash: `h${i}`,
    attrs: JSON.stringify({ i }),
  }));

describe('idRanges', () => {
  it('covers every id exactly once', () => {
    const ranges = idRanges(1, 20_000, 4);
    expect(ranges).toHaveLength(4);
    expect(ranges[0][0]).toBe(0);
    expect(ranges[ranges.length - 1][1]).toBe(20_000);
    for (let i = 1; i < ranges.length; i++) expect(ranges[i][0]).toBe(ranges[i - 1][1]);
  });
  it('uses a single range for small tables', () => {
    expect(idRanges(5, 100, 4)).toEqual([[4, 100]]);
  });
  it('returns nothing for an empty table', () => {
    expect(idRanges(10, 5, 4)).toEqual([]);
  });
});

describe('loadFacts', () => {
  beforeEach(() => {
    qMock.mockReset();
    execMock.mockReset();
    invalidateFactCache();
  });

  it('reads big snapshots in parallel id ranges and keeps id order', async () => {
    const rows = makeRows(10_000);
    fakeFactTable(rows);
    const facts = await loadFacts(3);
    expect(facts).toHaveLength(10_000);
    expect(facts.map((f) => f.attrs.i)).toEqual(rows.map((_, i) => i));
    const pageCalls = qMock.mock.calls.filter(([sql]) => String(sql).includes('id <= ?'));
    expect(pageCalls.length).toBeGreaterThanOrEqual(4);
  });

  it('concurrent callers share one load, later callers hit the cache', async () => {
    fakeFactTable(makeRows(50));
    const [a, b] = await Promise.all([loadFacts(1), loadFacts(1)]);
    expect(a).toBe(b);
    const calls = qMock.mock.calls.length;
    expect(await loadFacts(1)).toBe(a);
    expect(qMock.mock.calls.length).toBe(calls);
  });

  it('does not cache a load that raced with an invalidation', async () => {
    fakeFactTable(makeRows(10));
    const p = loadFacts(2);
    invalidateFactCache();
    const first = await p;
    const second = await loadFacts(2);
    expect(second).not.toBe(first);
  });
});

describe('computeContentHash', () => {
  beforeEach(() => {
    qMock.mockReset();
    invalidateFactCache();
  });

  it('hashes kind/fkey/vhash without reading attrs and matches contentHash', async () => {
    const rows = makeRows(7000);
    fakeFactTable(rows);
    const hash = await computeContentHash(4);
    expect(hash).toBe(contentHash(rows as unknown as Parameters<typeof contentHash>[0]));
    for (const [sql] of qMock.mock.calls) expect(String(sql)).not.toMatch(/attrs/);
  });
});

describe('mergeStage with rows already in memory', () => {
  beforeEach(() => {
    qMock.mockReset();
    execMock.mockReset().mockResolvedValue(1);
    invalidateFactCache();
  });

  it('does not re-read the stage and writes the same facts', async () => {
    const same = { name: 'Admins' };
    const open = [
      { id: 1, kind: 'group', fkey: 'g1', vhash: factVersionHash('group', same), last_seen: 4 },
      { id: 2, kind: 'group', fkey: 'g2', vhash: 'old', last_seen: 4 },
      { id: 3, kind: 'group_member', fkey: 'g9:acc', vhash: 'x', last_seen: 4 },
    ];
    qMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM stage')) throw new Error('stage must not be read again');
      if (sql.includes('last_seen IN')) return open;
      return [];
    });
    const r = await mergeStage(5, 4, [
      { kind: 'group', fkey: 'g1', attrs: same },
      { kind: 'group', fkey: 'g2', attrs: { name: 'Renamed' } },
      { kind: 'coverage', fkey: 'c', attrs: {} },
      { kind: 'carry', fkey: 'group_member:g9:', attrs: {} },
    ]);
    expect(r).toEqual({ extended: 1, inserted: 1, carried: 1, facts: 3 });
    const update = execMock.mock.calls.find(([sql]) => String(sql).startsWith('UPDATE fact'));
    expect(update!.slice(1)).toEqual([5, 1, 3]);
    const insert = execMock.mock.calls.find(([sql]) => String(sql).startsWith('INSERT IGNORE'));
    expect(insert!.slice(1, 5)).toEqual([
      'group',
      'g2',
      factVersionHash('group', { name: 'Renamed' }),
      JSON.stringify({ name: 'Renamed' }),
    ]);
  });
});

describe('finalize merge input', () => {
  it('stores extra facts exactly as a stage round trip would', () => {
    const long = 'x'.repeat(500);
    const f = asStored({ kind: 'person', fkey: long, attrs: { a: 1, gone: undefined } });
    expect(f.fkey).toHaveLength(400);
    expect(f.attrs).toEqual({ a: 1 });
    expect('gone' in f.attrs).toBe(false);
  });

  it('orders rows by kind then fkey like readStage', () => {
    const rows = mergeOrder([
      { kind: 'person', fkey: 'b' },
      { kind: 'group', fkey: 'z' },
      { kind: 'person', fkey: 'B' },
      { kind: 'group_member', fkey: 'a' },
    ]);
    expect(rows.map((r) => `${r.kind}:${r.fkey}`)).toEqual([
      'group:z',
      'group_member:a',
      'person:B',
      'person:b',
    ]);
  });
});
