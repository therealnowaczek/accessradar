/**
 * Tracked-group changes (C3): for each group the admin tracks, what changed in the spaces it can
 * reach and in its membership between two snapshots. Names are group names and space keys only;
 * members are counted, never listed. Pure; no Jira access.
 */
import type { EffectiveAccess } from '../engine/resolve';
import type { AccessState } from '../engine/state';
import { groupReach } from './views';

export const TRACKED_GROUPS_MAX = 50;

export interface SpaceReach {
  key: string;
  name: string;
  permissions: string[];
}

export interface TrackedGroupChange {
  groupId: string;
  name: string;
  /** `gone`: the group is not in the newer snapshot (deleted or renamed away). */
  status: 'changed' | 'unchanged' | 'gone';
  spacesAdded: SpaceReach[];
  spacesRemoved: SpaceReach[];
  permissionsChanged: Array<{ key: string; name: string; added: string[]; removed: string[] }>;
  /** Null when the members of the group were not read in both snapshots. */
  membersJoined: number | null;
  membersLeft: number | null;
}

export interface TrackedGroupsSummary {
  tracked: number;
  changed: number;
  changes: TrackedGroupChange[];
}

type Reach = Map<string, Set<string>>; // projectId -> permissions

const space = (state: AccessState, projectId: string, perms: Iterable<string>): SpaceReach => {
  const p = state.projects.get(projectId);
  return { key: p?.key ?? projectId, name: p?.name ?? projectId, permissions: [...perms].sort() };
};

export function diffTrackedGroups(
  prev: AccessState,
  next: AccessState,
  prevEntries: EffectiveAccess[],
  nextEntries: EffectiveAccess[],
  trackedIds: readonly string[],
): TrackedGroupsSummary {
  const prevReach = groupReach(prev, prevEntries);
  const nextReach = groupReach(next, nextEntries);
  const reach = (m: ReturnType<typeof groupReach>, id: string): Reach => {
    const out: Reach = new Map();
    for (const [projectId, perms] of m.get(id) ?? []) out.set(projectId, new Set(perms.keys()));
    return out;
  };
  const changes: TrackedGroupChange[] = [];
  let tracked = 0;
  for (const id of [...new Set(trackedIds)].slice(0, TRACKED_GROUPS_MAX)) {
    const before = prev.groups.get(id);
    const after = next.groups.get(id);
    if (!before && !after) continue;
    tracked += 1;
    if (!after) {
      changes.push({
        groupId: id,
        name: before!.name,
        status: 'gone',
        spacesAdded: [],
        spacesRemoved: [],
        permissionsChanged: [],
        membersJoined: null,
        membersLeft: null,
      });
      continue;
    }
    const a = reach(prevReach, id);
    const b = reach(nextReach, id);
    const spacesAdded = [...b].filter(([p]) => !a.has(p)).map(([p, s]) => space(next, p, s));
    const spacesRemoved = [...a].filter(([p]) => !b.has(p)).map(([p, s]) => space(prev, p, s));
    const permissionsChanged: TrackedGroupChange['permissionsChanged'] = [];
    for (const [p, perms] of b) {
      const was = a.get(p);
      if (!was) continue;
      const added = [...perms].filter((x) => !was.has(x)).sort();
      const removed = [...was].filter((x) => !perms.has(x)).sort();
      if (added.length || removed.length) {
        const sp = space(next, p, []);
        permissionsChanged.push({ key: sp.key, name: sp.name, added, removed });
      }
    }
    let membersJoined: number | null = null;
    let membersLeft: number | null = null;
    const m0 = prev.groupMembers.get(id);
    const m1 = next.groupMembers.get(id);
    if (m0 && m1 && before?.members === 'collected' && after.members === 'collected') {
      const s0 = new Set(m0);
      const s1 = new Set(m1);
      membersJoined = m1.filter((m) => !s0.has(m)).length;
      membersLeft = m0.filter((m) => !s1.has(m)).length;
    }
    const changed =
      spacesAdded.length > 0 ||
      spacesRemoved.length > 0 ||
      permissionsChanged.length > 0 ||
      Boolean(membersJoined) ||
      Boolean(membersLeft);
    changes.push({
      groupId: id,
      name: after.name,
      status: changed ? 'changed' : 'unchanged',
      spacesAdded: spacesAdded.sort((x, y) => x.key.localeCompare(y.key)),
      spacesRemoved: spacesRemoved.sort((x, y) => x.key.localeCompare(y.key)),
      permissionsChanged: permissionsChanged.sort((x, y) => x.key.localeCompare(y.key)),
      membersJoined,
      membersLeft,
    });
  }
  const shown = changes.filter((c) => c.status !== 'unchanged');
  return { tracked, changed: shown.length, changes: shown };
}
