import { beforeEach, describe, expect, it, vi } from 'vitest';
import { siteFacts } from './fixtures';

const m = vi.hoisted(() => ({
  findOpen: vi.fn(),
  insertAssignment: vi.fn(),
  insertReview: vi.fn(),
  latest: vi.fn(),
  prev: vi.fn(),
  loadFacts: vi.fn(),
}));

vi.mock('@forge/api', () => ({ default: {}, route: () => '', getAppContext: () => ({}) }));
vi.mock('../src/db/sql', () => ({
  q: vi.fn(async () => []),
  exec: vi.fn(),
  limitClause: () => '',
}));
vi.mock('../src/db/campaigns', async (orig) => ({
  ...(await orig<typeof import('../src/db/campaigns')>()),
  findOpenAssignmentForProject: m.findOpen,
  insertAssignment: m.insertAssignment,
}));
vi.mock('../src/db/reviews', async (orig) => ({
  ...(await orig<typeof import('../src/db/reviews')>()),
  insertReview: m.insertReview,
}));
vi.mock('../src/db/snapshots', async (orig) => ({
  ...(await orig<typeof import('../src/db/snapshots')>()),
  latestCommitted: m.latest,
  previousCommitted: m.prev,
  loadFacts: m.loadFacts,
}));
vi.mock('../src/db/exceptions', async (orig) => ({
  ...(await orig<typeof import('../src/db/exceptions')>()),
  expireExceptions: vi.fn(),
  activeExceptionsForKeys: vi.fn(async () => new Map()),
}));
vi.mock('../src/db/settings', async (orig) => ({
  ...(await orig<typeof import('../src/db/settings')>()),
  getSettings: vi.fn(async () => ({ keyPermissions: ['BROWSE_PROJECTS', 'EDIT_ISSUES'] })),
}));
vi.mock('../src/db/audit', async (orig) => ({
  ...(await orig<typeof import('../src/db/audit')>()),
  audit: vi.fn(),
}));

import { BadRequest, projectStartSelfReview } from '../src/api/service';

describe('projectStartSelfReview', () => {
  beforeEach(() => {
    m.findOpen.mockReset().mockResolvedValue(null);
    m.insertAssignment.mockReset();
    m.insertReview.mockReset().mockResolvedValue('11111111-1111-1111-1111-111111111111');
    m.latest.mockReset().mockResolvedValue({ seq: 5, status: 'complete' });
    m.prev.mockReset().mockResolvedValue(null);
    m.loadFacts.mockReset().mockResolvedValue(siteFacts());
  });

  it('creates a one-space review and an open assignment for the caller', async () => {
    const r = await projectStartSelfReview('p1', 'acc-1');
    expect(r.reviewId).toBe('11111111-1111-1111-1111-111111111111');
    const [meta, items] = m.insertReview.mock.calls[0];
    expect(meta.scope).toEqual({ type: 'projects', ids: ['p1'] });
    expect(meta.createdBy).toBe('acc-1');
    expect(meta.campaignRunId).toBeNull();
    expect(meta.baseSeq).toBe(5);
    expect(meta.name).toMatch(/^Self review ALPHA \d{4}-\d{2}-\d{2}$/);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i: any) => i.projectId === undefined || i.projectId === 'p1')).toBe(true);
    expect(m.insertAssignment).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'p1', assignee: 'acc-1', status: 'open' }),
    );
  });

  it('refuses a second review while one is open', async () => {
    m.findOpen.mockResolvedValue({ reviewId: 'x' });
    await expect(projectStartSelfReview('p1', 'acc-1')).rejects.toBeInstanceOf(BadRequest);
    expect(m.insertReview).not.toHaveBeenCalled();
  });

  it('refuses without a snapshot or for a space that is not in it', async () => {
    m.latest.mockResolvedValue(null);
    await expect(projectStartSelfReview('p1', 'acc-1')).rejects.toThrow(/No snapshot yet/);
    m.latest.mockResolvedValue({ seq: 5, status: 'complete' });
    await expect(projectStartSelfReview('nope', 'acc-1')).rejects.toThrow(
      /not in the latest snapshot/,
    );
    expect(m.insertReview).not.toHaveBeenCalled();
  });
});
