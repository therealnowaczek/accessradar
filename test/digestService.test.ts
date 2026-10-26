import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  listSnapshots: vi.fn(),
  kvGet: vi.fn(),
  kvSet: vi.fn(),
  push: vi.fn(),
  audit: vi.fn(),
}));

vi.mock('@forge/api', () => ({ default: {}, route: () => '', getAppContext: () => ({}) }));
vi.mock('../src/db/sql', () => ({ q: vi.fn(), exec: vi.fn(), limitClause: () => '' }));
vi.mock('../src/db/snapshots', async (orig) => ({
  ...(await orig<typeof import('../src/db/snapshots')>()),
  listSnapshots: m.listSnapshots,
}));
vi.mock('../src/db/settings', async (orig) => ({
  ...(await orig<typeof import('../src/db/settings')>()),
  kvGet: m.kvGet,
  kvSet: m.kvSet,
}));
vi.mock('../src/lib/queue', () => ({ push: m.push }));
vi.mock('../src/db/audit', () => ({ audit: m.audit, listAudit: vi.fn() }));

import { DIGEST_KV_KEY } from '../src/engine/digest';
import { requestWeeklyDigest, runWeeklyDigest, weeklyDigest } from '../src/api/service';

const NOW = 1_800_000_000_000;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('weekly digest service', () => {
  it('stores a no-snapshot digest when nothing is committed', async () => {
    m.listSnapshots.mockResolvedValue([{ seq: 1, startedAt: NOW - 1000, status: 'failed' }]);
    const d = await runWeeklyDigest(NOW);
    expect(d.status).toBe('no-snapshot');
    expect(m.kvSet).toHaveBeenCalledWith(DIGEST_KV_KEY, d);
    expect(m.audit).toHaveBeenCalledWith('system', 'digest.built', null, expect.any(Object));
  });

  it('stores a no-baseline digest with a single committed snapshot', async () => {
    m.listSnapshots.mockResolvedValue([
      { seq: 2, startedAt: NOW - 1000, status: 'complete' },
      { seq: 1, startedAt: NOW - 5000, status: 'running' },
    ]);
    const d = await runWeeklyDigest(NOW);
    expect(d.status).toBe('no-baseline');
    expect(d.head?.seq).toBe(2);
    expect(m.kvSet).toHaveBeenCalledWith(DIGEST_KV_KEY, d);
  });

  it('returns the stored digest and null for unknown versions', async () => {
    m.kvGet.mockResolvedValueOnce({ version: 1, status: 'ready' });
    expect((await weeklyDigest()).digest?.status).toBe('ready');
    m.kvGet.mockResolvedValueOnce({ version: 9 });
    expect((await weeklyDigest()).digest).toBeNull();
    m.kvGet.mockResolvedValueOnce(null);
    expect((await weeklyDigest()).digest).toBeNull();
  });

  it('queues a DIGEST step on refresh', async () => {
    await requestWeeklyDigest('acc-1');
    expect(m.push).toHaveBeenCalledWith(expect.objectContaining({ step: 'DIGEST' }));
    expect(m.audit).toHaveBeenCalledWith('acc-1', 'digest.requested', null, expect.anything());
  });
});
