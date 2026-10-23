import { describe, expect, it } from 'vitest';
import { _test } from '../src/rovo/actions';
import type { AccessState } from '../src/engine/state';

describe('rovo helpers', () => {
  it('truncates to 50 rows with a note', () => {
    const rows = Array.from({ length: 60 }, (_, i) => ({ i }));
    const t = _test.truncate(rows);
    expect(t.rows).toHaveLength(_test.MAX_ROWS);
    expect(t.note).toMatch(/first 50 of 60/);
  });

  it('resolves project by key (case-insensitive)', () => {
    const state = {
      projects: new Map([
        ['10001', { key: 'PAY', name: 'Payments', style: 'company', schemeId: null }],
      ]),
    } as unknown as AccessState;
    expect(_test.findProjectId(state, 'pay')).toBe('10001');
    expect(_test.findProjectId(state, 'NOPE')).toBeNull();
  });

  it('resolves person by accountId or display name', () => {
    const state = {
      persons: new Map([
        ['acc-1', { displayName: 'Dana Kowal', active: true, accountType: 'atlassian' }],
      ]),
      memberOf: new Map(),
    } as unknown as AccessState;
    expect(_test.findAccountId(state, 'acc-1')).toBe('acc-1');
    expect(_test.findAccountId(state, 'Dana Kowal')).toBe('acc-1');
    expect(_test.findAccountId(state, 'Unknown')).toBeNull();
  });
});

describe('ar-review-status campaign filter', () => {
  const campaign = (id: string, name: string) =>
    ({ id, name, status: 'active' }) as unknown as import('../src/db/campaigns').CampaignRow;
  const campaigns = [
    campaign('c1', 'Quarterly admins'),
    campaign('c2', 'Q4 payments'),
    campaign('c3', 'Quarterly admins EU'),
  ];

  it('prefers an exact (case-insensitive) name match', () => {
    expect(_test.matchCampaigns(campaigns, ' quarterly ADMINS ').map((c) => c.id)).toEqual(['c1']);
  });

  it('falls back to a substring match and returns all campaigns for an empty filter', () => {
    expect(_test.matchCampaigns(campaigns, 'quarterly').map((c) => c.id)).toEqual(['c1', 'c3']);
    expect(_test.matchCampaigns(campaigns, 'nope')).toEqual([]);
    expect(_test.matchCampaigns(campaigns, '  ')).toHaveLength(3);
  });

  it('keeps only reviews created by runs of the matched campaigns', () => {
    const reviews = [
      { id: 'r1', campaignRunId: 'run-1' },
      { id: 'r2', campaignRunId: 'run-2' },
      { id: 'r3', campaignRunId: null },
      { id: 'r4', campaignRunId: 'run-unknown' },
    ];
    const runs = new Map([
      ['run-1', 'c1'],
      ['run-2', 'c2'],
    ]);
    const out = _test.reviewsForCampaigns(reviews, [campaigns[0]], runs);
    expect(out.map((x) => [x.review.id, x.campaign])).toEqual([['r1', 'Quarterly admins']]);
  });
});
