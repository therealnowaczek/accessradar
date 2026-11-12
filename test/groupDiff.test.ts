import { describe, expect, it } from 'vitest';
import { diffTrackedGroups, TRACKED_GROUPS_MAX } from '../src/api/groupDiff';
import { buildWeeklyDigest } from '../src/engine/digest';
import { resolveAll } from '../src/engine/resolve';
import { buildState } from '../src/engine/state';
import { sanitizeSettings } from '../src/db/settings';
import { siteFacts, withChanges } from './fixtures';

const before = buildState(siteFacts());
const diff = (next: ReturnType<typeof buildState>, ids: string[]) =>
  diffTrackedGroups(before, next, resolveAll(before), resolveAll(next), ids);

describe('diffTrackedGroups', () => {
  it('reports nothing for an unchanged group', () => {
    const r = diff(before, ['g-admins']);
    expect(r).toEqual({ tracked: 1, changed: 0, changes: [] });
  });

  it('reports a space the group no longer reaches', () => {
    const next = buildState(withChanges(siteFacts(), [], ['role_actor:p1:10002:group:g-admins']));
    const r = diff(next, ['g-admins']);
    expect(r.changed).toBe(1);
    expect(r.changes[0].spacesRemoved.map((s) => s.key)).toContain('ALPHA');
  });

  it('counts members who joined or left without naming them', () => {
    const next = buildState(
      withChanges(
        siteFacts(),
        [
          {
            kind: 'group_member',
            fkey: 'g-admins:carol',
            attrs: { groupId: 'g-admins', accountId: 'carol' },
          },
        ],
        ['group_member:g-admins:bob'],
      ),
    );
    const c = diff(next, ['g-admins']).changes[0];
    expect(c.membersJoined).toBe(1);
    expect(c.membersLeft).toBe(1);
    expect(JSON.stringify(c)).not.toMatch(/carol|bob/i);
  });

  it('leaves member counts null when members were not read', () => {
    const next = buildState(siteFacts());
    const r = diff(next, ['g-secret']);
    expect(r.changed).toBe(0);
  });

  it('flags a tracked group that disappeared', () => {
    const next = buildState(withChanges(siteFacts(), [], ['group:g-devs']));
    const c = diff(next, ['g-devs']).changes[0];
    expect(c.status).toBe('gone');
  });

  it('ignores ids that were never groups', () => {
    expect(diff(before, ['nope']).tracked).toBe(0);
  });
});

describe('weekly digest with tracked groups', () => {
  const refs = {
    base: { seq: 1, startedAt: 1 },
    head: { seq: 2, startedAt: 2 },
    partialWeek: false,
  };
  it('adds the section only when groups are tracked', () => {
    expect(buildWeeklyDigest(before, before, refs, 10).trackedGroups).toBeUndefined();
    const d = buildWeeklyDigest(before, before, refs, 10, undefined, undefined, ['g-admins']);
    expect(d.trackedGroups?.tracked).toBe(1);
  });
});

describe('trackedGroups setting', () => {
  it('keeps valid unique ids, drops junk and caps at the maximum', () => {
    const many = Array.from({ length: TRACKED_GROUPS_MAX + 10 }, (_, i) => `g${i}`);
    expect(sanitizeSettings({ trackedGroups: ['a', 'a', 'b', 7, '<x>'] }).trackedGroups).toEqual([
      'a',
      'b',
    ]);
    expect(sanitizeSettings({ trackedGroups: many }).trackedGroups).toHaveLength(
      TRACKED_GROUPS_MAX,
    );
    expect(sanitizeSettings({}).trackedGroups).toEqual([]);
  });
});
