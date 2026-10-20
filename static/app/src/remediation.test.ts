import { describe, expect, it } from 'vitest';
import type { ReviewItem } from './api';
import { deriveRemediation, revokeDecisions, type RemediationRow } from './remediation';

const item = (idx: number, decision: ReviewItem['decision'], change: ReviewItem['change'] = null) =>
  ({
    idx,
    itemKey: `p|10000|user:a${idx}`,
    decision,
    change,
    permissions: ['ADMINISTER_PROJECTS'],
    reasons: [],
  }) as unknown as ReviewItem;

const row = (idx: number, status: RemediationRow['status']): RemediationRow => ({
  idx,
  itemKey: `p|10000|user:a${idx}`,
  status,
  checkedSeq: 11,
  verifiedSeq: status === 'verified' ? 11 : null,
  detail: null,
  checkCount: 1,
});

describe('remediation derivation', () => {
  const items = [
    item(0, 'keep'),
    item(1, 'revoke'),
    item(2, 'revoke'),
    item(3, 'exception'),
    item(4, 'revoke', 'removed'),
    item(5, null),
  ];

  it('lists exactly the Revoke decisions the summary card counts', () => {
    expect(revokeDecisions(items).map((i) => i.idx)).toEqual([1, 2]);
  });

  it('shows revocations even when no verification rows exist', () => {
    const r = deriveRemediation(items, []);
    expect(r.total).toBe(2);
    expect(r.untracked).toBe(2);
    expect(r.entries.map((e) => e.status)).toEqual(['untracked', 'untracked']);
    expect(r.closed).toBe(0);
  });

  it('merges verification status by item index', () => {
    const r = deriveRemediation(items, [row(1, 'verified'), row(2, 'still_present')]);
    expect(r.entries.map((e) => [e.item.idx, e.status])).toEqual([
      [1, 'verified'],
      [2, 'still_present'],
    ]);
    expect(r.closed).toBe(1);
    expect(r.untracked).toBe(0);
  });

  it('is empty when the review has no Revoke decisions', () => {
    const r = deriveRemediation([item(0, 'keep')], null);
    expect(r).toEqual({ entries: [], closed: 0, total: 0, untracked: 0 });
  });
});
