import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  q: vi.fn(),
  exec: vi.fn(),
  getReview: vi.fn(),
  getItems: vi.fn(),
  decide: vi.fn(),
  markSigned: vi.fn(),
  nextChainTip: vi.fn(),
  audit: vi.fn(),
  getSettings: vi.fn(),
}));

vi.mock('@forge/api', () => ({ default: {}, route: () => '', getAppContext: () => ({}) }));
vi.mock('../src/db/sql', () => ({
  q: m.q,
  exec: m.exec,
  limitClause: (n: number) => `LIMIT ${n}`,
}));
vi.mock('../src/db/reviews', async (orig) => ({
  ...(await orig<typeof import('../src/db/reviews')>()),
  getReview: m.getReview,
  getItems: m.getItems,
  decide: m.decide,
  markSigned: m.markSigned,
  nextChainTip: m.nextChainTip,
}));
vi.mock('../src/db/settings', async (orig) => ({
  ...(await orig<typeof import('../src/db/settings')>()),
  getSettings: m.getSettings,
}));
vi.mock('../src/lib/queue', () => ({ push: vi.fn() }));
vi.mock('../src/db/audit', () => ({ audit: m.audit, listAudit: vi.fn() }));

import { syncReviewExceptions } from '../src/db/exceptions';
import { featureFlags, REQUIRES_ADVANCED } from '../src/domain/edition';
import { decideItems, exceptionsList, runExpireExceptions, signReview } from '../src/api/service';

const reviewId = '00000000-0000-4000-8000-000000000002';
const standard = {
  edition: 'standard',
  source: 'license',
  features: featureFlags('standard'),
  override: null,
  canOverride: false,
} as const;

const item = (over: Record<string, unknown> = {}) => ({
  idx: 0,
  itemKey: 'u:acc-1|p:10|ADMINISTER_PROJECTS',
  subjectType: 'user',
  subjectId: 'acc-1',
  projectId: '10',
  groupId: null,
  permissions: ['ADMINISTER_PROJECTS'],
  change: 'unchanged',
  decision: 'exception',
  note: 'Vendor support until the migration ends',
  expiresAt: Date.now() + 30 * 86400_000,
  ...over,
});

const inserts = () =>
  m.exec.mock.calls.filter((c) => String(c[0]).includes('INSERT INTO access_exception'));
const sqlWith = (s: string) => m.exec.mock.calls.filter((c) => String(c[0]).includes(s));

beforeEach(() => {
  for (const fn of Object.values(m)) fn.mockReset();
  m.q.mockResolvedValue([]);
  m.exec.mockResolvedValue(0);
  m.getSettings.mockResolvedValue({ requireKeepNote: false });
});

describe('syncReviewExceptions (register without sign-off)', () => {
  it('registers an exception with justification and expiry as active', async () => {
    const r = await syncReviewExceptions(reviewId, [item()], 'acc-admin', 1000);
    expect(r.granted).toBe(1);
    const ins = inserts();
    expect(ins).toHaveLength(1);
    expect(ins[0]).toContain('Vendor support until the migration ends');
    expect(ins[0]).toContain('active');
    expect(ins[0]).toContain(reviewId);
  });

  it('skips an identical active exception (no duplicate rows)', async () => {
    m.q.mockResolvedValueOnce([{ id: 'x' }]);
    const r = await syncReviewExceptions(reviewId, [item()], 'acc-admin', 1000);
    expect(r.granted).toBe(0);
    expect(inserts()).toHaveLength(0);
  });

  it('withdraws this review exception when the decision changes to Keep or is cleared', async () => {
    m.exec.mockResolvedValue(1);
    const r = await syncReviewExceptions(
      reviewId,
      [item({ decision: 'keep' }), item({ idx: 1, decision: null })],
      'acc-admin',
      1000,
    );
    expect(r.withdrawn).toBe(2);
    const w = sqlWith("closed_reason = 'withdrawn'");
    expect(w).toHaveLength(2);
    expect(w[0]).toContain(reviewId);
  });

  it('revokes active exceptions on a Revoke decision', async () => {
    m.exec.mockResolvedValue(1);
    const r = await syncReviewExceptions(reviewId, [item({ decision: 'revoke' })], 'acc', 1000);
    expect(r.revoked).toBe(1);
    expect(sqlWith("closed_reason = 'revoked'")).toHaveLength(1);
  });
});

describe('exceptions on Standard', () => {
  const exp = new Date(Date.now() + 40 * 86400_000).toISOString().slice(0, 10);

  it('Standard registers an exception when the decision is saved, without signing', async () => {
    m.getReview.mockResolvedValue({ id: reviewId, status: 'in_progress', itemCount: 3 });
    m.decide.mockResolvedValue(1);
    m.getItems.mockResolvedValue([item(), item({ idx: 1, decision: null, itemKey: 'other' })]);
    const res = await decideItems(
      {
        id: reviewId,
        idxs: [0],
        decision: 'exception',
        note: 'Vendor support until the migration ends',
        expiresAt: exp,
        tz: 'UTC',
      },
      'acc-admin',
    );
    expect(res.changed).toBe(1);
    expect(res.exceptions.granted).toBe(1);
    expect(inserts()).toHaveLength(1);
    expect(m.markSigned).not.toHaveBeenCalled();
    expect(m.nextChainTip).not.toHaveBeenCalled();
    expect(m.audit).toHaveBeenCalledWith('acc-admin', 'exception.granted', reviewId, { count: 1 });
  });

  it('an Exception decision still needs justification and expiry', async () => {
    m.getReview.mockResolvedValue({ id: reviewId, status: 'in_progress', itemCount: 3 });
    await expect(
      decideItems({ id: reviewId, idxs: [0], decision: 'exception', note: 'too short' }, 'acc'),
    ).rejects.toThrow();
    expect(m.decide).not.toHaveBeenCalled();
    expect(inserts()).toHaveLength(0);
  });

  it('signed reviews stay read-only', async () => {
    m.getReview.mockResolvedValue({ id: reviewId, status: 'signed', itemCount: 3 });
    await expect(decideItems({ id: reviewId, idxs: [0], decision: 'keep' }, 'acc')).rejects.toThrow(
      'Signed reviews are read-only',
    );
  });

  it('Standard can view the exceptions register', async () => {
    m.q.mockResolvedValueOnce([{ n: 1 }]).mockResolvedValueOnce([
      {
        id: 'e1',
        item_key: 'k',
        subject_type: 'user',
        subject_id: 'acc-1',
        project_id: '10',
        group_id: null,
        permissions: '["ADMINISTER_PROJECTS"]',
        justification: 'Vendor support until the migration ends',
        expires_at: 5000,
        status: 'active',
        review_id: reviewId,
        granted_by: 'acc-admin',
        granted_at: 1000,
      },
    ]);
    const list = await exceptionsList({ status: 'active' });
    expect(list.total).toBe(1);
    expect(list.items[0].justification).toBe('Vendor support until the migration ends');
  });

  it('exceptions expire on every edition', async () => {
    m.exec.mockResolvedValue(2);
    expect(await runExpireExceptions(10_000)).toBe(2);
    expect(sqlWith("status = 'expired'")).toHaveLength(1);
    expect(m.audit).toHaveBeenCalledWith('system', 'exception.expired', null, { count: 2 });
  });

  it('signing is still refused on Standard', async () => {
    await expect(signReview({ id: reviewId, attest: true }, 'acc', standard)).rejects.toThrow(
      REQUIRES_ADVANCED,
    );
    expect(m.getReview).not.toHaveBeenCalled();
    expect(m.markSigned).not.toHaveBeenCalled();
  });
});
