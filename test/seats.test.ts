import { describe, expect, it } from 'vitest';
import { stored, type Fact } from '../src/engine/facts';
import { resolveAll } from '../src/engine/resolve';
import { seatReport } from '../src/engine/seats';
import { buildState } from '../src/engine/state';
import { siteFacts } from './fixtures';

const report = (facts: Fact<any>[]) => {
  const state = buildState(facts.map(stored));
  return seatReport(state, resolveAll(state));
};

const person = (id: string, active = true, accountType = 'atlassian'): Fact<any> => ({
  kind: 'person',
  fkey: id,
  attrs: { displayName: id, accountType, active },
});
const group = (id: string, members = 'collected'): Fact<any> => ({
  kind: 'group',
  fkey: id,
  attrs: { name: id, members },
});
const member = (g: string, a: string): Fact<any> => ({
  kind: 'group_member',
  fkey: `${g}:${a}`,
  attrs: { groupId: g, accountId: a },
});
const role = (key: string, name: string): Fact<any> => ({
  kind: 'app_role',
  fkey: key,
  attrs: { name },
});
const roleGroup = (key: string, g: string): Fact<any> => ({
  kind: 'app_role_group',
  fkey: `${key}:${g}`,
  attrs: { appKey: key, groupId: g },
});

describe('seat report', () => {
  it('counts distinct active humans per product, not memberships', () => {
    const r = report([
      role('sw', 'Jira Software'),
      group('g1'),
      group('g2'),
      roleGroup('sw', 'g1'),
      roleGroup('sw', 'g2'),
      member('g1', 'a'),
      member('g2', 'a'),
      member('g2', 'b'),
      person('a'),
      person('b'),
    ]);
    expect(r.products).toHaveLength(1);
    expect(r.products[0].seats).toBe(2);
    expect(r.totals.seatHolders).toBe(2);
  });

  it('excludes customers and app accounts, and reports deactivated accounts separately', () => {
    const r = report([
      role('sw', 'Jira Software'),
      group('g'),
      roleGroup('sw', 'g'),
      member('g', 'human'),
      member('g', 'cust'),
      member('g', 'bot'),
      member('g', 'gone'),
      person('human'),
      person('cust', true, 'customer'),
      person('bot', true, 'app'),
      person('gone', false),
    ]);
    expect(r.products[0].seats).toBe(1);
    expect(r.products[0].deactivated).toBe(1);
    expect(r.totals.deactivated).toBe(1);
  });

  it('flags seat holders with no space access and holders of several products', () => {
    const r = report(
      [
        ...siteFacts()
          .filter(
            (f) =>
              f.kind !== 'app_role' &&
              f.kind !== 'app_role_group' &&
              !(f.kind === 'grant' && f.attrs.holderType === 'applicationRole'),
          )
          .map((f) => ({ kind: f.kind, fkey: f.fkey, attrs: f.attrs }) as Fact<any>),
        role('sw', 'Jira Software'),
        role('jsm', 'Jira Service Management'),
        group('gx'),
        roleGroup('sw', 'gx'),
        roleGroup('jsm', 'gx'),
        member('gx', 'nobody'),
        person('nobody'),
        member('gx', 'alice'),
      ].map((f) => ('attrs' in f && 'at' in f ? f : (f as any))) as any,
    );
    const nobody = r.people.find((p) => p.accountId === 'nobody')!;
    expect(nobody.flags).toEqual(['no-space-access', 'multiple-products']);
    expect(nobody.products).toEqual(['Jira Service Management', 'Jira Software']);
    const alice = r.people.find((p) => p.accountId === 'alice')!;
    expect(alice.flags).toEqual(['multiple-products']);
    expect(alice.spaces).toBeGreaterThan(0);
    expect(r.people[0].accountId).toBe('nobody');
  });

  it('is partial, and counts no members, for a group whose members were not read', () => {
    const r = report([
      role('sw', 'Jira Software'),
      group('hidden', 'unreadable'),
      roleGroup('sw', 'hidden'),
    ]);
    expect(r.products[0].partial).toBe(true);
    expect(r.products[0].groups[0].members).toBeNull();
    expect(r.products[0].seats).toBe(0);
  });

  it('counts empty product groups and handles a site without application roles', () => {
    const r = report([role('sw', 'Jira Software'), group('e'), roleGroup('sw', 'e')]);
    expect(r.products[0].emptyGroups).toBe(1);
    expect(report([]).noProducts).toBe(true);
  });

  it('never claims activity', () => {
    const r = report([
      role('sw', 'Jira Software'),
      group('g'),
      roleGroup('sw', 'g'),
      member('g', 'a'),
      person('a'),
    ]);
    expect(JSON.stringify(r)).not.toMatch(/last.?(login|active)|days since|inactive for/i);
  });
});
