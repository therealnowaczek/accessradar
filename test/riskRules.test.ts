import { describe, expect, it } from 'vitest';
import { stored, type Fact } from '../src/engine/facts';
import { ADMIN_GROUP_LARGE, computeRisks } from '../src/engine/risk';
import { buildState } from '../src/engine/state';
import type { SharedItem } from '../src/lib/exposure';

const opts = { largeGroupThreshold: 3, wideAdminProjects: 3, includeAppAccounts: false };
const run = (facts: Fact<any>[], shared: SharedItem[] | null = null) =>
  Object.fromEntries(
    computeRisks(buildState(facts.map(stored)), opts, undefined, shared).map((r) => [r.id, r]),
  );

const project = (id: string, scheme: string, style: 'company' | 'team' = 'company'): Fact<any> => ({
  kind: 'project',
  fkey: id,
  attrs: { key: id.toUpperCase(), name: id, style, typeKey: 'software', schemeId: scheme },
});
const scheme = (id: string): Fact<any> => ({
  kind: 'scheme',
  fkey: id,
  attrs: { name: `Scheme ${id}`, teamManaged: false },
});
const grant = (
  s: string,
  n: string,
  permission: string,
  holderType: string,
  holderParam?: string,
) =>
  ({
    kind: 'grant',
    fkey: `${s}:${n}`,
    attrs: {
      schemeId: s,
      grantId: n,
      permission,
      holderType,
      ...(holderParam ? { holderParam } : {}),
    },
  }) as Fact<any>;
const person = (id: string, active = true, accountType = 'atlassian'): Fact<any> => ({
  kind: 'person',
  fkey: id,
  attrs: { displayName: id, accountType, active },
});
const group = (id: string, members: string, name = id): Fact<any> => ({
  kind: 'group',
  fkey: id,
  attrs: { name, members },
});
const member = (g: string, a: string): Fact<any> => ({
  kind: 'group_member',
  fkey: `${g}:${a}`,
  attrs: { groupId: g, accountId: a },
});
const access = (g: string, accessType = 'admin'): Fact<any> => ({
  kind: 'group_access',
  fkey: `${accessType}::${g}`,
  attrs: { groupId: g, accessType },
});
const item = (
  kind: 'filter' | 'dashboard',
  id: string,
  exposure: SharedItem['exposure'],
): SharedItem => ({
  kind,
  id,
  name: `${kind} ${id}`,
  owner: 'Owner',
  exposure,
  shares: [],
});

describe('C4 risk rules', () => {
  it('anonymous-write ignores read-only anonymous grants and flags the rest', () => {
    const r = run([
      project('a', 's'),
      scheme('s'),
      grant('s', '1', 'BROWSE_PROJECTS', 'anyone'),
      grant('s', '2', 'VIEW_DEV_TOOLS', 'anyone'),
    ]);
    expect(r['anonymous-write'].count).toBe(0);
    expect(r.anonymous.count).toBe(2);
    const w = run([
      project('a', 's'),
      scheme('s'),
      grant('s', '1', 'BROWSE_PROJECTS', 'anyone'),
      grant('s', '2', 'ADD_COMMENTS', 'anyone'),
    ]);
    expect(w['anonymous-write'].items.map((i) => i.label)).toEqual(['A: ADD_COMMENTS']);
  });

  it('inactive-admin flags only deactivated members of admin groups', () => {
    const r = run([
      group('ga', 'collected', 'admins'),
      access('ga'),
      member('ga', 'gone'),
      member('ga', 'here'),
      person('gone', false),
      person('here', true),
    ]);
    expect(r['inactive-admin'].items.map((i) => i.id)).toEqual(['gone']);
    const none = run([
      group('ga', 'collected'),
      access('ga'),
      member('ga', 'here'),
      person('here'),
    ]);
    expect(none['inactive-admin'].count).toBe(0);
  });

  it('destructive-large-group needs collected members at or above the threshold and a used scheme', () => {
    const base = [project('a', 's'), scheme('s'), scheme('unused')];
    const members = ['u1', 'u2', 'u3'].flatMap((u) => [member('g', u), person(u)]);
    const r = run([
      ...base,
      group('g', 'collected'),
      ...members,
      grant('s', '1', 'DELETE_ISSUES', 'group', 'g'),
    ]);
    expect(r['destructive-large-group'].count).toBe(1);
    // Read-type permission on the same group: no finding.
    const read = run([
      ...base,
      group('g', 'collected'),
      ...members,
      grant('s', '1', 'EDIT_ISSUES', 'group', 'g'),
    ]);
    expect(read['destructive-large-group'].count).toBe(0);
    // Unreadable member list: never claimed.
    const unread = run([
      ...base,
      group('g', 'unreadable'),
      grant('s', '1', 'DELETE_ISSUES', 'group', 'g'),
    ]);
    expect(unread['destructive-large-group'].count).toBe(0);
    // Scheme not assigned to any space: not in use.
    const unusedScheme = run([
      ...base,
      group('g', 'collected'),
      ...members,
      grant('unused', '1', 'DELETE_ISSUES', 'group', 'g'),
    ]);
    expect(unusedScheme['destructive-large-group'].count).toBe(0);
    // Below the threshold.
    const small = run([
      ...base,
      group('g', 'collected'),
      member('g', 'u1'),
      person('u1'),
      grant('s', '1', 'DELETE_ISSUES', 'group', 'g'),
    ]);
    expect(small['destructive-large-group'].count).toBe(0);
  });

  it('admin-group-large counts active humans only; empty-admin-groups needs collected members', () => {
    const many = Array.from({ length: ADMIN_GROUP_LARGE }, (_, i) => `u${i}`);
    const facts = [
      group('big', 'collected'),
      access('big'),
      ...many.flatMap((u) => [member('big', u), person(u)]),
      group('bots', 'collected'),
      access('bots', 'site-admin'),
      ...many.flatMap((u) => [member('bots', `b${u}`), person(`b${u}`, true, 'app')]),
      group('empty', 'collected'),
      access('empty'),
      group('hidden', 'unreadable'),
      access('hidden'),
    ];
    const r = run(facts);
    expect(r['admin-group-large'].items.map((i) => i.id)).toEqual(['big']);
    expect(r['empty-admin-groups'].items.map((i) => i.id)).toEqual(['empty']);
  });

  it('project-single-admin flags exactly one active admin, not zero, two or unresolved holders', () => {
    const mk = (admins: string[]) => [
      project('a', 's'),
      scheme('s'),
      ...admins.flatMap((u, i) => [
        grant('s', String(i), 'ADMINISTER_PROJECTS', 'user', u),
        person(u),
      ]),
    ];
    expect(run(mk(['x']))['project-single-admin'].items.map((i) => i.id)).toEqual(['a']);
    expect(run(mk([]))['project-single-admin'].count).toBe(0);
    expect(run(mk(['x', 'y']))['project-single-admin'].count).toBe(0);
    // A deactivated second admin does not count, so one active admin remains.
    const withInactive = [
      ...mk(['x']),
      grant('s', '9', 'ADMINISTER_PROJECTS', 'user', 'z'),
      person('z', false),
    ];
    expect(run(withInactive)['project-single-admin'].count).toBe(1);
    // Team-managed spaces are skipped.
    const team = [
      project('t', 's', 'team'),
      scheme('s'),
      grant('s', '1', 'ADMINISTER_PROJECTS', 'user', 'x'),
      person('x'),
    ];
    expect(run(team)['project-single-admin'].count).toBe(0);
  });

  it('sharing rules split public and signed-in exposure and stay partial when unreadable', () => {
    const shared = [
      item('filter', '1', 'anyone'),
      item('dashboard', '2', 'anyone'),
      item('filter', '3', 'loggedin'),
      item('dashboard', '4', 'loggedin'),
      item('filter', '5', 'restricted'),
    ];
    const r = run([], shared);
    expect(r['filters-public'].items.map((i) => i.id)).toEqual(['filter:1']);
    expect(r['dashboards-public'].items.map((i) => i.id)).toEqual(['dashboard:2']);
    expect(r['shared-loggedin'].items.map((i) => i.id)).toEqual(['filter:3', 'dashboard:4']);
    expect(r['filters-public'].partial).toBe(false);
    const unread = run([], null);
    for (const id of ['filters-public', 'dashboards-public', 'shared-loggedin']) {
      expect(unread[id].count).toBe(0);
      expect(unread[id].partial).toBe(true);
    }
  });

  it('has about twenty rules with unique ids and no em dashes in copy', () => {
    const all = computeRisks(buildState([]), opts, undefined, []);
    expect(all.length).toBe(20);
    expect(new Set(all.map((r) => r.id)).size).toBe(20);
    expect(JSON.stringify(all)).not.toContain('—');
    for (const r of all) expect(r.learnMore).not.toBe(r.description);
  });
});
