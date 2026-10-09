import { aggregate, resolveAll, type EffectiveAccess } from './resolve';
import type { AccessState } from './state';

export type Severity = 'high' | 'medium' | 'low';

export interface RiskItem {
  id: string;
  label: string;
  detail?: string;
}
export interface Risk {
  id: 'anonymous' | 'broad-app-role' | 'admins' | 'wide-admin' | 'inactive' | 'large-groups';
  severity: Severity;
  title: string;
  description: string;
  count: number;
  items: RiskItem[];
}

export interface RiskOptions {
  largeGroupThreshold: number;
  /** People with ADMINISTER_PROJECTS in at least this many projects are "wide". */
  wideAdminProjects: number;
  includeAppAccounts: boolean;
}

const BROAD_PERMS = new Set([
  'BROWSE_PROJECTS',
  'EDIT_ISSUES',
  'DELETE_ISSUES',
  'ADMINISTER_PROJECTS',
]);

export function isAppAccount(state: AccessState, accountId: string) {
  const t = state.persons.get(accountId)?.accountType;
  return t !== undefined && t !== 'atlassian';
}

/** Global admins: members of groups with admin / site-admin access. */
export function adminAccounts(state: AccessState): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [groupId, access] of state.groupAccess) {
    const levels = access.filter((a) => a === 'admin' || a === 'site-admin');
    if (!levels.length) continue;
    for (const accountId of state.groupMembers.get(groupId) ?? []) {
      const list = out.get(accountId) ?? [];
      list.push(groupId);
      out.set(accountId, list);
    }
  }
  return out;
}

export function computeRisks(
  state: AccessState,
  opts: RiskOptions,
  entries: EffectiveAccess[] = resolveAll(state),
): Risk[] {
  const keep = (accountId: string) => opts.includeAppAccounts || !isAppAccount(state, accountId);
  const name = (accountId: string) => state.persons.get(accountId)?.displayName ?? accountId;
  const projectsForScheme = (schemeId: string) =>
    [...state.projects.entries()].filter(([, p]) => p.schemeId === schemeId);

  const anonymous = state.grants
    .filter((g) => g.holderType === 'anyone')
    .flatMap((g) =>
      projectsForScheme(g.schemeId).map(([pid, p]) => ({
        id: `${pid}:${g.permission}`,
        label: `${p.key}: ${g.permission}`,
        detail: state.schemes.get(g.schemeId)?.name,
      })),
    );

  const broad = state.grants
    .filter((g) => g.holderType === 'applicationRole' && BROAD_PERMS.has(g.permission))
    .flatMap((g) =>
      projectsForScheme(g.schemeId).map(([pid, p]) => ({
        id: `${pid}:${g.permission}:${g.holderParam ?? '*'}`,
        label: `${p.key}: ${g.permission}`,
        detail: g.holderParam
          ? `Everyone with ${state.appRoles.get(g.holderParam)?.name ?? g.holderParam}`
          : 'Everyone with any Jira application access',
      })),
    );

  const admins = [...adminAccounts(state)]
    .filter(([id]) => keep(id))
    .map(([id, groups]) => ({
      id,
      label: name(id),
      detail: groups.map((g) => state.groups.get(g)?.name ?? g).join(', '),
    }));

  const rows = aggregate(entries);
  const adminProjects = new Map<string, Set<string>>();
  const withAccess = new Map<string, Set<string>>();
  for (const r of rows) {
    if (r.subject.type !== 'user') continue;
    const id = r.subject.accountId;
    if (!withAccess.has(id)) withAccess.set(id, new Set());
    withAccess.get(id)!.add(r.projectId);
    if (r.perms.has('ADMINISTER_PROJECTS')) {
      if (!adminProjects.has(id)) adminProjects.set(id, new Set());
      adminProjects.get(id)!.add(r.projectId);
    }
  }
  const wide = [...adminProjects]
    .filter(([id, set]) => keep(id) && set.size >= opts.wideAdminProjects)
    .sort((a, b) => b[1].size - a[1].size)
    .map(([id, set]) => ({ id, label: name(id), detail: `${set.size} projects` }));

  const inactive = [...withAccess]
    .filter(([id]) => state.persons.get(id)?.active === false && keep(id))
    .map(([id, set]) => ({ id, label: name(id), detail: `${set.size} projects` }));

  const usedGroups = new Set<string>();
  for (const e of entries)
    for (const step of e.path) if (step.kind === 'group') usedGroups.add(step.groupId);
  const large = [...state.groupMembers]
    .filter(([id, m]) => m.length >= opts.largeGroupThreshold && usedGroups.has(id))
    .sort((a, b) => b[1].length - a[1].length)
    .map(([id, m]) => ({
      id,
      label: state.groups.get(id)?.name ?? id,
      detail: `${m.length} members`,
    }));

  const risks: Risk[] = [
    {
      id: 'anonymous',
      severity: 'high',
      title: 'Anonymous access',
      description: 'Permissions granted to “Anyone”, including people who are not logged in.',
      count: anonymous.length,
      items: anonymous,
    },
    {
      id: 'inactive',
      severity: 'high',
      title: 'Inactive users with access',
      description: 'Deactivated accounts that still hold project permissions.',
      count: inactive.length,
      items: inactive,
    },
    {
      id: 'admins',
      severity: 'medium',
      title: 'Jira administrators',
      description: 'Members of groups with admin or site-admin access (partial global view).',
      count: admins.length,
      items: admins,
    },
    {
      id: 'wide-admin',
      severity: 'medium',
      title: 'Wide project admin access',
      description: `People who can administer ${opts.wideAdminProjects} or more projects.`,
      count: wide.length,
      items: wide,
    },
    {
      id: 'broad-app-role',
      severity: 'medium',
      title: 'Broad application-role grants',
      description: 'Key permissions granted to everyone with access to a Jira application.',
      count: broad.length,
      items: broad,
    },
    {
      id: 'large-groups',
      severity: 'low',
      title: 'Large groups in use',
      description: `Groups with ${opts.largeGroupThreshold} or more members that grant access.`,
      count: large.length,
      items: large,
    },
  ];
  return risks;
}
