import { describe, expect, it } from 'vitest';
import {
  ALERT_CAP,
  capAlerts,
  evaluateAlerts,
  sanitizeAlertRules,
  type Alert,
} from '../src/engine/alerts';
import type { AccessState } from '../src/engine/state';
import type { EffectiveAccess } from '../src/engine/resolve';

function emptyState(over: Partial<AccessState> = {}): AccessState {
  return {
    projects: new Map(),
    schemes: new Map(),
    grants: [],
    grantsByScheme: new Map(),
    roles: new Map(),
    roleActors: new Map(),
    groups: new Map(),
    groupByName: new Map(),
    groupMembers: new Map(),
    memberOf: new Map(),
    appRoles: new Map(),
    appRoleGroups: new Map(),
    groupAccess: new Map(),
    persons: new Map(),
    ...over,
  };
}

describe('sanitizeAlertRules', () => {
  it('defaults all rules on and ignores unknown keys', () => {
    const r = sanitizeAlertRules({ 'new-admin': false, bogus: true });
    expect(r['new-admin']).toBe(false);
    expect(r['new-anonymous-grant']).toBe(true);
  });
});

describe('evaluateAlerts', () => {
  it('fires new-admin when a human joins an admin group', () => {
    const prev = emptyState({
      groups: new Map([['g1', { name: 'jira-admins' }]]),
      groupAccess: new Map([['g1', ['admin']]]),
      groupMembers: new Map([['g1', []]]),
      persons: new Map([['u1', { displayName: 'Ann', accountType: 'atlassian', active: true }]]),
    });
    const next = emptyState({
      groups: new Map([['g1', { name: 'jira-admins' }]]),
      groupAccess: new Map([['g1', ['admin']]]),
      groupMembers: new Map([['g1', ['u1']]]),
      persons: new Map([['u1', { displayName: 'Ann', accountType: 'atlassian', active: true }]]),
    });
    const alerts = evaluateAlerts(prev, next, undefined, [], []);
    expect(alerts.some((a) => a.rule === 'new-admin' && a.key === 'new-admin:u1')).toBe(true);
  });

  it('fires new-app-account-admin for app accounts, not new-admin', () => {
    const prev = emptyState({
      groups: new Map([['g1', { name: 'admins' }]]),
      groupAccess: new Map([['g1', ['admin']]]),
      groupMembers: new Map([['g1', []]]),
      persons: new Map([['app1', { displayName: 'Bot', accountType: 'app', active: true }]]),
    });
    const next = emptyState({
      groups: new Map([['g1', { name: 'admins' }]]),
      groupAccess: new Map([['g1', ['admin']]]),
      groupMembers: new Map([['g1', ['app1']]]),
      persons: new Map([['app1', { displayName: 'Bot', accountType: 'app', active: true }]]),
    });
    const alerts = evaluateAlerts(prev, next, undefined, [], []);
    expect(alerts.map((a) => a.rule)).toEqual(['new-app-account-admin']);
  });

  it('fires new-anonymous-grant when Anyone appears on a used scheme', () => {
    const prev = emptyState({
      projects: new Map([
        ['p1', { key: 'PAY', name: 'Pay', style: 'company', typeKey: 'software', schemeId: 's1' }],
      ]),
      schemes: new Map([['s1', { name: 'Default', teamManaged: false }]]),
      grants: [],
      grantsByScheme: new Map([['s1', []]]),
    });
    const next = emptyState({
      projects: new Map([
        ['p1', { key: 'PAY', name: 'Pay', style: 'company', typeKey: 'software', schemeId: 's1' }],
      ]),
      schemes: new Map([['s1', { name: 'Default', teamManaged: false }]]),
      grants: [
        {
          grantId: 'g1',
          schemeId: 's1',
          permission: 'BROWSE_PROJECTS',
          holderType: 'anyone',
        },
      ],
      grantsByScheme: new Map([
        [
          's1',
          [
            {
              grantId: 'g1',
              schemeId: 's1',
              permission: 'BROWSE_PROJECTS',
              holderType: 'anyone',
            },
          ],
        ],
      ]),
    });
    const alerts = evaluateAlerts(prev, next, undefined, [], []);
    expect(alerts.some((a) => a.rule === 'new-anonymous-grant')).toBe(true);
  });

  it('fires inactive-with-access when an account deactivates but keeps access', () => {
    const prev = emptyState({
      persons: new Map([['u1', { displayName: 'Ann', accountType: 'atlassian', active: true }]]),
    });
    const next = emptyState({
      persons: new Map([['u1', { displayName: 'Ann', accountType: 'atlassian', active: false }]]),
    });
    const entries: EffectiveAccess[] = [
      {
        projectId: 'p1',
        permission: 'BROWSE_PROJECTS',
        subject: { type: 'user', accountId: 'u1' },
        path: [],
      },
    ];
    const alerts = evaluateAlerts(prev, next, undefined, entries, entries);
    expect(alerts.some((a) => a.rule === 'inactive-with-access' && a.severity === 'high')).toBe(
      true,
    );
  });

  it('fires new-project-admin for a new ADMINISTER_PROJECTS holder', () => {
    const prev = emptyState({
      projects: new Map([
        ['p1', { key: 'PAY', name: 'Pay', style: 'company', typeKey: 'software', schemeId: 's1' }],
      ]),
      persons: new Map([['u1', { displayName: 'Ann', accountType: 'atlassian', active: true }]]),
    });
    const next = emptyState({
      projects: new Map([
        ['p1', { key: 'PAY', name: 'Pay', style: 'company', typeKey: 'software', schemeId: 's1' }],
      ]),
      persons: new Map([['u1', { displayName: 'Ann', accountType: 'atlassian', active: true }]]),
    });
    const prevEntries: EffectiveAccess[] = [];
    const nextEntries: EffectiveAccess[] = [
      {
        projectId: 'p1',
        permission: 'ADMINISTER_PROJECTS',
        subject: { type: 'user', accountId: 'u1' },
        path: [],
      },
    ];
    const alerts = evaluateAlerts(prev, next, undefined, nextEntries, prevEntries);
    expect(alerts.some((a) => a.rule === 'new-project-admin')).toBe(true);
  });

  it('respects disabled rules', () => {
    const prev = emptyState();
    const next = emptyState({
      groups: new Map([['g1', { name: 'admins' }]]),
      groupAccess: new Map([['g1', ['admin']]]),
      groupMembers: new Map([['g1', ['u1']]]),
      persons: new Map([['u1', { displayName: 'Ann', accountType: 'atlassian', active: true }]]),
    });
    const rules = sanitizeAlertRules({ 'new-admin': false });
    expect(evaluateAlerts(prev, next, rules, [], [])).toEqual([]);
  });
});

describe('capAlerts', () => {
  it('adds a summary when over the cap', () => {
    const many: Alert[] = Array.from({ length: ALERT_CAP + 3 }, (_, i) => ({
      rule: 'new-admin',
      severity: 'high',
      title: `a${i}`,
      body: '',
      key: `k${i}`,
    }));
    const capped = capAlerts(many);
    expect(capped).toHaveLength(ALERT_CAP + 1);
    expect(capped[capped.length - 1].title).toContain('omitted');
  });
});
