import type {
  AppRoleAttrs,
  AppRoleGroupAttrs,
  Fact,
  GrantAttrs,
  GroupAccessAttrs,
  GroupAttrs,
  GroupMemberAttrs,
  PersonAttrs,
  ProjectAttrs,
  RoleActorAttrs,
  RoleAttrs,
  SchemeAttrs,
} from './facts';

export type MembersStatus = 'collected' | 'not-collected' | 'unreadable';

export interface GroupInfo extends GroupAttrs {
  members?: MembersStatus;
}

/** In-memory view of one snapshot, built from its facts. */
export interface AccessState {
  projects: Map<string, ProjectAttrs>;
  schemes: Map<string, SchemeAttrs>;
  grants: GrantAttrs[];
  grantsByScheme: Map<string, GrantAttrs[]>;
  roles: Map<string, RoleAttrs>;
  /** projectId -> roleId -> actors */
  roleActors: Map<string, Map<string, { users: string[]; groups: string[] }>>;
  groups: Map<string, GroupInfo>;
  groupByName: Map<string, string>;
  /** groupId -> member accountIds; only for groups whose members were collected. */
  groupMembers: Map<string, string[]>;
  /** accountId -> groupIds */
  memberOf: Map<string, string[]>;
  appRoles: Map<string, AppRoleAttrs>;
  /** appKey -> groupIds */
  appRoleGroups: Map<string, string[]>;
  /** groupId -> access labels ("admin", "site-admin", "user:jira-software") */
  groupAccess: Map<string, string[]>;
  persons: Map<string, PersonAttrs>;
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) {
    if (!list.includes(value)) list.push(value);
  } else map.set(key, [value]);
}

export function buildState(facts: Iterable<Fact<any>>): AccessState {
  const s: AccessState = {
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
  };
  for (const f of facts) {
    switch (f.kind) {
      case 'project':
        s.projects.set(f.fkey, f.attrs as ProjectAttrs);
        break;
      case 'scheme':
        s.schemes.set(f.fkey, f.attrs as SchemeAttrs);
        break;
      case 'grant': {
        const g = f.attrs as GrantAttrs;
        s.grants.push(g);
        push(s.grantsByScheme, g.schemeId, g);
        break;
      }
      case 'role':
        s.roles.set(f.fkey, f.attrs as RoleAttrs);
        break;
      case 'role_actor': {
        const a = f.attrs as RoleActorAttrs;
        let byRole = s.roleActors.get(a.projectId);
        if (!byRole) s.roleActors.set(a.projectId, (byRole = new Map()));
        let actors = byRole.get(a.roleId);
        if (!actors) byRole.set(a.roleId, (actors = { users: [], groups: [] }));
        const list = a.actorType === 'group' ? actors.groups : actors.users;
        if (!list.includes(a.actorId)) list.push(a.actorId);
        break;
      }
      case 'group': {
        const g = f.attrs as GroupInfo;
        s.groups.set(f.fkey, g);
        s.groupByName.set(g.name, f.fkey);
        break;
      }
      case 'group_access': {
        const a = f.attrs as GroupAccessAttrs;
        push(s.groupAccess, a.groupId, a.appKey ? `${a.accessType}:${a.appKey}` : a.accessType);
        break;
      }
      case 'group_member': {
        const m = f.attrs as GroupMemberAttrs;
        push(s.groupMembers, m.groupId, m.accountId);
        push(s.memberOf, m.accountId, m.groupId);
        break;
      }
      case 'app_role':
        s.appRoles.set(f.fkey, f.attrs as AppRoleAttrs);
        break;
      case 'app_role_group': {
        const a = f.attrs as AppRoleGroupAttrs;
        push(s.appRoleGroups, a.appKey, a.groupId);
        break;
      }
      case 'person':
        s.persons.set(f.fkey, f.attrs as PersonAttrs);
        break;
    }
  }
  // Groups whose members were collected but turned out empty still count as "read".
  for (const [id, g] of s.groups) {
    if (g.members === 'collected' && !s.groupMembers.has(id)) s.groupMembers.set(id, []);
  }
  return s;
}

/** Members of a group, or undefined when they were not collected / unreadable. */
export function membersOf(state: AccessState, groupId: string): string[] | undefined {
  return state.groupMembers.get(groupId);
}

export function groupIdFor(state: AccessState, idOrName: string | undefined): string | undefined {
  if (!idOrName) return undefined;
  if (state.groups.has(idOrName)) return idOrName;
  return state.groupByName.get(idOrName) ?? idOrName;
}
