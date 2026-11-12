import { RISK_LEARN_MORE } from '../domain/riskCopy';
import { DEFAULT_KEY_PERMISSIONS, aggregate, resolveAll, type EffectiveAccess } from './resolve';
import type { AccessState } from './state';
import type { SharedItem } from '../lib/exposure';

export type Severity = 'high' | 'medium' | 'low';

export type RiskId =
  | 'anonymous'
  | 'broad-app-role'
  | 'admins'
  | 'wide-admin'
  | 'inactive'
  | 'large-groups'
  | 'project-no-admin'
  | 'direct-user-grants'
  | 'unused-schemes'
  | 'empty-groups-in-use'
  | 'app-accounts-admin'
  | 'anonymous-write'
  | 'inactive-admin'
  | 'destructive-large-group'
  | 'admin-group-large'
  | 'empty-admin-groups'
  | 'project-single-admin'
  | 'filters-public'
  | 'dashboards-public'
  | 'shared-loggedin';

export interface RiskItem {
  id: string;
  label: string;
  detail?: string;
}
export interface Risk {
  id: RiskId;
  severity: Severity;
  title: string;
  description: string;
  learnMore: string;
  count: number;
  items: RiskItem[];
  /** True when incomplete data means we cannot claim “none found”. */
  partial: boolean;
}

export interface RiskOptions {
  largeGroupThreshold: number;
  /** People with ADMINISTER_PROJECTS in at least this many projects are "wide". */
  wideAdminProjects: number;
  includeAppAccounts: boolean;
  /** Key permissions used for direct-user-grants (defaults to engine defaults). */
  keyPermissions?: string[];
}

const BROAD_PERMS = new Set([
  'BROWSE_PROJECTS',
  'EDIT_ISSUES',
  'DELETE_ISSUES',
  'ADMINISTER_PROJECTS',
]);

/** Anonymous grants that only read; anything else granted to "Anyone" is write-capable. */
const READ_ONLY_PERMS = new Set([
  'BROWSE_PROJECTS',
  'VIEW_DEV_TOOLS',
  'VIEW_READONLY_WORKFLOW',
  'VIEW_VOTERS_AND_WATCHERS',
]);

/** Permissions that destroy data or change who has access. */
const DESTRUCTIVE_PERMS = new Set([
  'DELETE_ISSUES',
  'DELETE_ALL_COMMENTS',
  'DELETE_ALL_ATTACHMENTS',
  'DELETE_ALL_WORKLOGS',
  'ADMINISTER_PROJECTS',
]);

/** An admin group with this many people or more is a wide blast radius for one membership change. */
export const ADMIN_GROUP_LARGE = 10;

const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

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

function projectsForScheme(state: AccessState, schemeId: string) {
  return [...state.projects.entries()].filter(([, p]) => p.schemeId === schemeId);
}

function usedSchemeIds(state: AccessState): Set<string> {
  return new Set(
    [...state.projects.values()].map((p) => p.schemeId).filter((id): id is string => Boolean(id)),
  );
}

function referencedGroupIds(state: AccessState, entries: EffectiveAccess[]): Set<string> {
  const ids = new Set<string>();
  for (const e of entries)
    for (const step of e.path) if (step.kind === 'group') ids.add(step.groupId);
  for (const g of state.grants) {
    if (g.holderType === 'group') {
      const id = g.holderParam ?? state.groupByName.get(g.holderName ?? '');
      if (id) ids.add(id);
    }
  }
  for (const byRole of state.roleActors.values())
    for (const actors of byRole.values()) for (const gid of actors.groups) ids.add(gid);
  for (const groups of state.appRoleGroups.values()) for (const gid of groups) ids.add(gid);
  return ids;
}

function projectNoAdmin(
  state: AccessState,
  entries: EffectiveAccess[],
): { items: RiskItem[]; partial: boolean } {
  const items: RiskItem[] = [];
  let partial = false;
  for (const [projectId, project] of state.projects) {
    if (project.style === 'team') continue; // coverage / simplified model
    if (!project.schemeId) {
      partial = true;
      continue;
    }
    const adminEntries = entries.filter(
      (e) => e.projectId === projectId && e.permission === 'ADMINISTER_PROJECTS',
    );
    const humanAdmins = new Set<string>();
    let hasConditional = false;
    let projectPartial = false;
    for (const e of adminEntries) {
      if (e.partial) projectPartial = true;
      if (e.subject.type === 'user') {
        const id = e.subject.accountId;
        const person = state.persons.get(id);
        if (!person) {
          projectPartial = true;
          continue;
        }
        // Active humans via scheme/role/lead count. Global Jira admins are not injected here.
        if (person.active && person.accountType === 'atlassian') humanAdmins.add(id);
      } else if (e.subject.type === 'conditional') {
        hasConditional = true;
      } else {
        projectPartial = true;
      }
    }
    if (humanAdmins.size > 0) continue;
    const schemeName = state.schemes.get(project.schemeId)?.name ?? project.schemeId;
    const detail = projectPartial ? `${schemeName} (partial data)` : schemeName;
    if (projectPartial) partial = true;
    // No human admin: empty, conditional-only, or only unexpanded/partial holders.
    if (adminEntries.length === 0 || hasConditional || projectPartial) {
      items.push({ id: projectId, label: `${project.key}: no space admin`, detail });
    }
  }
  return { items, partial };
}

function directUserGrants(state: AccessState, keyPermissions: Set<string>): RiskItem[] {
  const used = usedSchemeIds(state);
  const items: RiskItem[] = [];
  for (const g of state.grants) {
    if (g.holderType !== 'user' || !g.holderParam) continue;
    if (!keyPermissions.has(g.permission)) continue;
    if (!used.has(g.schemeId)) continue;
    const n = projectsForScheme(state, g.schemeId).length;
    if (n < 1) continue;
    const schemeName = state.schemes.get(g.schemeId)?.name ?? g.schemeId;
    const who = state.persons.get(g.holderParam)?.displayName ?? g.holderParam;
    items.push({
      id: `${g.schemeId}:${g.grantId}`,
      label: `${schemeName}: ${g.permission} → ${who}`,
      detail: `${n} space${n === 1 ? '' : 's'}`,
    });
  }
  return items;
}

function unusedSchemesAndRoles(state: AccessState): RiskItem[] {
  const usedSchemes = usedSchemeIds(state);
  const items: RiskItem[] = [];
  for (const [id, scheme] of state.schemes) {
    if (!usedSchemes.has(id)) {
      items.push({ id: `scheme:${id}`, label: scheme.name, detail: 'No space assigned' });
    }
  }
  const rolesInUsedGrants = new Set<string>();
  for (const g of state.grants) {
    if (g.holderType === 'projectRole' && g.holderParam && usedSchemes.has(g.schemeId)) {
      rolesInUsedGrants.add(g.holderParam);
    }
  }
  const rolesWithActors = new Set<string>();
  for (const byRole of state.roleActors.values())
    for (const roleId of byRole.keys()) rolesWithActors.add(roleId);

  for (const [roleId, role] of state.roles) {
    if (role.projectId) continue; // team-managed / project-scoped
    if (rolesInUsedGrants.has(roleId)) continue;
    if (rolesWithActors.has(roleId)) continue;
    items.push({
      id: `role:${roleId}`,
      label: role.name,
      detail: 'Role unused in schemes and spaces',
    });
  }
  return items;
}

function emptyGroupsInUse(
  state: AccessState,
  entries: EffectiveAccess[],
): { items: RiskItem[]; partial: boolean } {
  const referenced = referencedGroupIds(state, entries);
  const usedSchemes = usedSchemeIds(state);
  const items: RiskItem[] = [];
  let partial = false;

  for (const [groupId, group] of state.groups) {
    if (!referenced.has(groupId)) continue;
    const status = group.members ?? 'not-collected';
    if (status === 'unreadable' || status === 'not-collected') {
      partial = true;
      continue;
    }
    if (!state.groupMembers.has(groupId)) {
      partial = true;
      continue;
    }
    const members = state.groupMembers.get(groupId) ?? [];
    const active = members.filter((id) => state.persons.get(id)?.active !== false);
    if (active.length > 0) continue;
    const projectCount = new Set(
      state.grants
        .filter((g) => {
          if (g.holderType !== 'group') return false;
          const id = g.holderParam ?? state.groupByName.get(g.holderName ?? '');
          return id === groupId && usedSchemes.has(g.schemeId);
        })
        .flatMap((g) => projectsForScheme(state, g.schemeId).map(([pid]) => pid)),
    ).size;
    items.push({
      id: groupId,
      label: group.name,
      detail: `grants ${projectCount} space${projectCount === 1 ? '' : 's'}`,
    });
  }
  return { items, partial };
}

function appAccountsAdmin(state: AccessState, entries: EffectiveAccess[]): RiskItem[] {
  const globals = adminAccounts(state);
  const adminProjects = new Map<string, Set<string>>();
  for (const e of entries) {
    if (e.permission !== 'ADMINISTER_PROJECTS' || e.subject.type !== 'user') continue;
    const id = e.subject.accountId;
    if (!adminProjects.has(id)) adminProjects.set(id, new Set());
    adminProjects.get(id)!.add(e.projectId);
  }
  const items: RiskItem[] = [];
  for (const [accountId, person] of state.persons) {
    if (person.accountType === 'atlassian') continue;
    const inAdmin = globals.get(accountId);
    const projects = adminProjects.get(accountId);
    if (!inAdmin && !projects?.size) continue;
    const detail = inAdmin
      ? inAdmin.map((g) => state.groups.get(g)?.name ?? g).join(', ')
      : `${projects!.size} space${projects!.size === 1 ? '' : 's'}`;
    items.push({ id: accountId, label: person.displayName, detail });
  }
  return items;
}

const isAdminAccess = (access: string[] | undefined) =>
  (access ?? []).some((a) => a === 'admin' || a === 'site-admin');

/** Deactivated accounts that are still members of an admin or site-admin group. */
function inactiveAdmins(state: AccessState): RiskItem[] {
  const items: RiskItem[] = [];
  for (const [accountId, groups] of adminAccounts(state)) {
    const person = state.persons.get(accountId);
    if (!person || person.active !== false) continue;
    items.push({
      id: accountId,
      label: person.displayName,
      detail: groups.map((g) => state.groups.get(g)?.name ?? g).join(', '),
    });
  }
  return items;
}

/** Admin groups: many members (collected only), or collected as empty. */
function adminGroupSize(state: AccessState): { large: RiskItem[]; empty: RiskItem[] } {
  const large: RiskItem[] = [];
  const empty: RiskItem[] = [];
  for (const [groupId, access] of state.groupAccess) {
    if (!isAdminAccess(access)) continue;
    const group = state.groups.get(groupId);
    if (!group || group.members !== 'collected') continue; // unread groups are not claimed either way
    const members = state.groupMembers.get(groupId) ?? [];
    const active = members.filter((id) => {
      const p = state.persons.get(id);
      return p ? p.active !== false && p.accountType === 'atlassian' : true;
    });
    const name = group.name;
    if (members.length === 0) empty.push({ id: groupId, label: name, detail: 'No members' });
    else if (active.length >= ADMIN_GROUP_LARGE)
      large.push({ id: groupId, label: name, detail: `${active.length} active members` });
  }
  large.sort((a, b) => Number(b.detail?.split(' ')[0]) - Number(a.detail?.split(' ')[0]));
  return { large, empty };
}

/** Anyone (no login) holding a permission that is not read only. */
function anonymousWrite(state: AccessState): RiskItem[] {
  return state.grants
    .filter((g) => g.holderType === 'anyone' && !READ_ONLY_PERMS.has(g.permission))
    .flatMap((g) =>
      projectsForScheme(state, g.schemeId).map(([pid, p]) => ({
        id: `${pid}:${g.permission}`,
        label: `${p.key}: ${g.permission}`,
        detail: state.schemes.get(g.schemeId)?.name,
      })),
    );
}

/** Destructive permissions granted to a large group (member count collected, in a scheme in use). */
function destructiveLargeGroups(state: AccessState, threshold: number): RiskItem[] {
  const used = usedSchemeIds(state);
  const items: RiskItem[] = [];
  for (const g of state.grants) {
    if (g.holderType !== 'group' || !DESTRUCTIVE_PERMS.has(g.permission)) continue;
    if (!used.has(g.schemeId)) continue;
    const groupId = g.holderParam ?? state.groupByName.get(g.holderName ?? '');
    const group = groupId ? state.groups.get(groupId) : undefined;
    if (!groupId || !group || group.members !== 'collected') continue;
    const n = (state.groupMembers.get(groupId) ?? []).length;
    if (n < threshold) continue;
    const spaces = projectsForScheme(state, g.schemeId).length;
    items.push({
      id: `${g.schemeId}:${g.grantId}`,
      label: `${state.schemes.get(g.schemeId)?.name ?? g.schemeId}: ${g.permission} → ${group.name}`,
      detail: `${n} members, ${spaces} space${spaces === 1 ? '' : 's'}`,
    });
  }
  return items;
}

/**
 * Company-managed spaces where exactly one active person holds Administer Projects. Skipped when any
 * holder could not be resolved (partial) or when the space has no admin at all (own rule).
 */
function projectSingleAdmin(state: AccessState, entries: EffectiveAccess[]): RiskItem[] {
  const adminsByProject = new Map<string, EffectiveAccess[]>();
  for (const e of entries) {
    if (e.permission !== 'ADMINISTER_PROJECTS') continue;
    const list = adminsByProject.get(e.projectId) ?? [];
    list.push(e);
    adminsByProject.set(e.projectId, list);
  }
  const items: RiskItem[] = [];
  for (const [projectId, project] of state.projects) {
    if (project.style === 'team' || !project.schemeId) continue;
    const list = adminsByProject.get(projectId) ?? [];
    if (!list.length) continue;
    if (list.some((e) => e.partial || e.subject.type !== 'user')) continue;
    const humans = new Set<string>();
    for (const e of list) {
      if (e.subject.type !== 'user') continue;
      const person = state.persons.get(e.subject.accountId);
      if (person?.active && person.accountType === 'atlassian') humans.add(e.subject.accountId);
    }
    if (humans.size !== 1) continue;
    const only = state.persons.get([...humans][0])?.displayName ?? [...humans][0];
    items.push({ id: projectId, label: `${project.key}: one space admin`, detail: only });
  }
  return items;
}

const sharedOf = (
  shared: SharedItem[],
  kind: SharedItem['kind'],
  exposure: SharedItem['exposure'],
) =>
  shared
    .filter((i) => i.kind === kind && i.exposure === exposure)
    .map((i) => ({
      id: `${kind}:${i.id}`,
      label: i.name || `#${i.id}`,
      detail: i.owner || undefined,
    }));

/**
 * `shared` is the live list of filters and dashboards (not part of a snapshot). Pass null when it could
 * not be read: the three sharing rules then report "partial" instead of "none found".
 */
export function computeRisks(
  state: AccessState,
  opts: RiskOptions,
  entries: EffectiveAccess[] = resolveAll(state),
  shared: SharedItem[] | null = null,
): Risk[] {
  const started = Date.now();
  const keep = (accountId: string) => opts.includeAppAccounts || !isAppAccount(state, accountId);
  const name = (accountId: string) => state.persons.get(accountId)?.displayName ?? accountId;
  const keyPermissions = new Set(
    opts.keyPermissions?.length ? opts.keyPermissions : DEFAULT_KEY_PERMISSIONS,
  );

  const anonymous = state.grants
    .filter((g) => g.holderType === 'anyone')
    .flatMap((g) =>
      projectsForScheme(state, g.schemeId).map(([pid, p]) => ({
        id: `${pid}:${g.permission}`,
        label: `${p.key}: ${g.permission}`,
        detail: state.schemes.get(g.schemeId)?.name,
      })),
    );

  const broad = state.grants
    .filter((g) => g.holderType === 'applicationRole' && BROAD_PERMS.has(g.permission))
    .flatMap((g) =>
      projectsForScheme(state, g.schemeId).map(([pid, p]) => ({
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
    .map(([id, set]) => ({ id, label: name(id), detail: `${set.size} spaces` }));

  const inactive = [...withAccess]
    .filter(([id]) => state.persons.get(id)?.active === false && keep(id))
    .map(([id, set]) => ({ id, label: name(id), detail: `${set.size} spaces` }));

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

  const noAdmin = projectNoAdmin(state, entries);
  const direct = directUserGrants(state, keyPermissions);
  const unused = unusedSchemesAndRoles(state);
  const empty = emptyGroupsInUse(state, entries);
  const appAdmin = appAccountsAdmin(state, entries);
  const anonWrite = anonymousWrite(state);
  const inactiveAdm = inactiveAdmins(state).filter((i) => keep(i.id));
  const adminGroups = adminGroupSize(state);
  const destructive = destructiveLargeGroups(state, opts.largeGroupThreshold);
  const single = projectSingleAdmin(state, entries);

  const risk = (
    id: RiskId,
    severity: Severity,
    title: string,
    description: string,
    items: RiskItem[],
    partial = false,
  ): Risk => ({
    id,
    severity,
    title,
    description,
    learnMore: RISK_LEARN_MORE[id] ?? description,
    count: items.length,
    items,
    partial,
  });

  const risks: Risk[] = [
    risk(
      'anonymous',
      'high',
      'Anonymous access',
      'Permissions granted to “Anyone”, including people who are not logged in.',
      anonymous,
    ),
    risk(
      'inactive',
      'high',
      'Inactive users with access',
      'Deactivated accounts that still hold space permissions.',
      inactive,
    ),
    risk(
      'app-accounts-admin',
      'high',
      'App accounts with admin access',
      'App or customer accounts in admin groups or with space administer rights.',
      appAdmin,
    ),
    risk(
      'anonymous-write',
      'high',
      'Anonymous access beyond viewing',
      'Permissions other than viewing granted to “Anyone”, so people who are not logged in could change or add content.',
      anonWrite,
    ),
    risk(
      'inactive-admin',
      'high',
      'Deactivated accounts in admin groups',
      'Deactivated accounts that are still members of a group with admin or site-admin access.',
      inactiveAdm,
    ),
    risk(
      'filters-public',
      'high',
      'Filters shared with anyone',
      'Saved filters shared publicly. Their results can be read without a Jira login where public access is allowed.',
      shared ? sharedOf(shared, 'filter', 'anyone') : [],
      shared === null,
    ),
    risk(
      'dashboards-public',
      'high',
      'Dashboards shared with anyone',
      'Dashboards shared publicly. Their gadgets can be read without a Jira login where public access is allowed.',
      shared ? sharedOf(shared, 'dashboard', 'anyone') : [],
      shared === null,
    ),
    risk(
      'destructive-large-group',
      'medium',
      'Destructive permissions for large groups',
      `Delete or administer permissions granted to a group with ${opts.largeGroupThreshold} or more members.`,
      destructive,
    ),
    risk(
      'admin-group-large',
      'medium',
      'Large admin groups',
      `Groups with admin or site-admin access and ${ADMIN_GROUP_LARGE} or more active members.`,
      adminGroups.large,
    ),
    risk(
      'admins',
      'medium',
      'Jira administrators',
      'Members of groups with admin or site-admin access (partial global view).',
      admins,
    ),
    risk(
      'wide-admin',
      'medium',
      'Wide space admin access',
      `People who can administer ${opts.wideAdminProjects} or more spaces.`,
      wide,
    ),
    risk(
      'broad-app-role',
      'medium',
      'Broad application-role grants',
      'Key permissions granted to everyone with access to a Jira application.',
      broad,
    ),
    risk(
      'project-no-admin',
      'medium',
      'Spaces without a space admin',
      'Company-managed spaces where no active human resolves Administer Projects (except via global Jira admin).',
      noAdmin.items,
      noAdmin.partial,
    ),
    risk(
      'empty-groups-in-use',
      'medium',
      'Empty groups that grant access',
      'Groups with no active members that are still referenced by schemes, roles, or app access.',
      empty.items,
      empty.partial,
    ),
    risk(
      'large-groups',
      'low',
      'Large groups in use',
      `Groups with ${opts.largeGroupThreshold} or more members that grant access.`,
      large,
    ),
    risk(
      'direct-user-grants',
      'low',
      'Direct user grants in schemes',
      'Key permissions granted to a named user in a permission scheme.',
      direct,
    ),
    risk(
      'project-single-admin',
      'low',
      'Spaces with a single space admin',
      'Company-managed spaces where exactly one active person can administer the space. Consider a second admin for cover.',
      single,
    ),
    risk(
      'empty-admin-groups',
      'low',
      'Empty admin groups',
      'Groups with admin or site-admin access and no members. Anyone added later gains admin rights.',
      adminGroups.empty,
    ),
    risk(
      'shared-loggedin',
      'low',
      'Filters and dashboards shared with all signed-in users',
      'Shared with every signed-in user, including people who only have limited access. Often intended; check the sensitive ones.',
      shared
        ? [...sharedOf(shared, 'filter', 'loggedin'), ...sharedOf(shared, 'dashboard', 'loggedin')]
        : [],
      shared === null,
    ),
    risk(
      'unused-schemes',
      'low',
      'Unused schemes and roles',
      'Permission schemes with no space, or global roles unused by schemes and actors.',
      unused,
    ),
  ];

  risks.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.count - a.count);
  console.log('[risk] computed', {
    ms: Date.now() - started,
    counts: Object.fromEntries(risks.map((r) => [r.id, r.count])),
  });
  return risks;
}
