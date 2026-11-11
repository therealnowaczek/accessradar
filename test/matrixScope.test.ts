/** accessMatrix with `projectKey` builds one space on the server (E2E 2.2 space export). */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { siteFacts } from './fixtures';

const m = vi.hoisted(() => ({ latestCommitted: vi.fn(), loadFacts: vi.fn() }));

vi.mock('@forge/api', () => ({ default: {}, route: () => '', getAppContext: () => ({}) }));
vi.mock('../src/db/sql', () => ({ q: vi.fn(), exec: vi.fn(), limitClause: () => '' }));
vi.mock('../src/db/snapshots', async (orig) => ({
  ...(await orig<typeof import('../src/db/snapshots')>()),
  latestCommitted: m.latestCommitted,
  loadFacts: m.loadFacts,
}));

import { matrix } from '../src/api/service';

const snap = {
  seq: 7,
  status: 'complete',
  startedAt: 1,
  finishedAt: 2,
  updatedAt: 2,
  stats: {},
  coverage: [],
};

describe('accessMatrix space scope', () => {
  beforeEach(() => {
    m.latestCommitted.mockResolvedValue(snap);
    m.loadFacts.mockResolvedValue(siteFacts());
  });

  it('returns only the requested space (key is case-insensitive)', async () => {
    const all = (await matrix({ allPermissions: true })).data!;
    const key = all[0].project_key;
    const one = (await matrix({ allPermissions: true, projectKey: key.toLowerCase() })).data!;
    expect(one.length).toBeGreaterThan(0);
    expect(one.every((r) => r.project_key === key)).toBe(true);
    expect(one).toEqual(all.filter((r) => r.project_key === key));
    expect(new Set(all.map((r) => r.project_key)).size).toBeGreaterThan(1);
  });

  it('validates the key and rejects a space that is not in the snapshot', async () => {
    await expect(matrix({ projectKey: 'NO SUCH; DROP' })).rejects.toThrow('Invalid space key');
    await expect(matrix({ projectKey: 'NOPE' })).rejects.toThrow('Space not in this snapshot');
    await expect(matrix({ keyPermissions: ['BROWSE PROJECTS!'] })).rejects.toThrow(
      'Invalid permission',
    );
  });
});
