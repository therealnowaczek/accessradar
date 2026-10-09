/**
 * Fact model shared by the collector, the SQL store and the engine.
 *
 * Every piece of access configuration is a fact: (kind, fkey) identifies it, `attrs` holds its
 * details and `vhash` fingerprints the attrs. Facts are stored once with a validity interval
 * (first_seen..last_seen snapshot seq, SCD2) so storage grows with changes, not with snapshots.
 */
import { createHash } from 'node:crypto';

export type FactKind =
  | 'project'
  | 'scheme'
  | 'grant'
  | 'role'
  | 'role_actor'
  | 'group'
  | 'group_access'
  | 'group_member'
  | 'app_role'
  | 'app_role_group'
  | 'person';

export const FACT_KINDS: readonly FactKind[] = [
  'project',
  'scheme',
  'grant',
  'role',
  'role_actor',
  'group',
  'group_access',
  'group_member',
  'app_role',
  'app_role_group',
  'person',
];

export interface ProjectAttrs {
  key: string;
  name: string;
  style: 'company' | 'team';
  typeKey: string;
  schemeId?: string;
  leadAccountId?: string;
}
export interface SchemeAttrs {
  name: string;
  teamManaged: boolean;
}
export interface GrantAttrs {
  schemeId: string;
  grantId: string;
  permission: string;
  holderType: string;
  /** groupId, roleId, accountId, application key or custom field id. */
  holderParam?: string;
  /** Group name when the holder references a group by name only. */
  holderName?: string;
}
export interface RoleAttrs {
  name: string;
  /** Set for team-managed (project-scoped) roles. */
  projectId?: string;
}
export interface RoleActorAttrs {
  projectId: string;
  roleId: string;
  actorType: 'user' | 'group';
  actorId: string;
}
export interface GroupAttrs {
  name: string;
}
export interface GroupAccessAttrs {
  groupId: string;
  /** admin | site-admin | user */
  accessType: string;
  appKey?: string;
}
export interface GroupMemberAttrs {
  groupId: string;
  accountId: string;
}
export interface AppRoleAttrs {
  name: string;
}
export interface AppRoleGroupAttrs {
  appKey: string;
  groupId: string;
  isDefault?: boolean;
}
export interface PersonAttrs {
  displayName: string;
  accountType: string;
  active: boolean;
}

export interface Fact<A = Record<string, unknown>> {
  kind: FactKind;
  fkey: string;
  attrs: A;
}
export interface StoredFact<A = Record<string, unknown>> extends Fact<A> {
  vhash: string;
}

/** JSON with sorted object keys, so equal values always serialise identically. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
    .join(',')}}`;
}

export function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** 16-hex fingerprint of the attrs. Person display names are excluded so that
 *  privacy anonymisation never looks like an access change. */
export function factVersionHash(kind: FactKind, attrs: unknown): string {
  const relevant =
    kind === 'person' && attrs && typeof attrs === 'object'
      ? { ...(attrs as Record<string, unknown>), displayName: undefined }
      : attrs;
  return sha256(`${kind}\n${canonicalJson(relevant)}`).slice(0, 16);
}

export function stored<A>(fact: Fact<A>): StoredFact<A> {
  return { ...fact, vhash: factVersionHash(fact.kind, fact.attrs) };
}

/** Content hash of a snapshot: SHA-256 over sorted kind/key/version lines. */
export function contentHash(facts: Array<Pick<StoredFact, 'kind' | 'fkey' | 'vhash'>>): string {
  const lines = facts.map((f) => `${f.kind}\t${f.fkey}\t${f.vhash}`).sort();
  return sha256(lines.join('\n'));
}

export const factKey = {
  project: (projectId: string) => projectId,
  scheme: (schemeId: string) => schemeId,
  grant: (schemeId: string, grantId: string) => `${schemeId}:${grantId}`,
  role: (roleId: string) => roleId,
  roleActor: (projectId: string, roleId: string, type: string, id: string) =>
    `${projectId}:${roleId}:${type}:${id}`,
  group: (groupId: string) => groupId,
  groupAccess: (accessType: string, appKey: string | undefined, groupId: string) =>
    `${accessType}:${appKey ?? ''}:${groupId}`,
  groupMember: (groupId: string, accountId: string) => `${groupId}:${accountId}`,
  appRole: (appKey: string) => appKey,
  appRoleGroup: (appKey: string, groupId: string) => `${appKey}:${groupId}`,
  person: (accountId: string) => accountId,
};
