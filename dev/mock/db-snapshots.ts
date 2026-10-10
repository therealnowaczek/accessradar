import { contentHash, stored, type StoredFact } from '../../src/engine/facts';
import { ENGINE_VERSION } from '../../src/engine/resolve';
import { siteFacts, withChanges } from '../../test/fixtures';
import type { CoverageEntry, SnapshotRow } from '../../src/db/snapshots.ts';

export type { SnapshotRow, SnapshotStatus } from '../../src/db/snapshots.ts';

const HOUR = 3600_000;
const DAY = 24 * HOUR;

/** Three committed snapshots built from the engine's synthetic site, each differing from the last. */
const base = siteFacts();
const facts = new Map<number, StoredFact<any>[]>();
facts.set(1, withChanges(base, [], ['grant:s1:6', 'group_member:g-devs:alice', 'person:ivan']));
facts.set(2, base);
facts.set(
  3,
  withChanges(
    base,
    [
      {
        kind: 'project',
        fkey: 'p3',
        attrs: {
          key: 'OPS',
          name: 'Operations',
          style: 'company',
          typeKey: 'business',
          schemeId: 's1',
        },
      },
      {
        kind: 'person',
        fkey: 'erin',
        attrs: { displayName: 'Erin', accountType: 'atlassian', active: true },
      },
      {
        kind: 'person',
        fkey: 'app-bot',
        attrs: { displayName: 'Deploy bot', accountType: 'app', active: true },
      },
      {
        kind: 'group_member',
        fkey: 'g-devs:erin',
        attrs: { groupId: 'g-devs', accountId: 'erin' },
      },
      {
        kind: 'grant',
        fkey: 's1:9',
        attrs: {
          schemeId: 's1',
          grantId: '9',
          permission: 'ADMINISTER_PROJECTS',
          holderType: 'group',
          holderParam: 'g-devs',
        },
      },
    ].map(stored),
    ['role_actor:p2:10007:user:bob'],
  ),
);

const coverage: Record<number, CoverageEntry[]> = {
  1: [],
  2: [
    {
      area: 'group-members',
      target: 'secret',
      status: 'unreadable',
      reason: 'Members of this group could not be read.',
    },
  ],
  3: [
    {
      area: 'group-members',
      target: 'secret',
      status: 'unreadable',
      reason: 'Members of this group could not be read.',
    },
    {
      area: 'issue-security',
      target: 'all',
      status: 'info',
      reason: 'Issue-level security is not part of this snapshot.',
    },
  ],
};

const snapshots = new Map<number, SnapshotRow>();
function seed(seq: number, startedAgo: number, status: SnapshotRow['status'] = 'complete') {
  const f = facts.get(seq) ?? [];
  snapshots.set(seq, {
    seq,
    status: seq === 2 ? 'partial' : status,
    trigger: seq === 1 ? 'onboarding' : 'scheduled',
    collectorMode: 'app',
    engineVersion: ENGINE_VERSION,
    startedAt: Date.now() - startedAgo,
    updatedAt: Date.now() - startedAgo + 90_000,
    finishedAt: Date.now() - startedAgo + 90_000,
    progress: null,
    coverage: coverage[seq] ?? [],
    stats: { project: 2 + (seq === 3 ? 1 : 0), group: 5, person: 5 + seq, grant: 8 + seq },
    points: 1800 + seq * 40,
    calls: 420 + seq * 11,
    contentHash: contentHash(f),
    error: null,
  });
}
seed(1, 8 * DAY);
seed(2, 3 * DAY);
seed(3, 12 * HOUR);

const strip = (s: SnapshotRow, withCoverage: boolean): SnapshotRow => ({
  ...s,
  coverage: withCoverage ? s.coverage : [],
});

export async function getSnapshot(seq: number, withCoverage = true) {
  const s = snapshots.get(seq);
  return s ? strip(s, withCoverage) : null;
}
export async function listSnapshots(limit = 200) {
  return [...snapshots.values()]
    .sort((a, b) => b.seq - a.seq)
    .slice(0, limit)
    .map((s) => strip(s, false));
}
const committed = () =>
  [...snapshots.values()].filter((s) => s.status === 'complete' || s.status === 'partial');
export async function latestCommitted() {
  const list = committed().sort((a, b) => b.seq - a.seq);
  return list[0] ? strip(list[0], true) : null;
}
export async function previousCommitted(seq: number) {
  const list = committed()
    .filter((s) => s.seq < seq)
    .sort((a, b) => b.seq - a.seq);
  return list[0] ? strip(list[0], false) : null;
}
export async function activeSnapshot() {
  const s = [...snapshots.values()].find((x) => x.status === 'queued' || x.status === 'running');
  return s ? strip(s, false) : null;
}
export async function loadFacts(seq: number) {
  return facts.get(seq) ?? [];
}

/** Dev helper for the collector mock: runs a fake snapshot that finishes after a few seconds. */
export function simulateSnapshot(trigger: string): number {
  const seq = Math.max(...snapshots.keys()) + 1;
  const now = Date.now();
  const latest = facts.get(Math.max(...facts.keys())) ?? [];
  facts.set(seq, latest);
  const row: SnapshotRow = {
    seq,
    status: 'running',
    trigger,
    collectorMode: 'app',
    engineVersion: ENGINE_VERSION,
    startedAt: now,
    updatedAt: now,
    finishedAt: null,
    progress: { step: 'PROJECTS', batch: 1, batches: 4, message: 'Reading projects' },
    coverage: coverage[3],
    stats: null,
    points: 0,
    calls: 0,
    contentHash: null,
    error: null,
  };
  snapshots.set(seq, row);
  const steps = ['DIRECTORY', 'GROUPS', 'GRANTS'];
  steps.forEach((step, i) =>
    setTimeout(
      () => {
        row.progress = { step, batch: i + 2, batches: 4, message: `Reading ${step.toLowerCase()}` };
        row.updatedAt = Date.now();
      },
      1500 * (i + 1),
    ),
  );
  setTimeout(() => {
    Object.assign(row, {
      status: 'complete',
      progress: null,
      finishedAt: Date.now(),
      updatedAt: Date.now(),
      contentHash: contentHash(latest),
      points: 1900,
      calls: 460,
    });
  }, 6500);
  return seq;
}
