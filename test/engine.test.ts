import { describe, expect, it } from 'vitest';
import { stored, type Fact } from '../src/engine/facts';
import { computeRisks } from '../src/engine/risk';
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

describe('new risk rules', () => {
  const opts = {
    largeGroupThreshold: 50,
    wideAdminProjects: 3,
    includeAppAccounts: false,
  };
  const from = (facts: Fact<any>[]) => buildState(facts.map(stored));

  it('project-no-admin fires for company-managed with no human admin and skips team-managed', () => {
    const facts: Fact<any>[] = [
      {
        kind: 'project' as const,
        fkey: 'lonely',
        attrs: {
          key: 'LONELY',
          name: 'Lonely',
          style: 'company' as const,
          typeKey: 'software',
          schemeId: 's-lonely',
        },
      },
      {
        kind: 'project' as const,
        fkey: 'team1',
        attrs: {
          key: 'TEAM',
          name: 'Team',
          style: 'team' as const,
          typeKey: 'software',
          schemeId: 's-team',
        },
      },
      {
        kind: 'scheme' as const,
        fkey: 's-lonely',
        attrs: { name: 'Lonely scheme', teamManaged: false },
      },
      {
        kind: 'scheme' as const,
        fkey: 's-team',
        attrs: { name: 'Team scheme', teamManaged: true },
      },
      {
        kind: 'grant' as const,
        fkey: 's-lonely:1',
        attrs: {
          schemeId: 's-lonely',
          grantId: '1',
          permission: 'ADMINISTER_PROJECTS',
          holderType: 'reporter',
        },
      },
      {
        kind: 'grant' as const,
        fkey: 's-team:1',
        attrs: {
          schemeId: 's-team',
          grantId: '1',
          permission: 'ADMINISTER_PROJECTS',
          holderType: 'projectRole',
          holderParam: 'r1',
        },
      },
    ];
    const r = Object.fromEntries(computeRisks(from(facts), opts).map((x) => [x.id, x]));
    expect(r['project-no-admin'].items.map((i) => i.id)).toEqual(['lonely']);
    expect(r['project-no-admin'].items.some((i) => i.id === 'team1')).toBe(false);
  });

  it('project-no-admin stays clear when an active human administers via the scheme', () => {
    const facts: Fact<any>[] = [
      {
        kind: 'project' as const,
        fkey: 'ok',
        attrs: {
          key: 'OK',
          name: 'Ok',
          style: 'company' as const,
          typeKey: 'software',
          schemeId: 's-ok',
          leadAccountId: 'lead1',
        },
      },
      { kind: 'scheme' as const, fkey: 's-ok', attrs: { name: 'Ok', teamManaged: false } },
      {
        kind: 'grant' as const,
        fkey: 's-ok:1',
        attrs: {
          schemeId: 's-ok',
          grantId: '1',
          permission: 'ADMINISTER_PROJECTS',
          holderType: 'projectLead',
        },
      },
      {
        kind: 'person' as const,
        fkey: 'lead1',
        attrs: { displayName: 'Lead', accountType: 'atlassian', active: true },
      },
    ];
    const r = computeRisks(from(facts), opts).find((x) => x.id === 'project-no-admin')!;
    expect(r.count).toBe(0);
    expect(r.partial).toBe(false);
  });

  it('direct-user-grants fires for key permissions and ignores unused schemes', () => {
    const facts: Fact<any>[] = [
      {
        kind: 'project' as const,
        fkey: 'p',
        attrs: {
          key: 'P',
          name: 'P',
          style: 'company' as const,
          typeKey: 'software',
          schemeId: 's-used',
        },
      },
      { kind: 'scheme' as const, fkey: 's-used', attrs: { name: 'Used', teamManaged: false } },
      { kind: 'scheme' as const, fkey: 's-free', attrs: { name: 'Free', teamManaged: false } },
      {
        kind: 'grant' as const,
        fkey: 's-used:1',
        attrs: {
          schemeId: 's-used',
          grantId: '1',
          permission: 'EDIT_ISSUES',
          holderType: 'user',
          holderParam: 'u1',
        },
      },
      {
        kind: 'grant' as const,
        fkey: 's-free:1',
        attrs: {
          schemeId: 's-free',
          grantId: '1',
          permission: 'EDIT_ISSUES',
          holderType: 'user',
          holderParam: 'u1',
        },
      },
      {
        kind: 'person' as const,
        fkey: 'u1',
        attrs: { displayName: 'User One', accountType: 'atlassian', active: true },
      },
    ];
    const r = computeRisks(from(facts), opts).find((x) => x.id === 'direct-user-grants')!;
    expect(r.items.map((i) => i.id)).toEqual(['s-used:1']);
  });

  it('unused-schemes finds schemes with no project and unused global roles', () => {
    const facts: Fact<any>[] = [
      {
        kind: 'project' as const,
        fkey: 'p',
        attrs: {
          key: 'P',
          name: 'P',
          style: 'company' as const,
          typeKey: 'software',
          schemeId: 's1',
        },
      },
      { kind: 'scheme' as const, fkey: 's1', attrs: { name: 'In use', teamManaged: false } },
      {
        kind: 'scheme' as const,
        fkey: 's-orphan',
        attrs: { name: 'Orphan scheme', teamManaged: false },
      },
      { kind: 'role' as const, fkey: 'role-orphan', attrs: { name: 'Orphan role' } },
      { kind: 'role' as const, fkey: 'role-team', attrs: { name: 'Team role', projectId: 'p' } },
    ];
    const r = computeRisks(from(facts), opts).find((x) => x.id === 'unused-schemes')!;
    expect(r.items.map((i) => i.id).sort()).toEqual(['role:role-orphan', 'scheme:s-orphan']);
  });

  it('empty-groups-in-use fires for empty collected groups and marks unreadable as partial', () => {
    const facts: Fact<any>[] = [
      {
        kind: 'project' as const,
        fkey: 'p',
        attrs: {
          key: 'P',
          name: 'P',
          style: 'company' as const,
          typeKey: 'software',
          schemeId: 's1',
        },
      },
      { kind: 'scheme' as const, fkey: 's1', attrs: { name: 'S', teamManaged: false } },
      {
        kind: 'group' as const,
        fkey: 'g-empty',
        attrs: { name: 'empty', members: 'collected' as const },
      },
      {
        kind: 'group' as const,
        fkey: 'g-secret',
        attrs: { name: 'secret', members: 'unreadable' as const },
      },
      {
        kind: 'grant' as const,
        fkey: 's1:1',
        attrs: {
          schemeId: 's1',
          grantId: '1',
          permission: 'BROWSE_PROJECTS',
          holderType: 'group',
          holderParam: 'g-empty',
        },
      },
      {
        kind: 'grant' as const,
        fkey: 's1:2',
        attrs: {
          schemeId: 's1',
          grantId: '2',
          permission: 'EDIT_ISSUES',
          holderType: 'group',
          holderParam: 'g-secret',
        },
      },
    ];
    const r = computeRisks(from(facts), opts).find((x) => x.id === 'empty-groups-in-use')!;
    expect(r.items.map((i) => i.id)).toEqual(['g-empty']);
    expect(r.partial).toBe(true);
  });

  it('app-accounts-admin always evaluates and ignores includeAppAccounts', () => {
    const facts: Fact<any>[] = [
      {
        kind: 'project' as const,
        fkey: 'p',
        attrs: {
          key: 'P',
          name: 'P',
          style: 'company' as const,
          typeKey: 'software',
          schemeId: 's1',
        },
      },
      { kind: 'scheme' as const, fkey: 's1', attrs: { name: 'S', teamManaged: false } },
      {
        kind: 'group' as const,
        fkey: 'g-admins',
        attrs: { name: 'admins', members: 'collected' as const },
      },
      {
        kind: 'group_access' as const,
        fkey: 'admin::g-admins',
        attrs: { groupId: 'g-admins', accessType: 'admin' },
      },
      {
        kind: 'group_member' as const,
        fkey: 'g-admins:bot',
        attrs: { groupId: 'g-admins', accountId: 'bot' },
      },
      {
        kind: 'person' as const,
        fkey: 'bot',
        attrs: { displayName: 'Bot', accountType: 'app', active: true },
      },
      {
        kind: 'grant' as const,
        fkey: 's1:1',
        attrs: {
          schemeId: 's1',
          grantId: '1',
          permission: 'ADMINISTER_PROJECTS',
          holderType: 'user',
          holderParam: 'cust',
        },
      },
      {
        kind: 'person' as const,
        fkey: 'cust',
        attrs: { displayName: 'Customer', accountType: 'customer', active: true },
      },
    ];
    const hidden = computeRisks(from(facts), { ...opts, includeAppAccounts: false }).find(
      (x) => x.id === 'app-accounts-admin',
    )!;
    const shown = computeRisks(from(facts), { ...opts, includeAppAccounts: true }).find(
      (x) => x.id === 'app-accounts-admin',
    )!;
    expect(hidden.items.map((i) => i.id).sort()).toEqual(['bot', 'cust']);
    expect(shown.items.map((i) => i.id).sort()).toEqual(['bot', 'cust']);
  });
});
