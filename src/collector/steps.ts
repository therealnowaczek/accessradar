import { factKey, type Fact, type GrantAttrs, type ProjectAttrs } from '../engine/facts';
import { CONDITIONAL_HOLDERS } from '../engine/resolve';
import type { Settings } from '../db/settings';
import {
  computeContentHash,
  mergeStage,
  previousCommitted,
  readStage,
  stage,
  clearStage,
  type CoverageEntry,
  type StageFact,
} from '../db/snapshots';
import { CollectorClient, route } from './client';
import { grantFact, personFact, projectFact, roleActors, roleIdsFromMap } from './normalize';

export type StepName = 'PLAN' | 'PROJECTS' | 'DIRECTORY' | 'GROUPS' | 'FINALIZE';

export const PROJECT_BATCH = 10;
export const GROUP_BATCH = 10;

export interface StepContext {
  seq: number;
  batch: number;
  settings: Settings;
  client: CollectorClient;
}

export interface StepResult {
  next: { step: StepName; batch: number } | null;
  progress: {
    step: string;
    batch: number;
    batches?: number;
    message: string;
    counts?: Record<string, number>;
  };
}

const cov = (c: CoverageEntry): StageFact => ({
  kind: 'coverage',
  fkey: `${c.area}:${c.target}`,
  attrs: c,
});

// ---------- PLAN: projects + permission schemes with grants ----------
export async function plan(ctx: StepContext): Promise<StepResult> {
  const { client, seq } = ctx;
  const out: StageFact[] = [];
  const projects = await client.pages<any>(
    (startAt) =>
      route`/rest/api/3/project/search?startAt=${startAt}&maxResults=50&expand=lead&orderBy=key`,
    'projects',
  );
  if (!projects.ok)
    throw new Error(`Project list unreadable (${projects.status}): ${projects.error}`);
  for (const p of projects.items) {
    const f = projectFact(p);
    if (f) out.push(f);
    const lead = personFact(p?.lead);
    if (lead) out.push(lead);
  }
  if (!projects.complete)
    out.push(
      cov({ area: 'projects', target: 'all', status: 'partial', reason: 'Page limit reached' }),
    );

  const schemes = await client.get<{ permissionSchemes?: any[] }>(
    route`/rest/api/3/permissionscheme?expand=all`,
    'schemes',
  );
  let grants = 0;
  if (schemes.ok) {
    for (const s of schemes.body?.permissionSchemes ?? []) {
      const id = String(s?.id ?? '');
      if (!id) continue;
      out.push({
        kind: 'scheme',
        fkey: factKey.scheme(id),
        attrs: { name: String(s.name ?? id), teamManaged: Boolean(s.scope?.type === 'PROJECT') },
      });
      for (const g of s.permissions ?? []) {
        const f = grantFact(id, g);
        if (f) {
          out.push(f);
          grants += 1;
        }
      }
    }
  } else
    out.push(
      cov({
        area: 'schemes',
        target: 'all',
        status: 'unreadable',
        reason: `HTTP ${schemes.status}`,
      }),
    );
  await stage(seq, out);
  const count = projects.items.length;
  return {
    next: { step: 'PROJECTS', batch: 0 },
    progress: {
      step: 'PLAN',
      batch: 0,
      message: `Found ${count} projects and ${grants} scheme grants`,
      counts: { projects: count, grants },
    },
  };
}

// ---------- PROJECTS: scheme per project, role actors for roles used in grants ----------
export async function projectsStep(ctx: StepContext): Promise<StepResult> {
  const { client, seq, batch } = ctx;
  const projects = await readStage<ProjectAttrs>(seq, 'project');
  const total = Math.max(1, Math.ceil(projects.length / PROJECT_BATCH));
  const slice = projects.slice(batch * PROJECT_BATCH, (batch + 1) * PROJECT_BATCH);
  const grants = await readStage<GrantAttrs>(seq, 'grant');
  const knownSchemes = new Set((await readStage(seq, 'scheme')).map((s) => s.fkey));
  const out: StageFact[] = [];
  for (const p of slice) {
    const pid = p.fkey;
    const scheme = await client.get<{ id?: number | string; name?: string }>(
      route`/rest/api/3/project/${pid}/permissionscheme`,
      'project-scheme',
    );
    if (!scheme.ok || scheme.body?.id === undefined) {
      out.push(
        cov({
          area: 'project-scheme',
          target: p.attrs.key,
          status: 'unreadable',
          reason: `HTTP ${scheme.status}`,
        }),
      );
      continue;
    }
    const schemeId = String(scheme.body.id);
    out.push({ kind: 'project', fkey: pid, attrs: { ...p.attrs, schemeId } });
    let schemeGrants = grants.filter((g) => g.attrs.schemeId === schemeId).map((g) => g.attrs);
    if (!knownSchemes.has(schemeId)) {
      // Not in the scheme list (e.g. listed lazily): read its grants directly.
      const perms = await client.get<{ permissions?: any[] }>(
        route`/rest/api/3/permissionscheme/${schemeId}/permission`,
        'schemes',
      );
      out.push({
        kind: 'scheme',
        fkey: schemeId,
        attrs: {
          name: String(scheme.body.name ?? schemeId),
          teamManaged: p.attrs.style === 'team',
        },
      });
      knownSchemes.add(schemeId);
      if (perms.ok) {
        const fs = (perms.body?.permissions ?? [])
          .map((g) => grantFact(schemeId, g))
          .filter((f): f is Fact<GrantAttrs> => f !== null);
        out.push(...fs);
        schemeGrants = fs.map((f) => f.attrs);
      } else
        out.push(
          cov({
            area: 'schemes',
            target: schemeId,
            status: 'unreadable',
            reason: `HTTP ${perms.status}`,
          }),
        );
    }
    const usedRoles = [
      ...new Set(
        schemeGrants
          .filter((g) => g.holderType === 'projectRole' && g.holderParam)
          .map((g) => g.holderParam!),
      ),
    ];
    if (!usedRoles.length) continue;
    const roles = await client.get<Record<string, string>>(
      route`/rest/api/3/project/${pid}/role`,
      'roles',
    );
    const names = roles.ok ? roleIdsFromMap(roles.body) : new Map<string, string>();
    for (const roleId of usedRoles) {
      if (roles.ok && !names.has(roleId)) continue; // role not defined in this project
      const r = await client.get<any>(
        route`/rest/api/3/project/${pid}/role/${roleId}`,
        'role-actors',
      );
      if (!r.ok) {
        out.push(
          cov({
            area: 'role-actors',
            target: `${p.attrs.key}/${names.get(roleId) ?? roleId}`,
            status: 'unreadable',
            reason: `HTTP ${r.status}`,
          }),
          { kind: 'carry', fkey: `role_actor:${pid}:${roleId}:`, attrs: {} },
        );
        continue;
      }
      const scoped = r.body?.scope?.type === 'PROJECT';
      out.push({
        kind: 'role',
        fkey: factKey.role(roleId),
        attrs: {
          name: String(r.body?.name ?? names.get(roleId) ?? roleId),
          ...(scoped ? { projectId: pid } : {}),
        },
      });
      for (const a of roleActors(r.body))
        out.push({
          kind: 'role_actor',
          fkey: factKey.roleActor(pid, roleId, a.type, a.id),
          attrs: { projectId: pid, roleId, actorType: a.type, actorId: a.id },
        });
    }
  }
  await stage(seq, out);
  const done = Math.min(projects.length, (batch + 1) * PROJECT_BATCH);
  return {
    next:
      batch + 1 < total ? { step: 'PROJECTS', batch: batch + 1 } : { step: 'DIRECTORY', batch: 0 },
    progress: {
      step: 'PROJECTS',
      batch,
      batches: total,
      message: `Read roles and schemes for ${done} of ${projects.length} projects`,
      counts: { projectsDone: done, projects: projects.length },
    },
  };
}

// ---------- DIRECTORY: groups, admin access, application roles, users ----------
export async function directory(ctx: StepContext): Promise<StepResult> {
  const { client, seq } = ctx;
  const out: StageFact[] = [];
  const groups = await client.pages<any>(
    (startAt) => route`/rest/api/3/group/bulk?startAt=${startAt}&maxResults=50`,
    'groups',
  );
  if (!groups.ok)
    out.push(
      cov({ area: 'groups', target: 'all', status: 'unreadable', reason: `HTTP ${groups.status}` }),
    );
  for (const g of groups.items) {
    const id = String(g?.groupId ?? '');
    if (id)
      out.push({
        kind: 'group',
        fkey: id,
        attrs: { name: String(g.name ?? id), members: 'not-collected' },
      });
  }
  // Partial global permissions: groups with admin / site-admin access.
  for (const accessType of ['admin', 'site-admin']) {
    const r = await client.pages<any>(
      (startAt) =>
        route`/rest/api/3/group/bulk?accessType=${accessType}&startAt=${startAt}&maxResults=50`,
      'global-access',
    );
    if (!r.ok) {
      out.push(
        cov({
          area: 'global-access',
          target: accessType,
          status: 'unreadable',
          reason: `HTTP ${r.status}`,
        }),
      );
      continue;
    }
    for (const g of r.items) {
      const id = String(g?.groupId ?? '');
      if (id)
        out.push({
          kind: 'group_access',
          fkey: factKey.groupAccess(accessType, undefined, id),
          attrs: { groupId: id, accessType },
        });
    }
  }
  const apps = await client.get<any[]>(route`/rest/api/3/applicationrole`, 'application-roles');
  const appKeys: string[] = [];
  if (apps.ok) {
    for (const a of apps.body ?? []) {
      const key = String(a?.key ?? '');
      if (!key) continue;
      appKeys.push(key);
      out.push({ kind: 'app_role', fkey: key, attrs: { name: String(a.name ?? key) } });
      for (const g of a.groupDetails ?? []) {
        const gid = String(g?.groupId ?? '');
        if (gid)
          out.push({
            kind: 'app_role_group',
            fkey: factKey.appRoleGroup(key, gid),
            attrs: { appKey: key, groupId: gid },
          });
      }
    }
  } else
    out.push(
      cov({
        area: 'application-roles',
        target: 'all',
        status: 'unreadable',
        reason: `HTTP ${apps.status}`,
      }),
    );
  // "user" access needs an application key (400 without it, see week-1 findings).
  for (const appKey of appKeys) {
    const r = await client.pages<any>(
      (startAt) =>
        route`/rest/api/3/group/bulk?accessType=user&applicationKey=${appKey}&startAt=${startAt}&maxResults=50`,
      'global-access',
    );
    if (!r.ok) continue;
    for (const g of r.items) {
      const id = String(g?.groupId ?? '');
      if (id)
        out.push({
          kind: 'group_access',
          fkey: factKey.groupAccess('user', appKey, id),
          attrs: { groupId: id, accessType: 'user', appKey },
        });
    }
  }
  const users = await client.arrayPages<any>(
    (startAt) => route`/rest/api/3/users/search?startAt=${startAt}&maxResults=100`,
    'users',
    100,
  );
  if (!users.ok)
    out.push(
      cov({ area: 'users', target: 'all', status: 'unreadable', reason: `HTTP ${users.status}` }),
    );
  else if (!users.complete)
    out.push(
      cov({ area: 'users', target: 'all', status: 'partial', reason: 'Page limit reached' }),
    );
  for (const u of users.items) {
    const f = personFact(u);
    if (f) out.push(f);
  }
  await stage(seq, out);
  const targets = await groupTargets(seq, ctx.settings);
  return {
    next: targets.length ? { step: 'GROUPS', batch: 0 } : { step: 'FINALIZE', batch: 0 },
    progress: {
      step: 'DIRECTORY',
      batch: 0,
      message: `Read ${groups.items.length} groups, ${appKeys.length} applications and ${users.items.length} accounts`,
      counts: {
        groups: groups.items.length,
        users: users.items.length,
        groupTargets: targets.length,
      },
    },
  };
}

/** Groups whose members we read: those that grant access (or all, per settings). Sorted for stable batches. */
export async function groupTargets(seq: number, settings: Settings): Promise<string[]> {
  const groups = await readStage<{ name: string }>(seq, 'group');
  if (settings.groupMembers === 'all') return groups.map((g) => g.fkey).sort();
  const byName = new Map(groups.map((g) => [g.attrs.name, g.fkey]));
  const ids = new Set<string>();
  for (const g of await readStage<GrantAttrs>(seq, 'grant'))
    if (g.attrs.holderType === 'group') {
      const id =
        g.attrs.holderParam ?? (g.attrs.holderName ? byName.get(g.attrs.holderName) : undefined);
      if (id) ids.add(byName.get(id) ?? id);
    }
  for (const a of await readStage<{ actorType: string; actorId: string }>(seq, 'role_actor'))
    if (a.attrs.actorType === 'group') ids.add(a.attrs.actorId);
  for (const a of await readStage<{ groupId: string }>(seq, 'app_role_group'))
    ids.add(a.attrs.groupId);
  for (const a of await readStage<{ groupId: string; accessType: string }>(seq, 'group_access'))
    if (a.attrs.accessType !== 'user') ids.add(a.attrs.groupId);
  return [...ids].sort();
}

// ---------- GROUPS: members of target groups ----------
export async function groupsStep(ctx: StepContext): Promise<StepResult> {
  const { client, seq, batch } = ctx;
  const targets = await groupTargets(seq, ctx.settings);
  const total = Math.max(1, Math.ceil(targets.length / GROUP_BATCH));
  const slice = targets.slice(batch * GROUP_BATCH, (batch + 1) * GROUP_BATCH);
  const names = new Map(
    (await readStage<{ name: string }>(seq, 'group')).map((g) => [g.fkey, g.attrs.name]),
  );
  const out: StageFact[] = [];
  for (const groupId of slice) {
    const name = names.get(groupId) ?? groupId;
    const r = await client.pages<any>(
      (startAt) =>
        route`/rest/api/3/group/member?groupId=${groupId}&includeInactiveUsers=true&startAt=${startAt}&maxResults=50`,
      'group-members',
    );
    if (!r.ok) {
      out.push(
        { kind: 'group', fkey: groupId, attrs: { name, members: 'unreadable' } },
        cov({
          area: 'group-members',
          target: name,
          status: 'unreadable',
          reason: `HTTP ${r.status}`,
        }),
        { kind: 'carry', fkey: `group_member:${groupId}:`, attrs: {} },
      );
      continue;
    }
    out.push({ kind: 'group', fkey: groupId, attrs: { name, members: 'collected' } });
    if (!r.complete)
      out.push(
        cov({
          area: 'group-members',
          target: name,
          status: 'partial',
          reason: 'Page limit reached',
        }),
      );
    for (const u of r.items) {
      const id = String(u?.accountId ?? '');
      if (!id) continue;
      out.push({
        kind: 'group_member',
        fkey: factKey.groupMember(groupId, id),
        attrs: { groupId, accountId: id },
      });
      const p = personFact(u);
      if (p) out.push(p);
    }
  }
  await stage(seq, out);
  const done = Math.min(targets.length, (batch + 1) * GROUP_BATCH);
  return {
    next: batch + 1 < total ? { step: 'GROUPS', batch: batch + 1 } : { step: 'FINALIZE', batch: 0 },
    progress: {
      step: 'GROUPS',
      batch,
      batches: total,
      message: `Read members of ${done} of ${targets.length} groups`,
      counts: { groupsDone: done, groupTargets: targets.length },
    },
  };
}

// ---------- FINALIZE: fill gaps, coverage, SCD2 merge, content hash ----------
export interface FinalizeResult {
  status: 'complete' | 'partial';
  coverage: CoverageEntry[];
  stats: Record<string, number>;
  contentHash: string;
  merge: { extended: number; inserted: number; carried: number; facts: number };
}

export async function finalize(ctx: StepContext): Promise<FinalizeResult> {
  const { client, seq } = ctx;
  const staged = await readStage(seq);
  const persons = new Set(staged.filter((f) => f.kind === 'person').map((f) => f.fkey));
  const referenced = new Set<string>();
  for (const f of staged) {
    if (f.kind === 'role_actor' && f.attrs.actorType === 'user') referenced.add(f.attrs.actorId);
    if (f.kind === 'group_member') referenced.add(f.attrs.accountId);
    if (f.kind === 'grant' && f.attrs.holderType === 'user' && f.attrs.holderParam)
      referenced.add(f.attrs.holderParam);
    if (f.kind === 'project' && f.attrs.leadAccountId) referenced.add(f.attrs.leadAccountId);
  }
  const extra: StageFact[] = [];
  const missing = [...referenced].filter((id) => !persons.has(id));
  for (const accountId of missing.slice(0, 200)) {
    const r = await client.get<any>(route`/rest/api/3/user?accountId=${accountId}`, 'users');
    const f = r.ok ? personFact(r.body) : null;
    extra.push(
      f ?? {
        kind: 'person',
        fkey: accountId,
        attrs: { displayName: 'Unknown user', accountType: 'unknown', active: true },
      },
    );
  }
  const coverage: CoverageEntry[] = staged
    .filter((f) => f.kind === 'coverage')
    .map((f) => f.attrs as CoverageEntry);
  for (const area of client.impersonated)
    coverage.push({
      area,
      target: 'all',
      status: 'impersonated',
      reason: 'Read with the fallback admin identity (app user was denied)',
    });
  const conditional = staged.filter(
    (f) =>
      f.kind === 'grant' &&
      (CONDITIONAL_HOLDERS.has(f.attrs.holderType) ||
        ['userCustomField', 'groupCustomField'].includes(f.attrs.holderType)),
  ).length;
  if (conditional)
    coverage.push({
      area: 'conditional-grants',
      target: 'all',
      status: 'info',
      reason: `${conditional} grants depend on the issue (reporter, assignee, custom fields) and are not expanded to people`,
    });
  const team = staged.filter((f) => f.kind === 'project' && f.attrs.style === 'team').length;
  if (team)
    coverage.push({
      area: 'team-managed',
      target: 'all',
      status: 'info',
      reason: `${team} team-managed projects use a per-project scheme and roles (simplified model)`,
    });
  coverage.push({
    area: 'global-permissions',
    target: 'all',
    status: 'info',
    reason:
      'Jira has no API listing global permission holders; admin access is derived from admin/site-admin groups',
  });
  if (extra.length) await stage(seq, extra);
  const prev = await previousCommitted(seq);
  const merge = await mergeStage(seq, prev?.seq ?? null);
  const hash = await computeContentHash(seq);
  const stats: Record<string, number> = {};
  for (const f of [...staged, ...extra])
    if (f.kind !== 'coverage' && f.kind !== 'carry') stats[f.kind] = (stats[f.kind] ?? 0) + 1;
  await clearStage(seq);
  const partial = coverage.some(
    (c) => c.status === 'unreadable' || c.status === 'partial' || c.status === 'carried',
  );
  for (const c of coverage)
    if (c.status === 'unreadable' && /role-actors|group-members/.test(c.area))
      c.reason += '; previous values carried forward';
  return { status: partial ? 'partial' : 'complete', coverage, stats, contentHash: hash, merge };
}
