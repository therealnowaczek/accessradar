/**
 * Pure effective-access resolver (no I/O). Given one snapshot's state it explains, for every
 * project permission, which people (or which unexpanded holders) get it and through which path:
 * scheme grant -> project role -> group -> person, application access, named user, project lead.
 * Conditional holders (reporter, assignee, custom fields) are never expanded to people.
 */
import type { GrantAttrs } from './facts';
import { groupIdFor, membersOf, type AccessState } from './state';

export const ENGINE_VERSION = '1.0.0';

export const DEFAULT_KEY_PERMISSIONS = [
  'BROWSE_PROJECTS',
  'CREATE_ISSUES',
  'EDIT_ISSUES',
  'DELETE_ISSUES',
  'ADMINISTER_PROJECTS',
];

export type PathStep =
  | { kind: 'scheme'; schemeId: string; grantId: string; permission: string }
  | { kind: 'role'; roleId: string }
  | { kind: 'group'; groupId: string }
  | { kind: 'appRole'; appKey: string }
  | { kind: 'direct' }
  | { kind: 'projectLead' };

export type Subject =
  | { type: 'user'; accountId: string }
  /** A group whose members could not be read or were not collected. */
  | { type: 'group'; groupId: string }
  | { type: 'conditional'; holderType: string }
  | { type: 'anonymous' };

export interface EffectiveAccess {
  projectId: string;
  permission: string;
  subject: Subject;
  path: PathStep[];
  /** true when part of the path could not be expanded to people. */
  partial?: boolean;
}

export const CONDITIONAL_HOLDERS = new Set([
  'reporter',
  'assignee',
  'userCustomField',
  'groupCustomField',
  'reporterWithCreatePermission',
  'assigneeWithAssignablePermission',
  'sd.customer.portal.only',
]);

export function subjectKey(s: Subject): string {
  switch (s.type) {
    case 'user':
      return `user:${s.accountId}`;
    case 'group':
      return `group:${s.groupId}`;
    case 'conditional':
      return `conditional:${s.holderType}`;
    default:
      return 'anonymous';
  }
}

function expandGroup(
  state: AccessState,
  groupId: string,
  base: PathStep[],
  projectId: string,
  permission: string,
): EffectiveAccess[] {
  const path: PathStep[] = [...base, { kind: 'group', groupId }];
  const members = membersOf(state, groupId);
  if (!members)
    return [{ projectId, permission, subject: { type: 'group', groupId }, path, partial: true }];
  return members.map((accountId) => ({
    projectId,
    permission,
    subject: { type: 'user', accountId },
    path,
  }));
}

/** Groups reached by an applicationRole holder ('*' / missing = any Jira application). */
export function appRoleGroupsFor(state: AccessState, appKey: string): string[] {
  if (appKey === '*') return [...new Set([...state.appRoleGroups.values()].flat())];
  return state.appRoleGroups.get(appKey) ?? [];
}

export function resolveGrant(
  state: AccessState,
  g: GrantAttrs,
  projectId: string,
): EffectiveAccess[] {
  const out: EffectiveAccess[] = [];
  const project = state.projects.get(projectId);
  const base: PathStep[] = [
    { kind: 'scheme', schemeId: g.schemeId, grantId: g.grantId, permission: g.permission },
  ];
  const { permission } = g;
  switch (g.holderType) {
    case 'projectRole': {
      const roleId = g.holderParam ?? '';
      const actors = state.roleActors.get(projectId)?.get(roleId);
      if (!actors) break;
      const rolePath: PathStep[] = [...base, { kind: 'role', roleId }];
      for (const accountId of actors.users)
        out.push({ projectId, permission, subject: { type: 'user', accountId }, path: rolePath });
      for (const groupId of actors.groups)
        out.push(...expandGroup(state, groupId, rolePath, projectId, permission));
      break;
    }
    case 'group': {
      const groupId = groupIdFor(state, g.holderParam ?? g.holderName);
      if (groupId) out.push(...expandGroup(state, groupId, base, projectId, permission));
      break;
    }
    case 'user':
      if (g.holderParam)
        out.push({
          projectId,
          permission,
          subject: { type: 'user', accountId: g.holderParam },
          path: [...base, { kind: 'direct' }],
        });
      break;
    case 'projectLead':
      if (project?.leadAccountId)
        out.push({
          projectId,
          permission,
          subject: { type: 'user', accountId: project.leadAccountId },
          path: [...base, { kind: 'projectLead' }],
        });
      break;
    case 'applicationRole': {
      const appKey = g.holderParam || '*';
      for (const groupId of appRoleGroupsFor(state, appKey))
        out.push(
          ...expandGroup(
            state,
            groupId,
            [...base, { kind: 'appRole', appKey }],
            projectId,
            permission,
          ),
        );
      break;
    }
    case 'anyone':
      out.push({ projectId, permission, subject: { type: 'anonymous' }, path: base });
      break;
    default:
      out.push({
        projectId,
        permission,
        subject: { type: 'conditional', holderType: g.holderType },
        path: base,
        partial: !CONDITIONAL_HOLDERS.has(g.holderType),
      });
  }
  return out;
}

/** Every effective access entry for one project (all permissions). */
export function resolveProject(state: AccessState, projectId: string): EffectiveAccess[] {
  const project = state.projects.get(projectId);
  if (!project?.schemeId) return [];
  const grants = state.grantsByScheme.get(project.schemeId) ?? [];
  return grants.flatMap((g) => resolveGrant(state, g, projectId));
}

export function resolveAll(state: AccessState): EffectiveAccess[] {
  return [...state.projects.keys()].flatMap((id) => resolveProject(state, id));
}

export interface SubjectAccess {
  subject: Subject;
  projectId: string;
  /** permission -> distinct paths */
  perms: Map<string, PathStep[][]>;
  partial: boolean;
}

const pathId = (path: PathStep[]) => JSON.stringify(path);

/** Groups entries by (subject, project) and de-duplicates identical paths. */
export function aggregate(entries: EffectiveAccess[]): SubjectAccess[] {
  const map = new Map<string, SubjectAccess>();
  const seen = new Set<string>();
  for (const e of entries) {
    const key = `${subjectKey(e.subject)}|${e.projectId}`;
    let row = map.get(key);
    if (!row)
      map.set(
        key,
        (row = { subject: e.subject, projectId: e.projectId, perms: new Map(), partial: false }),
      );
    const dedupe = `${key}|${e.permission}|${pathId(e.path)}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    const list = row.perms.get(e.permission);
    if (list) list.push(e.path);
    else row.perms.set(e.permission, [e.path]);
    if (e.partial) row.partial = true;
  }
  return [...map.values()];
}

/** Human-readable reason, innermost first: "group “devs” → role “Developers” → scheme “Default”". */
export function describePath(state: AccessState, path: PathStep[]): string {
  const parts: string[] = [];
  for (const step of [...path].reverse()) {
    switch (step.kind) {
      case 'group':
        parts.push(`group “${state.groups.get(step.groupId)?.name ?? step.groupId}”`);
        break;
      case 'role':
        parts.push(`role “${state.roles.get(step.roleId)?.name ?? step.roleId}”`);
        break;
      case 'appRole':
        parts.push(
          step.appKey === '*'
            ? 'any Jira application access'
            : `application access “${state.appRoles.get(step.appKey)?.name ?? step.appKey}”`,
        );
        break;
      case 'direct':
        parts.push('named user');
        break;
      case 'projectLead':
        parts.push('project lead');
        break;
      case 'scheme':
        parts.push(`scheme “${state.schemes.get(step.schemeId)?.name ?? step.schemeId}”`);
        break;
    }
  }
  return parts.join(' → ');
}

/** Machine-readable path for exports: "group:123>role:10002>scheme:10033#11021". */
export function pathCode(path: PathStep[]): string {
  return [...path]
    .reverse()
    .map((s) => {
      switch (s.kind) {
        case 'group':
          return `group:${s.groupId}`;
        case 'role':
          return `role:${s.roleId}`;
        case 'appRole':
          return `app:${s.appKey}`;
        case 'direct':
          return 'user';
        case 'projectLead':
          return 'lead';
        case 'scheme':
          return `scheme:${s.schemeId}#${s.grantId}`;
      }
    })
    .join('>');
}

/** Short label of the first hop, used for path chips (role / group / app / direct / lead). */
export function viaLabel(state: AccessState, path: PathStep[]): { kind: string; label: string } {
  const inner = [...path].reverse().find((s) => s.kind !== 'scheme');
  const outer = path.find((s) => s.kind === 'role' || s.kind === 'appRole');
  if (outer?.kind === 'role')
    return { kind: 'role', label: state.roles.get(outer.roleId)?.name ?? outer.roleId };
  if (outer?.kind === 'appRole')
    return {
      kind: 'app',
      label:
        outer.appKey === '*'
          ? 'Any application'
          : (state.appRoles.get(outer.appKey)?.name ?? outer.appKey),
    };
  if (inner?.kind === 'group')
    return { kind: 'group', label: state.groups.get(inner.groupId)?.name ?? inner.groupId };
  if (inner?.kind === 'projectLead') return { kind: 'lead', label: 'Project lead' };
  if (inner?.kind === 'direct') return { kind: 'direct', label: 'Named user' };
  return { kind: 'scheme', label: 'Scheme grant' };
}
