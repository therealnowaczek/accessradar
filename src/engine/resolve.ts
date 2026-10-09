/**
 * Pure effective-access resolver (no I/O). Week-1 skeleton covering the holder types observed
 * on the dev site (projectRole, applicationRole, group, user, anyone, projectLead) plus
 * conditional holders that are never expanded to people.
 */
export const ENGINE_VERSION = '0.1.0';

export interface Holder {
  type: string;
  parameter?: string; // roleId, groupId/name, accountId, appKey, fieldId
}
export interface Grant {
  schemeId: string;
  grantId: string;
  permission: string;
  holder: Holder;
}
export interface ProjectFacts {
  projectId: string;
  schemeId: string;
  leadAccountId?: string;
  /** roleId -> actors */
  roleActors: Record<string, { users: string[]; groups: string[] }>;
}
export interface DirectoryFacts {
  /** groupId -> member accountIds (undefined = could not be read) */
  groupMembers: Record<string, string[] | undefined>;
  /** application role key -> groupIds; key '*' = "any application access" union */
  appRoleGroups: Record<string, string[]>;
}

export type PathStep =
  | { kind: 'scheme'; schemeId: string; grantId: string; permission: string }
  | { kind: 'role'; roleId: string }
  | { kind: 'group'; groupId: string }
  | { kind: 'appRole'; appKey: string }
  | { kind: 'direct' }
  | { kind: 'projectLead' };

export interface EffectiveAccess {
  projectId: string;
  permission: string;
  subject:
    | { type: 'user'; accountId: string }
    | { type: 'conditional'; holderType: string }
    | { type: 'anonymous' };
  path: PathStep[];
  /** true when part of the path could not be expanded (e.g. unreadable group membership). */
  partial?: boolean;
}

export const CONDITIONAL_HOLDERS = new Set([
  'reporter',
  'assignee',
  'userCustomField',
  'groupCustomField',
  'reporterWithCreatePermission',
  'assigneeWithAssignablePermission',
]);

function expandGroup(
  groupId: string,
  dir: DirectoryFacts,
  base: PathStep[],
  projectId: string,
  permission: string,
): EffectiveAccess[] {
  const members = dir.groupMembers[groupId];
  const path: PathStep[] = [...base, { kind: 'group', groupId }];
  if (!members)
    return [
      {
        projectId,
        permission,
        subject: { type: 'conditional', holderType: 'group-unreadable' },
        path,
        partial: true,
      },
    ];
  return members.map((accountId) => ({
    projectId,
    permission,
    subject: { type: 'user', accountId },
    path,
  }));
}

export function resolveProject(
  grants: Grant[],
  project: ProjectFacts,
  dir: DirectoryFacts,
): EffectiveAccess[] {
  const out: EffectiveAccess[] = [];
  for (const g of grants) {
    if (g.schemeId !== project.schemeId) continue;
    const base: PathStep[] = [
      { kind: 'scheme', schemeId: g.schemeId, grantId: g.grantId, permission: g.permission },
    ];
    const { projectId } = project;
    const { permission } = g;
    const h = g.holder;
    switch (h.type) {
      case 'projectRole': {
        const actors = project.roleActors[h.parameter ?? ''];
        if (!actors) break;
        const rolePath: PathStep[] = [...base, { kind: 'role', roleId: h.parameter! }];
        for (const accountId of actors.users)
          out.push({ projectId, permission, subject: { type: 'user', accountId }, path: rolePath });
        for (const groupId of actors.groups)
          out.push(...expandGroup(groupId, dir, rolePath, projectId, permission));
        break;
      }
      case 'group':
        if (h.parameter) out.push(...expandGroup(h.parameter, dir, base, projectId, permission));
        break;
      case 'user':
        if (h.parameter)
          out.push({
            projectId,
            permission,
            subject: { type: 'user', accountId: h.parameter },
            path: [...base, { kind: 'direct' }],
          });
        break;
      case 'projectLead':
        if (project.leadAccountId)
          out.push({
            projectId,
            permission,
            subject: { type: 'user', accountId: project.leadAccountId },
            path: [...base, { kind: 'projectLead' }],
          });
        break;
      case 'applicationRole': {
        // No parameter = "any logged-in user with access to any Jira application".
        const appKey = h.parameter ?? '*';
        const groups =
          appKey === '*'
            ? [...new Set(Object.values(dir.appRoleGroups).flat())]
            : (dir.appRoleGroups[appKey] ?? []);
        for (const groupId of groups)
          out.push(
            ...expandGroup(
              groupId,
              dir,
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
          subject: { type: 'conditional', holderType: h.type },
          path: base,
          partial: !CONDITIONAL_HOLDERS.has(h.type),
        });
    }
  }
  return out;
}
