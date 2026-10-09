import { canonicalJson, sha256 } from './facts';
import {
  aggregate,
  describePath,
  pathCode,
  resolveAll,
  resolveProject,
  subjectKey,
} from './resolve';
import type { AccessState } from './state';

export interface ReviewScope {
  type: 'site' | 'projects' | 'groups';
  ids: string[];
}

export type ItemChange = 'new' | 'unchanged' | 'removed' | null;
export type Decision = 'keep' | 'revoke' | null;

export interface ReviewItemDraft {
  itemKey: string;
  subjectType: 'user' | 'group' | 'anonymous' | 'conditional';
  subjectId: string;
  projectId: string | null;
  groupId: string | null;
  permissions: string[];
  reasons: string[];
  pathCodes: string[];
  change: ItemChange;
  risk: number;
}

function subjectParts(key: string): { type: ReviewItemDraft['subjectType']; id: string } {
  const [type, ...rest] = key.split(':');
  if (type === 'anonymous') return { type: 'anonymous', id: 'anyone' };
  return { type: type as ReviewItemDraft['subjectType'], id: rest.join(':') };
}

function projectItems(
  state: AccessState,
  projectIds: string[],
  keyPerms: ReadonlySet<string>,
): ReviewItemDraft[] {
  const entries = projectIds.flatMap((id) => resolveProject(state, id));
  const out: ReviewItemDraft[] = [];
  for (const row of aggregate(entries)) {
    const perms = [...row.perms.keys()].filter((p) => keyPerms.has(p)).sort();
    if (!perms.length) continue;
    const sk = subjectKey(row.subject);
    const { type, id } = subjectParts(sk);
    const paths = perms.flatMap((p) => row.perms.get(p)!);
    const reasons = [...new Set(paths.map((p) => describePath(state, p)))];
    const codes = [...new Set(paths.map(pathCode))];
    const person = type === 'user' ? state.persons.get(id) : undefined;
    let risk = 10;
    if (type === 'anonymous') risk = 100;
    else if (type === 'group' || row.partial) risk = 80;
    else if (person?.active === false) risk = 70;
    else if (perms.includes('ADMINISTER_PROJECTS')) risk = 50;
    out.push({
      itemKey: `p|${row.projectId}|${sk}`,
      subjectType: type,
      subjectId: id,
      projectId: row.projectId,
      groupId: null,
      permissions: perms,
      reasons,
      pathCodes: codes,
      change: null,
      risk,
    });
  }
  return out;
}

function groupItems(state: AccessState, groupIds: string[]): ReviewItemDraft[] {
  const entries = resolveAll(state);
  const reach = new Map<string, Set<string>>();
  for (const e of entries)
    for (const s of e.path)
      if (s.kind === 'group') {
        if (!reach.has(s.groupId)) reach.set(s.groupId, new Set());
        reach.get(s.groupId)!.add(e.projectId);
      }
  const out: ReviewItemDraft[] = [];
  for (const groupId of groupIds) {
    const g = state.groups.get(groupId);
    const members = state.groupMembers.get(groupId);
    const projects = reach.get(groupId)?.size ?? 0;
    const admin = (state.groupAccess.get(groupId) ?? []).some((a) => a.includes('admin'));
    const reason = `member of group “${g?.name ?? groupId}” (reaches ${projects} project${projects === 1 ? '' : 's'}${admin ? ', admin access' : ''})`;
    if (!members) {
      out.push({
        itemKey: `g|${groupId}|group:${groupId}`,
        subjectType: 'group',
        subjectId: groupId,
        projectId: null,
        groupId,
        permissions: [],
        reasons: ['members could not be read'],
        pathCodes: [`group:${groupId}`],
        change: null,
        risk: 80,
      });
      continue;
    }
    for (const accountId of members) {
      const person = state.persons.get(accountId);
      out.push({
        itemKey: `g|${groupId}|user:${accountId}`,
        subjectType: 'user',
        subjectId: accountId,
        projectId: null,
        groupId,
        permissions: admin ? ['GLOBAL_ADMIN'] : [],
        reasons: [reason],
        pathCodes: [`group:${groupId}`],
        change: null,
        risk: person?.active === false ? 70 : admin ? 50 : 10,
      });
    }
  }
  return out;
}

/** Materialises review items for the scope; with a comparison state, marks new and removed items. */
export function buildReviewItems(
  state: AccessState,
  scope: ReviewScope,
  keyPermissions: string[],
  compare?: AccessState,
): ReviewItemDraft[] {
  const keyPerms = new Set(keyPermissions);
  const build = (s: AccessState) => {
    if (scope.type === 'groups')
      return groupItems(
        s,
        scope.ids.filter((id) => s.groups.has(id)),
      );
    const ids =
      scope.type === 'site' ? [...s.projects.keys()] : scope.ids.filter((id) => s.projects.has(id));
    return projectItems(s, ids, keyPerms);
  };
  const items = build(state);
  if (!compare) return sortItems(items);
  const before = new Map(build(compare).map((i) => [i.itemKey, i]));
  for (const item of items) {
    item.change = before.has(item.itemKey) ? 'unchanged' : 'new';
    if (item.change === 'new') item.risk = Math.max(item.risk, 60);
  }
  const current = new Set(items.map((i) => i.itemKey));
  for (const [key, old] of before)
    if (!current.has(key)) items.push({ ...old, change: 'removed', risk: 5 });
  return sortItems(items);
}

function sortItems(items: ReviewItemDraft[]) {
  return items.sort((a, b) => b.risk - a.risk || a.itemKey.localeCompare(b.itemKey));
}

export interface EvidenceInput {
  reviewId: string;
  name: string;
  scope: ReviewScope;
  base: { seq: number; contentHash: string | null };
  compare: { seq: number; contentHash: string | null } | null;
  engineVersion: string;
  signedBy: string;
  signedAt: string; // ISO UTC
  items: Array<{
    itemKey: string;
    subjectType: string;
    subjectId: string;
    projectId: string | null;
    groupId: string | null;
    permissions: string[];
    pathCodes: string[];
    change: ItemChange;
    decision: Decision;
    note: string | null;
    decidedBy: string | null;
    decidedAt: string | null;
  }>;
}

/** Canonical evidence document; its SHA-256 is the review's evidence hash.
 *  Uses accountIds only, so privacy anonymisation of names does not break verification. */
export function evidenceDocument(input: EvidenceInput): string {
  const items = [...input.items].sort((a, b) => a.itemKey.localeCompare(b.itemKey));
  return canonicalJson({
    ...input,
    items,
    scope: { ...input.scope, ids: [...input.scope.ids].sort() },
  });
}

export function evidenceHash(input: EvidenceInput): string {
  return sha256(evidenceDocument(input));
}
