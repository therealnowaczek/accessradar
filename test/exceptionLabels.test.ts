/** Exceptions page names (E2E phase 0 finding 1): no raw account, project or group ids. */
import { describe, expect, it } from 'vitest';
import { exceptionLabels, subjectKind } from '../src/api/views';
import { buildState } from '../src/engine/state';
import { stored } from '../src/engine/facts';

const state = buildState([
  stored({
    kind: 'project',
    fkey: '10042',
    attrs: { key: 'ARTEST', name: 'AccessRadar E2E', style: 'team', typeKey: 'software' },
  }),
  stored({ kind: 'group', fkey: 'g-uuid-1', attrs: { name: 'jira-admins' } }),
  stored({
    kind: 'person',
    fkey: '712020:aaaa-bbbb',
    attrs: { displayName: 'Ann Admin', accountType: 'atlassian', active: true },
  }),
  stored({
    kind: 'person',
    fkey: '557058:app-1',
    attrs: { displayName: 'Tempo Core', accountType: 'app', active: true },
  }),
]);

const row = (over: Partial<Parameters<typeof exceptionLabels>[1]> = {}) => ({
  subjectType: 'user',
  subjectId: '712020:aaaa-bbbb',
  projectId: '10042',
  groupId: null,
  grantedBy: '712020:aaaa-bbbb',
  ...over,
});

const RAW_ID = /712020:|557058:|10042|g-uuid-1|nobody-/;

describe('exceptionLabels', () => {
  it('shows the person, the space key and name, and who granted it', () => {
    const l = exceptionLabels(state, row());
    expect(l).toEqual({
      subjectName: 'Ann Admin',
      subjectKind: 'user',
      scopeLabel: 'ARTEST · AccessRadar E2E',
      grantedByName: 'Ann Admin',
    });
  });

  it('labels an app integration as an app, not a user', () => {
    const l = exceptionLabels(state, row({ subjectId: '557058:app-1' }));
    expect(l.subjectName).toBe('Tempo Core');
    expect(l.subjectKind).toBe('app');
  });

  it('names group-scoped exceptions and group subjects', () => {
    const l = exceptionLabels(
      state,
      row({ subjectType: 'group', subjectId: 'g-uuid-1', projectId: null, groupId: 'g-uuid-1' }),
    );
    expect(l.subjectName).toBe('jira-admins');
    expect(l.subjectKind).toBe('group');
    expect(l.scopeLabel).toBe('jira-admins');
  });

  it('falls back to clear labels, never raw ids, when names cannot be resolved', () => {
    const l = exceptionLabels(
      state,
      row({ subjectId: 'nobody-1', projectId: '99999', grantedBy: 'nobody-2' }),
    );
    expect(l).toEqual({
      subjectName: 'Unknown user',
      subjectKind: 'user',
      scopeLabel: 'Unknown space',
      grantedByName: 'Jira admin',
    });
    const g = exceptionLabels(state, row({ projectId: null, groupId: 'gone' }));
    expect(g.scopeLabel).toBe('Unknown group');
    for (const v of Object.values(l)) expect(v).not.toMatch(RAW_ID);
  });

  it('works before the first snapshot (no state)', () => {
    const l = exceptionLabels(null, row());
    expect(l.subjectName).toBe('Unknown user');
    expect(l.scopeLabel).toBe('Unknown space');
    for (const v of Object.values(l)) expect(v).not.toMatch(RAW_ID);
  });
});

describe('subjectKind', () => {
  it('maps app accounts to app', () => {
    expect(subjectKind({ type: 'user', accountType: 'app' })).toBe('app');
    expect(subjectKind({ type: 'user', accountType: 'atlassian' })).toBe('user');
    expect(subjectKind({ type: 'group' })).toBe('group');
  });
});
