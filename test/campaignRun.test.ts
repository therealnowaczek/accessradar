import { describe, expect, it } from 'vitest';
import { resolveAssignee, resolveCampaignProjectIds } from '../src/collector/campaignRun';
import type { CampaignRow } from '../src/db/campaigns';

const base = (over: Partial<CampaignRow> = {}): CampaignRow => ({
  id: 'c1',
  name: 'Q review',
  scope: { type: 'site' },
  frequency: 'quarterly',
  startAt: Date.UTC(2026, 0, 1),
  windowDays: 14,
  delegateRule: 'projectLead',
  delegateMap: null,
  reminderDays: [7, 3, 1],
  keyPermissions: ['BROWSE_PROJECTS'],
  status: 'active',
  nextRunAt: null,
  createdBy: 'admin-1',
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

describe('resolveCampaignProjectIds', () => {
  const all = ['p1', 'p2', 'p3'];

  it('site scope takes all projects up to cap', () => {
    expect(resolveCampaignProjectIds(base(), all).ids).toEqual(all);
  });

  it('projects scope filters to known ids and warns on missing', () => {
    const { ids, warnings } = resolveCampaignProjectIds(
      base({ scope: { type: 'projects', ids: ['p1', 'missing'] } }),
      all,
    );
    expect(ids).toEqual(['p1']);
    expect(warnings[0]).toMatch(/missing/);
  });

  it('category scope returns empty with warning', () => {
    const { ids, warnings } = resolveCampaignProjectIds(
      base({ scope: { type: 'category', ids: ['cat1'] } }),
      all,
    );
    expect(ids).toEqual([]);
    expect(warnings.length).toBe(1);
  });
});

describe('resolveAssignee', () => {
  it('uses project lead, map, or campaign owner', () => {
    expect(resolveAssignee(base(), 'p1', 'lead-1')).toBe('lead-1');
    expect(resolveAssignee(base({ delegateRule: 'admin' }), 'p1', 'lead-1')).toBe('admin-1');
    expect(
      resolveAssignee(base({ delegateRule: 'map', delegateMap: { p1: 'u-map' } }), 'p1', 'lead-1'),
    ).toBe('u-map');
    expect(resolveAssignee(base(), 'p1', undefined)).toBeNull();
  });
});
