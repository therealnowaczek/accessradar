import { describe, expect, it } from 'vitest';
import { isDue } from '../src/collector/run';
import {
  countObjects,
  estimatePoints,
  hourBucket,
  secondsToNextHour,
} from '../src/collector/points';
import {
  grantFact,
  personFact,
  projectFact,
  roleActors,
  roleIdsFromMap,
} from '../src/collector/normalize';
import { DEFAULT_SETTINGS, sanitizeSettings } from '../src/db/settings';
import { hasGlobalAdminister } from '../src/lib/auth';

describe('rate-point accounting', () => {
  it('charges 2 points per identity object and 1 per core object', () => {
    expect(
      estimatePoints('/rest/api/3/group/member?groupId=x', { values: new Array(8).fill({}) }),
    ).toBe(17);
    expect(
      estimatePoints('/rest/api/3/project/search?startAt=0', { values: new Array(5).fill({}) }),
    ).toBe(6);
    expect(countObjects([1, 2, 3])).toBe(3);
    expect(countObjects({ permissionSchemes: [1, 2] })).toBe(2);
  });
  it('aligns budgets to the UTC hour', () => {
    const t = Date.UTC(2026, 9, 9, 16, 59, 30);
    expect(hourBucket(t)).toBe(Date.UTC(2026, 9, 9, 16));
    expect(secondsToNextHour(t)).toBe(30);
  });
});

describe('isDue', () => {
  const at = (d: number, h: number) => Date.UTC(2026, 9, d, h, 10);
  it('runs daily at the configured UTC hour once per window', () => {
    const s = { frequency: 'daily' as const, hourUtc: 2, weekday: 1 };
    expect(isDue(s, null, at(9, 2))).toBe(true);
    expect(isDue(s, null, at(9, 3))).toBe(false);
    expect(isDue(s, at(9, 2), at(9, 2) + 600_000)).toBe(false);
    expect(isDue(s, at(8, 2), at(9, 2))).toBe(true);
  });
  it('runs weekly on the ISO weekday and never when off', () => {
    const s = { frequency: 'weekly' as const, hourUtc: 2, weekday: 5 }; // 2026-10-09 is a Friday
    expect(isDue(s, null, at(9, 2))).toBe(true);
    expect(isDue({ ...s, weekday: 1 }, null, at(9, 2))).toBe(false);
    expect(isDue(s, at(2, 2), at(9, 2))).toBe(true);
    expect(isDue({ ...s, frequency: 'off' }, null, at(9, 2))).toBe(false);
  });
});

describe('sanitizeSettings', () => {
  it('drops invalid values and unknown fields', () => {
    const s = sanitizeSettings({
      frequency: 'hourly',
      hourUtc: 30,
      retentionDays: 10,
      keyPermissions: ['EDIT_ISSUES', 'drop table', 5],
      evil: 1,
    });
    expect(s.frequency).toBe(DEFAULT_SETTINGS.frequency);
    expect(s.hourUtc).toBe(DEFAULT_SETTINGS.hourUtc);
    expect(s.retentionDays).toBe(DEFAULT_SETTINGS.retentionDays);
    expect(s.keyPermissions).toEqual(['EDIT_ISSUES']);
    expect('evil' in s).toBe(false);
  });
  it('keeps valid values', () => {
    const s = sanitizeSettings({
      frequency: 'daily',
      hourUtc: 23,
      weekday: 7,
      groupMembers: 'all',
      showAppAccounts: true,
    });
    expect([s.frequency, s.hourUtc, s.weekday, s.groupMembers, s.showAppAccounts]).toEqual([
      'daily',
      23,
      7,
      'all',
      true,
    ]);
  });
});

describe('normalize Jira payloads', () => {
  it('maps projects incl. team-managed, lead and category', () => {
    expect(
      projectFact({ id: '1', key: 'KAN', name: 'K', simplified: true, lead: { accountId: 'x' } })
        ?.attrs,
    ).toEqual({
      key: 'KAN',
      name: 'K',
      style: 'team',
      typeKey: 'unknown',
      leadAccountId: 'x',
    });
    expect(
      projectFact({
        id: '2',
        key: 'PAY',
        name: 'Pay',
        projectTypeKey: 'software',
        projectCategory: { id: '10001', name: 'Finance' },
      })?.attrs,
    ).toEqual({
      key: 'PAY',
      name: 'Pay',
      style: 'company',
      typeKey: 'software',
      categoryId: '10001',
      categoryName: 'Finance',
    });
    expect(projectFact({ key: 'X' })).toBeNull();
  });
  it('maps grants preferring ids over names', () => {
    expect(
      grantFact('10', {
        id: 5,
        permission: 'BROWSE_PROJECTS',
        holder: { type: 'group', parameter: 'devs', value: 'gid-1' },
      })?.attrs,
    ).toEqual({
      schemeId: '10',
      grantId: '5',
      permission: 'BROWSE_PROJECTS',
      holderType: 'group',
      holderParam: 'gid-1',
      holderName: 'devs',
    });
    expect(
      grantFact('10', { id: 6, permission: 'BROWSE_PROJECTS', holder: { type: 'applicationRole' } })
        ?.attrs.holderParam,
    ).toBeUndefined();
    expect(grantFact('10', { permission: 'X' })).toBeNull();
  });
  it('maps role actors, role maps and people', () => {
    expect(
      roleActors({
        actors: [
          { actorUser: { accountId: 'a' } },
          { actorGroup: { groupId: 'g', name: 'G' } },
          { type: 'x' },
        ],
      }).map((a) => `${a.type}:${a.id}`),
    ).toEqual(['user:a', 'group:g']);
    expect([
      ...roleIdsFromMap({ Developers: 'https://x/rest/api/3/project/1/role/10002' }),
    ]).toEqual([['10002', 'Developers']]);
    expect(personFact({ accountId: 'a', accountType: 'app', active: false })?.attrs).toEqual({
      displayName: 'Unknown user',
      accountType: 'app',
      active: false,
    });
  });
});

describe('authorization', () => {
  it('requires ADMINISTER in the permissions/check response', () => {
    expect(hasGlobalAdminister({ globalPermissions: ['USER_PICKER', 'ADMINISTER'] })).toBe(true);
    expect(hasGlobalAdminister({ globalPermissions: ['USER_PICKER'] })).toBe(false);
    expect(hasGlobalAdminister(null)).toBe(false);
  });
});
