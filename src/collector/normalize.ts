/** Runtime mapping of Jira REST payloads to facts. Malformed entries are dropped, never trusted. */
import {
  factKey,
  type Fact,
  type GrantAttrs,
  type PersonAttrs,
  type ProjectAttrs,
} from '../engine/facts';

const str = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');

export function projectFact(p: any): Fact<ProjectAttrs> | null {
  const id = str(p?.id);
  const key = str(p?.key);
  if (!id || !key) return null;
  const team = p.simplified === true || p.style === 'next-gen';
  const lead = str(p.lead?.accountId);
  return {
    kind: 'project',
    fkey: factKey.project(id),
    attrs: {
      key,
      name: str(p.name) || key,
      style: team ? 'team' : 'company',
      typeKey: str(p.projectTypeKey) || 'unknown',
      ...(lead ? { leadAccountId: lead } : {}),
    },
  };
}

export function personFact(u: any): Fact<PersonAttrs> | null {
  const id = str(u?.accountId);
  if (!id) return null;
  return {
    kind: 'person',
    fkey: factKey.person(id),
    attrs: {
      displayName: str(u.displayName) || 'Unknown user',
      accountType: str(u.accountType) || 'unknown',
      active: u.active !== false,
    },
  };
}

/** Permission grant holder -> normalized attrs (ids preferred over names). */
export function grantFact(schemeId: string, g: any): Fact<GrantAttrs> | null {
  const grantId = str(g?.id);
  const permission = str(g?.permission);
  const type = str(g?.holder?.type);
  if (!grantId || !permission || !type) return null;
  const h = g.holder ?? {};
  let param: string;
  let name: string | undefined;
  switch (type) {
    case 'group':
      param = str(h.value) || str(h.group?.groupId);
      name = str(h.group?.name) || str(h.parameter) || undefined;
      if (!param) param = str(h.parameter);
      break;
    case 'projectRole':
      param = str(h.value) || str(h.parameter) || str(h.projectRole?.id);
      break;
    case 'user':
      param = str(h.value) || str(h.parameter) || str(h.user?.accountId);
      break;
    default:
      param = str(h.parameter) || str(h.value);
  }
  return {
    kind: 'grant',
    fkey: factKey.grant(schemeId, grantId),
    attrs: {
      schemeId,
      grantId,
      permission,
      holderType: type,
      ...(param ? { holderParam: param } : {}),
      ...(name ? { holderName: name } : {}),
    },
  };
}

export interface RoleActorParsed {
  type: 'user' | 'group';
  id: string;
  displayName?: string;
}

export function roleActors(body: any): RoleActorParsed[] {
  const actors = Array.isArray(body?.actors) ? body.actors : [];
  const out: RoleActorParsed[] = [];
  for (const a of actors) {
    const user = str(a?.actorUser?.accountId);
    const group = str(a?.actorGroup?.groupId);
    if (user) out.push({ type: 'user', id: user, displayName: str(a.displayName) || undefined });
    else if (group) out.push({ type: 'group', id: group, displayName: str(a.actorGroup?.name) });
  }
  return out;
}

/** "Administrator" -> "10002" from GET project/{id}/role (values are role URLs). */
export function roleIdsFromMap(body: unknown): Map<string, string> {
  const out = new Map<string, string>();
  if (!body || typeof body !== 'object') return out;
  for (const [name, url] of Object.entries(body as Record<string, unknown>)) {
    const m = /\/role\/(\d+)\/?$/.exec(str(url));
    if (m) out.set(m[1], name);
  }
  return out;
}
