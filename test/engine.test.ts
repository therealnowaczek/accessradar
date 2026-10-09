import { describe, expect, it } from 'vitest';
import { buildState } from '../src/engine/state';
import {
  aggregate,
  describePath,
  pathCode,
  resolveAll,
  resolveProject,
  viaLabel,
} from '../src/engine/resolve';
import { siteFacts } from './fixtures';

const state = buildState(siteFacts());
const p1 = resolveProject(state, 'p1');
const userPaths = (accountId: string, permission: string, entries = p1) =>
  entries.filter(
    (e) =>
      e.subject.type === 'user' && e.subject.accountId === accountId && e.permission === permission,
  );

describe('resolveProject: holder types', () => {
  it('expands project role user and group actors with the role in the path', () => {
    expect(userPaths('alice', 'EDIT_ISSUES')[0].path.map((p) => p.kind)).toEqual([
      'scheme',
      'role',
    ]);
    expect(userPaths('bob', 'EDIT_ISSUES')[0].path.map((p) => p.kind)).toEqual([
      'scheme',
      'role',
      'group',
    ]);
  });
  it('expands a parameterless applicationRole to every application group', () => {
    const ids = p1
      .filter((e) => e.permission === 'BROWSE_PROJECTS' && e.subject.type === 'user')
      .map((e) => (e.subject as { accountId: string }).accountId)
      .sort();
    expect(ids).toEqual(['bob', 'carol', 'ivan']);
  });
  it('keeps unreadable groups as a partial group subject', () => {
    const g = p1.find((e) => e.permission === 'ADMINISTER_PROJECTS' && e.subject.type === 'group');
    expect(g?.partial).toBe(true);
    expect(g?.subject).toEqual({ type: 'group', groupId: 'g-secret' });
  });
  it('marks reporter as conditional (not partial) and anyone as anonymous', () => {
    expect(
      p1.some(
        (e) =>
          e.subject.type === 'conditional' && e.subject.holderType === 'reporter' && !e.partial,
      ),
    ).toBe(true);
    expect(
      p1.some((e) => e.subject.type === 'anonymous' && e.permission === 'BROWSE_PROJECTS'),
    ).toBe(true);
  });
  it('resolves named users, project lead and groups referenced by name', () => {
    expect(userPaths('dave', 'ADMINISTER_PROJECTS')[0].path.at(-1)).toEqual({ kind: 'direct' });
    expect(userPaths('lead', 'CREATE_ISSUES')[0].path.at(-1)).toEqual({ kind: 'projectLead' });
    expect(userPaths('alice', 'CREATE_ISSUES')[0].path.at(-1)).toEqual({
      kind: 'group',
      groupId: 'g-devs',
    });
  });
  it('uses project-scoped roles of team-managed projects and ignores other schemes', () => {
    const p2 = resolveProject(state, 'p2');
    expect(p2.map((e) => e.permission)).toEqual(['ADMINISTER_PROJECTS']);
    expect(userPaths('bob', 'ADMINISTER_PROJECTS', p2)).toHaveLength(1);
  });
  it('resolves all projects', () => {
    expect(resolveAll(state).length).toBe(p1.length + resolveProject(state, 'p2').length);
  });
});

describe('reason paths', () => {
  it('describes the path innermost first, in admin language', () => {
    const bob = userPaths('bob', 'EDIT_ISSUES')[0];
    expect(describePath(state, bob.path)).toBe(
      'group “jira-admins” → role “Developers” → scheme “Default scheme”',
    );
    const browse = userPaths('carol', 'BROWSE_PROJECTS')[0];
    expect(describePath(state, browse.path)).toBe(
      'group “jira-users” → any Jira application access → scheme “Default scheme”',
    );
  });
  it('produces stable machine codes and via labels', () => {
    const bob = userPaths('bob', 'EDIT_ISSUES')[0];
    expect(pathCode(bob.path)).toBe('group:g-admins>role:10002>scheme:s1#2');
    expect(viaLabel(state, bob.path)).toEqual({ kind: 'role', label: 'Developers' });
    expect(viaLabel(state, userPaths('dave', 'ADMINISTER_PROJECTS')[0].path)).toEqual({
      kind: 'direct',
      label: 'Named user',
    });
  });
  it('aggregates per subject and project without duplicate paths', () => {
    const rows = aggregate([...p1, ...p1]);
    const bob = rows.find((r) => r.subject.type === 'user' && r.subject.accountId === 'bob')!;
    expect(bob.perms.get('EDIT_ISSUES')).toHaveLength(1);
    expect([...bob.perms.keys()].sort()).toEqual(['BROWSE_PROJECTS', 'EDIT_ISSUES']);
  });
  it('treats collected empty groups as read', () => {
    expect(state.groupMembers.get('g-empty')).toEqual([]);
    expect(state.groupMembers.has('g-secret')).toBe(false);
  });
});
