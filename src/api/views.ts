/** View models for the admin UI and exports, computed from one snapshot's state (pure). */
import type { FactChange } from '../engine/diff';
import {
  aggregate,
  describePath,
  pathCode,
  resolveAll,
  resolveProject,
  subjectKey,
  viaLabel,
  type EffectiveAccess,
  type PathStep,
  type Subject,
} from '../engine/resolve';
import { adminAccounts, isAppAccount } from '../engine/risk';
import type { AccessState } from '../engine/state';

export interface SubjectView {
  key: string;
  type: Subject['type'];
  id: string;
  name: string;
  accountType?: string;
  active?: boolean;
}

export interface Reason {
  text: string;
  code: string;
  via: { kind: string; label: string };
}

const CONDITIONAL_LABELS: Record<string, string> = {
  reporter: 'Reporter',
  assignee: 'Assignee',
  userCustomField: 'User custom field',
  groupCustomField: 'Group custom field',
  reporterWithCreatePermission: 'Reporter (with create permission)',
  assigneeWithAssignablePermission: 'Assignee (assignable)',
  'sd.customer.portal.only': 'Service customers (portal only)',
};

export function subjectView(state: AccessState, s: Subject): SubjectView {
  switch (s.type) {
    case 'user': {
      const p = state.persons.get(s.accountId);
      return {
        key: subjectKey(s),
        type: 'user',
        id: s.accountId,
        name: p?.displayName ?? 'Unknown user',
        accountType: p?.accountType ?? 'unknown',
        active: p?.active ?? true,
      };
    }
    case 'group':
      return {
        key: subjectKey(s),
        type: 'group',
        id: s.groupId,
        name: state.groups.get(s.groupId)?.name ?? s.groupId,
      };
    case 'conditional':
      return {
        key: subjectKey(s),
        type: 'conditional',
        id: s.holderType,
        name: CONDITIONAL_LABELS[s.holderType] ?? s.holderType,
      };
    default:
      return { key: 'anonymous', type: 'anonymous', id: 'anyone', name: 'Anyone (anonymous)' };
  }
}

export function reason(state: AccessState, path: PathStep[]): Reason {
  return { text: describePath(state, path), code: pathCode(path), via: viaLabel(state, path) };
}

export function projectView(state: AccessState, id: string) {
  const p = state.projects.get(id);
  return {
    id,
    key: p?.key ?? id,
    name: p?.name ?? id,
    style: p?.style ?? 'company',
    schemeId: p?.schemeId ?? null,
    schemeName: p?.schemeId ? (state.schemes.get(p.schemeId)?.name ?? p.schemeId) : null,
  };
}

// ---------- Explore: projects ----------
export function projectsList(state: AccessState, entries: EffectiveAccess[] = resolveAll(state)) {
  const byProject = new Map<string, EffectiveAccess[]>();
  for (const e of entries) {
    const list = byProject.get(e.projectId) ?? [];
    list.push(e);
    byProject.set(e.projectId, list);
  }
  return [...state.projects.keys()].map((id) => {
    const rows = aggregate(byProject.get(id) ?? []);
    const users = rows.filter((r) => r.subject.type === 'user');
    return {
      ...projectView(state, id),
      lead: state.projects.get(id)?.leadAccountId
        ? (state.persons.get(state.projects.get(id)!.leadAccountId!)?.displayName ?? null)
        : null,
      people: users.filter(
        (r) => !isAppAccount(state, (r.subject as { accountId: string }).accountId),
      ).length,
      appAccounts: users.filter((r) =>
        isAppAccount(state, (r.subject as { accountId: string }).accountId),
      ).length,
      browse: users.filter((r) => r.perms.has('BROWSE_PROJECTS')).length,
      admins: users.filter((r) => r.perms.has('ADMINISTER_PROJECTS')).length,
      anonymous: rows.some((r) => r.subject.type === 'anonymous'),
      unexpanded: rows.filter((r) => r.subject.type === 'group').length,
      conditional: rows.filter((r) => r.subject.type === 'conditional').length,
    };
  });
}

export function projectAccess(state: AccessState, projectId: string) {
  const rows = aggregate(resolveProject(state, projectId));
  const permissions = new Set<string>();
  const out = rows.map((r) => {
    const perms: Record<string, Reason[]> = {};
    for (const [perm, paths] of r.perms) {
      permissions.add(perm);
      perms[perm] = paths.map((p) => reason(state, p));
    }
    return { subject: subjectView(state, r.subject), perms, partial: r.partial };
  });
  return {
    project: projectView(state, projectId),
    rows: out,
    permissions: [...permissions].sort(),
  };
}

// ---------- Explore: groups ----------
export function groupReach(state: AccessState, entries: EffectiveAccess[]) {
  const reach = new Map<string, Map<string, Map<string, Set<string>>>>();
  for (const e of entries)
    for (const s of e.path)
      if (s.kind === 'group') {
        let projects = reach.get(s.groupId);
        if (!projects) reach.set(s.groupId, (projects = new Map()));
        let perms = projects.get(e.projectId);
        if (!perms) projects.set(e.projectId, (perms = new Map()));
        let reasons = perms.get(e.permission);
        if (!reasons) perms.set(e.permission, (reasons = new Set()));
        reasons.add(describePath(state, e.path));
      }
  return reach;
}

export function groupsList(state: AccessState, entries: EffectiveAccess[] = resolveAll(state)) {
  const reach = groupReach(state, entries);
  const appByGroup = new Map<string, string[]>();
  for (const [app, groups] of state.appRoleGroups)
    for (const g of groups)
      appByGroup.set(g, [...(appByGroup.get(g) ?? []), state.appRoles.get(app)?.name ?? app]);
  return [...state.groups].map(([id, g]) => {
    const members = state.groupMembers.get(id);
    const projects = reach.get(id);
    let grants = 0;
    for (const perms of projects?.values() ?? []) grants += perms.size;
    return {
      id,
      name: g.name,
      membersStatus: g.members ?? 'not-collected',
      members: members ? members.length : null,
      inactiveMembers: members
        ? members.filter((m) => state.persons.get(m)?.active === false).length
        : null,
      access: state.groupAccess.get(id) ?? [],
      applications: appByGroup.get(id) ?? [],
      projects: projects?.size ?? 0,
      grants,
    };
  });
}

export function groupDetail(
  state: AccessState,
  groupId: string,
  entries: EffectiveAccess[] = resolveAll(state),
) {
  const g = state.groups.get(groupId);
  if (!g) return null;
  const projects = groupReach(state, entries).get(groupId) ?? new Map();
  const members = (state.groupMembers.get(groupId) ?? []).map((id) =>
    subjectView(state, { type: 'user', accountId: id }),
  );
  const roles: Array<{ projectId: string; roleId: string; roleName: string }> = [];
  for (const [projectId, byRole] of state.roleActors)
    for (const [roleId, actors] of byRole)
      if (actors.groups.includes(groupId))
        roles.push({ projectId, roleId, roleName: state.roles.get(roleId)?.name ?? roleId });
  return {
    id: groupId,
    name: g.name,
    membersStatus: g.members ?? 'not-collected',
    members,
    access: state.groupAccess.get(groupId) ?? [],
    applications: [...state.appRoleGroups]
      .filter(([, groups]) => groups.includes(groupId))
      .map(([app]) => state.appRoles.get(app)?.name ?? app),
    schemeGrants: state.grants
      .filter(
        (gr) =>
          gr.holderType === 'group' && (gr.holderParam === groupId || gr.holderName === g.name),
      )
      .map((gr) => ({
        scheme: state.schemes.get(gr.schemeId)?.name ?? gr.schemeId,
        permission: gr.permission,
      })),
    roles: roles.map((r) => ({ ...r, project: projectView(state, r.projectId) })),
    usage: [...projects].map(([projectId, perms]) => ({
      project: projectView(state, projectId),
      permissions: [...perms].map(([permission, reasons]) => ({
        permission,
        reasons: [...reasons],
      })),
    })),
  };
}

// ---------- Explore: people ----------
export function peopleList(state: AccessState, entries: EffectiveAccess[] = resolveAll(state)) {
  const projects = new Map<string, Set<string>>();
  const adminProjects = new Map<string, Set<string>>();
  for (const e of entries) {
    if (e.subject.type !== 'user') continue;
    const id = e.subject.accountId;
    if (!projects.has(id)) projects.set(id, new Set());
    projects.get(id)!.add(e.projectId);
    if (e.permission === 'ADMINISTER_PROJECTS') {
      if (!adminProjects.has(id)) adminProjects.set(id, new Set());
      adminProjects.get(id)!.add(e.projectId);
    }
  }
  const admins = adminAccounts(state);
  const ids = new Set([...state.persons.keys(), ...projects.keys()]);
  return [...ids].map((id) => {
    const p = state.persons.get(id);
    return {
      accountId: id,
      name: p?.displayName ?? 'Unknown user',
      accountType: p?.accountType ?? 'unknown',
      active: p?.active ?? true,
      projects: projects.get(id)?.size ?? 0,
      adminProjects: adminProjects.get(id)?.size ?? 0,
      groups: state.memberOf.get(id)?.length ?? 0,
      jiraAdmin: admins.has(id),
    };
  });
}

export function personAccess(
  state: AccessState,
  accountId: string,
  entries: EffectiveAccess[] = resolveAll(state),
) {
  const mine = entries.filter(
    (e) => e.subject.type === 'user' && e.subject.accountId === accountId,
  );
  const rows = aggregate(mine).map((r) => {
    const perms: Record<string, Reason[]> = {};
    for (const [perm, paths] of r.perms) perms[perm] = paths.map((p) => reason(state, p));
    return { project: projectView(state, r.projectId), perms };
  });
  const admins = adminAccounts(state).get(accountId) ?? [];
  return {
    person: subjectView(state, { type: 'user', accountId }),
    groups: (state.memberOf.get(accountId) ?? []).map((id) => ({
      id,
      name: state.groups.get(id)?.name ?? id,
      access: state.groupAccess.get(id) ?? [],
    })),
    adminVia: admins.map((id) => state.groups.get(id)?.name ?? id),
    projects: rows,
  };
}

// ---------- Changes ----------
export type ChangeCategory = 'projects' | 'groups' | 'schemes' | 'people';

export interface FactChangeView {
  category: ChangeCategory;
  change: FactChange['change'];
  kind: string;
  label: string;
  detail: string;
  projectIds: string[];
  groupId: string | null;
  permission: string | null;
}

const CATEGORY: Record<string, ChangeCategory> = {
  project: 'projects',
  group: 'groups',
  group_member: 'groups',
  group_access: 'groups',
  app_role_group: 'groups',
  app_role: 'groups',
  scheme: 'schemes',
  grant: 'schemes',
  role: 'schemes',
  role_actor: 'schemes',
  person: 'people',
};

/** Labels use the newer state, falling back to the older one for removed objects. */
export function describeFactChange(b: AccessState, a: AccessState, c: FactChange): FactChangeView {
  const attrs = (c.after ?? c.before ?? {}) as Record<string, any>;
  const either = <T>(fn: (s: AccessState) => T | undefined) => fn(b) ?? fn(a);
  const groupName = (id: string) => either((s) => s.groups.get(id)?.name) ?? id;
  const personName = (id: string) =>
    either((s) => s.persons.get(id)?.displayName) ?? 'Unknown user';
  const projectKey = (id: string) => either((s) => s.projects.get(id)?.key) ?? id;
  const schemeName = (id: string) => either((s) => s.schemes.get(id)?.name) ?? id;
  const roleName = (id: string) => either((s) => s.roles.get(id)?.name) ?? id;
  const projectsOfScheme = (id: string) => [
    ...new Set(
      [...b.projects, ...a.projects].filter(([, p]) => p.schemeId === id).map(([pid]) => pid),
    ),
  ];
  const base = {
    category: CATEGORY[c.kind] ?? 'schemes',
    change: c.change,
    kind: c.kind,
    projectIds: [] as string[],
    groupId: null as string | null,
    permission: null as string | null,
  };
  switch (c.kind) {
    case 'project': {
      const moved = c.change === 'changed' && c.before?.schemeId !== c.after?.schemeId;
      return {
        ...base,
        label: `${attrs.key} ${attrs.name}`,
        detail: moved
          ? `Permission scheme ${schemeName(String(c.before?.schemeId))} → ${schemeName(String(c.after?.schemeId))}`
          : c.change === 'changed'
            ? 'Project details changed'
            : `Project ${c.change}`,
        projectIds: [c.fkey],
      };
    }
    case 'group':
      return { ...base, label: attrs.name, detail: `Group ${c.change}`, groupId: c.fkey };
    case 'group_member':
      return {
        ...base,
        label: `${personName(attrs.accountId)} in ${groupName(attrs.groupId)}`,
        detail: c.change === 'added' ? 'Added to group' : 'Removed from group',
        groupId: attrs.groupId,
      };
    case 'group_access':
      return {
        ...base,
        label: groupName(attrs.groupId),
        detail: `${attrs.accessType}${attrs.appKey ? ` (${attrs.appKey})` : ''} access ${c.change === 'added' ? 'granted' : 'removed'}`,
        groupId: attrs.groupId,
      };
    case 'app_role_group':
      return {
        ...base,
        label: groupName(attrs.groupId),
        detail: `Application access ${attrs.appKey} ${c.change === 'added' ? 'granted' : 'removed'}`,
        groupId: attrs.groupId,
      };
    case 'app_role':
      return { ...base, label: attrs.name, detail: `Application ${c.change}` };
    case 'scheme':
      return {
        ...base,
        label: attrs.name,
        detail: `Permission scheme ${c.change}`,
        projectIds: projectsOfScheme(c.fkey),
      };
    case 'grant': {
      const holder =
        attrs.holderType === 'group'
          ? `group ${groupName(attrs.holderParam ?? attrs.holderName)}`
          : attrs.holderType === 'projectRole'
            ? `role ${roleName(attrs.holderParam)}`
            : attrs.holderType === 'user'
              ? `user ${personName(attrs.holderParam)}`
              : attrs.holderType === 'applicationRole'
                ? attrs.holderParam
                  ? `application ${attrs.holderParam}`
                  : 'any application access'
                : attrs.holderType;
      return {
        ...base,
        label: `${attrs.permission} → ${holder}`,
        detail: `Grant ${c.change} in ${schemeName(attrs.schemeId)}`,
        projectIds: projectsOfScheme(attrs.schemeId),
        permission: attrs.permission,
        groupId: attrs.holderType === 'group' ? (attrs.holderParam ?? null) : null,
      };
    }
    case 'role':
      return { ...base, label: attrs.name, detail: `Role ${c.change}` };
    case 'role_actor':
      return {
        ...base,
        label: `${attrs.actorType === 'group' ? `group ${groupName(attrs.actorId)}` : personName(attrs.actorId)} as ${roleName(attrs.roleId)}`,
        detail: `${c.change === 'added' ? 'Added to' : 'Removed from'} role in ${projectKey(attrs.projectId)}`,
        projectIds: [attrs.projectId],
        groupId: attrs.actorType === 'group' ? attrs.actorId : null,
      };
    case 'person': {
      const before = c.before as Record<string, any> | undefined;
      const detail =
        c.change === 'changed' && before?.active !== attrs.active
          ? attrs.active
            ? 'Account reactivated'
            : 'Account deactivated'
          : c.change === 'changed'
            ? 'Account details changed'
            : `Account ${c.change}`;
      return { ...base, label: attrs.displayName ?? personName(c.fkey), detail };
    }
    default:
      return { ...base, label: c.fkey, detail: c.change };
  }
}
