import { describe, expect, it } from 'vitest';
import {
  buildWeeklyDigest,
  DIGEST_WINDOW_MS,
  emptyCounts,
  emptyDigest,
  pickDigestSnapshots,
} from '../src/engine/digest';
import type { AccessState } from '../src/engine/state';

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

const DAY = 24 * 3600_000;
const NOW = 1_800_000_000_000;

function adminState(members: string[], inactive: string[] = []): AccessState {
  const ids = ['u1', 'u2', 'u3', 'u4'];
  return emptyState({
    groups: new Map([['g1', { name: 'jira-admins' }]]),
    groupAccess: new Map([['g1', ['admin']]]),
    groupMembers: new Map([['g1', members]]),
    persons: new Map(
      ids.map((id) => [
        id,
        { displayName: id.toUpperCase(), accountType: 'atlassian', active: !inactive.includes(id) },
      ]),
    ),
  });
}

describe('pickDigestSnapshots', () => {
  it('returns no head without snapshots', () => {
    expect(pickDigestSnapshots([], NOW)).toEqual({ head: null, base: null, partialWeek: false });
  });

  it('returns no base with a single snapshot', () => {
    const r = pickDigestSnapshots([{ seq: 1, startedAt: NOW - DAY }], NOW);
    expect(r.head?.seq).toBe(1);
    expect(r.base).toBeNull();
  });

  it('uses the snapshot current at the start of the week as base', () => {
    const r = pickDigestSnapshots(
      [
        { seq: 1, startedAt: NOW - 20 * DAY },
        { seq: 3, startedAt: NOW - 3 * DAY },
        { seq: 2, startedAt: NOW - 8 * DAY },
        { seq: 4, startedAt: NOW - DAY },
      ],
      NOW,
    );
    expect(r.head?.seq).toBe(4);
    expect(r.base?.seq).toBe(2);
    expect(r.partialWeek).toBe(false);
  });

  it('falls back to the oldest snapshot and flags a partial week', () => {
    const r = pickDigestSnapshots(
      [
        { seq: 5, startedAt: NOW - 4 * DAY },
        { seq: 6, startedAt: NOW - 2 * DAY },
        { seq: 7, startedAt: NOW - DAY },
      ],
      NOW,
    );
    expect(r.head?.seq).toBe(7);
    expect(r.base?.seq).toBe(5);
    expect(r.partialWeek).toBe(true);
  });
});

describe('buildWeeklyDigest', () => {
  const refs = {
    base: { seq: 1, startedAt: NOW - 8 * DAY },
    head: { seq: 2, startedAt: NOW - DAY },
    partialWeek: false,
  };

  it('counts every change type and reports the 7 day window', () => {
    const d = buildWeeklyDigest(adminState([]), adminState(['u1', 'u2']), refs, NOW);
    expect(d.status).toBe('ready');
    expect(d.counts['new-admin']).toBe(2);
    expect(d.total).toBe(2);
    expect(d.items).toHaveLength(2);
    expect(d.omitted).toBe(0);
    expect(d.periodStart).toBe(NOW - DIGEST_WINDOW_MS);
    expect(d.periodEnd).toBe(NOW);
    expect(d.base?.seq).toBe(1);
    expect(d.head?.seq).toBe(2);
  });

  it('is empty when nothing changed', () => {
    const d = buildWeeklyDigest(adminState(['u1']), adminState(['u1']), refs, NOW);
    expect(d.total).toBe(0);
    expect(d.items).toEqual([]);
    expect(d.counts).toEqual(emptyCounts());
  });

  it('caps the listed items but keeps full counts', () => {
    const d = buildWeeklyDigest(adminState([]), adminState(['u1', 'u2', 'u3']), refs, NOW, 2);
    expect(d.counts['new-admin']).toBe(3);
    expect(d.total).toBe(3);
    expect(d.items).toHaveLength(2);
    expect(d.omitted).toBe(1);
  });

  it('lists high severity before medium', () => {
    const d = buildWeeklyDigest(adminState(['u4']), adminState(['u1', 'u4'], ['u4']), refs, NOW);
    const sev = d.items.map((i) => i.severity);
    const firstMedium = sev.indexOf('medium');
    if (firstMedium >= 0) expect(sev.slice(firstMedium)).not.toContain('high');
    expect(d.total).toBe(d.items.length);
  });

  it('uses the base snapshot time as period start for a partial week', () => {
    const d = buildWeeklyDigest(
      adminState([]),
      adminState(['u1']),
      { ...refs, partialWeek: true },
      NOW,
    );
    expect(d.partialWeek).toBe(true);
    expect(d.periodStart).toBe(refs.base.startedAt);
  });
});

describe('emptyDigest', () => {
  it('carries the status, head and zero counts', () => {
    const d = emptyDigest('no-baseline', NOW, { seq: 3, startedAt: NOW - DAY });
    expect(d.status).toBe('no-baseline');
    expect(d.head?.seq).toBe(3);
    expect(d.base).toBeNull();
    expect(d.total).toBe(0);
    expect(d.counts).toEqual(emptyCounts());
  });
});
