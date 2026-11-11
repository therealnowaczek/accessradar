/**
 * Deep verify ("Check snapshot integrity") must recompute exactly the hash that FINALIZE stored on
 * the snapshot, the value the review signature binds. Regression for E2E 2.6 (phase 1): a signed
 * review on snapshot #34 showed "Mismatch" because verify paged with limitClause(3000), which
 * clamps to LIMIT 1000, and stopped after the first page (1000 < 3000).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { factVersionHash, type FactKind } from '../src/engine/facts';
import { featureFlags } from '../src/domain/edition';

type FactRow = {
  id: number;
  kind: string;
  fkey: string;
  vhash: string;
  first_seen: number;
  last_seen: number;
};

const m = vi.hoisted(() => ({
  table: [] as FactRow[],
  jobs: new Map<string, Record<string, unknown>>(),
  snaps: new Map<number, { seq: number; contentHash: string | null }>(),
  push: vi.fn(),
  audit: vi.fn(),
  background: vi.fn(),
}));

/** Fake Forge SQL for the fact table: honours the seq interval, `id > ?` and the LIMIT literal. */
function fakeQ(sql: string, ...args: unknown[]) {
  if (/FROM fact WHERE first_seen <= \? AND last_seen >= \? AND id > \?/.test(sql)) {
    const [a, b, after] = args as number[];
    const limit = Number(/LIMIT (\d+)/.exec(sql)![1]);
    return Promise.resolve(
      m.table
        .filter((r) => r.first_seen <= a && r.last_seen >= b && r.id > after)
        .sort((x, y) => x.id - y.id)
        .slice(0, limit)
        .map(({ id, kind, fkey, vhash }) => ({ id, kind, fkey, vhash })),
    );
  }
  throw new Error(`unexpected query ${sql}`);
}

vi.mock('@forge/api', () => ({ default: {}, route: () => '', getAppContext: () => ({}) }));
vi.mock('../src/db/sql', async (orig) => ({
  ...(await orig<typeof import('../src/db/sql')>()),
  q: (sql: string, ...args: unknown[]) => fakeQ(sql, ...args),
  exec: vi.fn(),
}));
vi.mock('../src/db/verify', async (orig) => ({
  ...(await orig<typeof import('../src/db/verify')>()),
  getVerifyJob: async (id: string) => m.jobs.get(id) ?? null,
  patchVerifyJob: async (id: string, patch: Record<string, unknown>) => {
    m.jobs.set(id, { ...m.jobs.get(id), ...patch });
  },
}));
vi.mock('../src/db/snapshots', async (orig) => ({
  ...(await orig<typeof import('../src/db/snapshots')>()),
  getSnapshot: async (seq: number) => m.snaps.get(seq) ?? null,
}));
vi.mock('../src/lib/queue', () => ({ push: m.push }));
vi.mock('../src/db/audit', () => ({ audit: m.audit, listAudit: vi.fn() }));
vi.mock('../src/api/edition', () => ({ backgroundEdition: m.background }));

import { computeContentHash } from '../src/db/snapshots';
import { runVerifySnapshotJob } from '../src/api/service';

const advanced = {
  edition: 'advanced',
  source: 'license',
  features: featureFlags('advanced'),
  override: null,
  canOverride: false,
} as const;

let nextId = 1;
function addFact(kind: FactKind, fkey: string, attrs: unknown, first: number, last: number) {
  m.table.push({
    id: nextId++,
    kind,
    fkey,
    vhash: factVersionHash(kind, attrs),
    first_seen: first,
    last_seen: last,
  });
}

/** A site with `n` facts valid at snapshot 34, inserted in an id order unrelated to kind/fkey. */
function seedSnapshot34(n: number) {
  const kinds: FactKind[] = ['person', 'grant', 'group_member', 'role_actor', 'group', 'project'];
  const order = Array.from({ length: n }, (_, i) => i).sort(
    (a, b) => ((a * 7919) % n) - ((b * 7919) % n),
  );
  for (const i of order) {
    const kind = kinds[i % kinds.length];
    // Mixed lengths and case: "10000:7" vs "100001:3" and "Ab" vs "ab" order differently
    // under SQL collations than under a JS line sort.
    const fkey = i % 3 ? `${10000 + (i % 17)}:${i}` : `${i % 2 ? 'A' : 'a'}cc-${i}`;
    addFact(kind, fkey, { i }, 30, 34);
  }
}

async function signAndVerify(seq: number) {
  // Sign time: FINALIZE stored this on the snapshot; the review evidence embeds it.
  const signed = await computeContentHash(seq);
  m.snaps.set(seq, { seq, contentHash: signed });
  const jobId = `job-${seq}-${m.jobs.size}`;
  m.jobs.set(jobId, { id: jobId, reviewId: 'r1', seq, status: 'pending', expectedHash: signed });
  return { signed, jobId };
}

describe('deep verify recomputes the signed snapshot hash', () => {
  beforeEach(() => {
    m.table.length = 0;
    m.jobs.clear();
    m.snaps.clear();
    nextId = 1;
    m.background.mockResolvedValue(advanced);
  });

  it.each([5, 999, 1000, 1001, 2500, 3000, 7001])(
    'same payload, sign then verify: OK with %i facts (page boundaries)',
    async (n) => {
      seedSnapshot34(n);
      const { signed, jobId } = await signAndVerify(34);
      await runVerifySnapshotJob(jobId);
      const job = m.jobs.get(jobId)!;
      expect(job.actualHash).toBe(signed);
      expect(job.status).toBe('ok');
    },
  );

  it('verifies the review snapshot N while a later snapshot N+1 exists', async () => {
    seedSnapshot34(1800);
    const { signed, jobId } = await signAndVerify(34);
    // Snapshot 35: most facts extended, one changed (new version), one removed, one added.
    for (const r of m.table) if (r.id % 5) r.last_seen = 35;
    const changed = m.table.find((r) => r.last_seen === 35)!;
    addFact(changed.kind as FactKind, changed.fkey, { changed: true }, 35, 35);
    addFact('person', 'new-person-35', { n: 1 }, 35, 35);
    const later = await computeContentHash(35);
    expect(later).not.toBe(signed);

    await runVerifySnapshotJob(jobId);
    expect(m.jobs.get(jobId)).toMatchObject({ status: 'ok', actualHash: signed });
  });

  it('still reports a real mismatch when a fact of the signed snapshot changed', async () => {
    seedSnapshot34(1200);
    const { signed, jobId } = await signAndVerify(34);
    m.table[600].vhash = 'ffffffffffffffff';
    await runVerifySnapshotJob(jobId);
    const job = m.jobs.get(jobId)!;
    expect(job.status).toBe('mismatch');
    expect(job.actualHash).not.toBe(signed);
  });

  it('reports purged when retention removed the facts and the snapshot hash', async () => {
    m.snaps.set(12, { seq: 12, contentHash: null });
    m.jobs.set('job-p', { id: 'job-p', reviewId: 'r1', seq: 12, status: 'pending' });
    await runVerifySnapshotJob('job-p');
    expect(m.jobs.get('job-p')!.status).toBe('purged');
  });
});
