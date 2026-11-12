import { client, route } from './jira';

/**
 * Phase 3b (read-only): publicly shared filters and dashboards (I), issue security levels (K) and
 * recent permission-related audit-log entries (J). Every call is a GET. A missing scope (the site
 * admin has not approved the 3.0 upgrade yet) or a plan limit never throws: the result says why the
 * section is unavailable, so the rest of AccessRadar keeps working.
 */
export type Unavailable = { status: 'needs-consent' | 'unavailable'; reason: string };
export type Section<T> = ({ status: 'ok' } & T) | Unavailable;

const app = () => client({ kind: 'app' });
const json = { headers: { Accept: 'application/json' } };

type Fetched = { ok: true; data: any } | ({ ok: false } & Unavailable);

/** 401 "scope does not match" = consent missing; 403 = permission or plan limit (message shown). */
export async function getJson(path: ReturnType<typeof route>): Promise<Fetched> {
  const res = await app().requestJira(path, json);
  if (res.ok) return { ok: true, data: await res.json() };
  const text = (await res.text()).slice(0, 300);
  if (res.status === 401 && /scope/i.test(text)) {
    return {
      ok: false,
      status: 'needs-consent',
      reason: 'A Jira administrator has not approved the AccessRadar 3.0 permissions yet.',
    };
  }
  let message = '';
  try {
    const j = JSON.parse(text);
    message = j.message ?? j.errorMessages?.[0] ?? '';
  } catch {
    /* not JSON */
  }
  return { ok: false, status: 'unavailable', reason: message || `Jira answered ${res.status}.` };
}

// ---------- I: publicly shared filters and dashboards ----------
export interface SharedItem {
  kind: 'filter' | 'dashboard';
  id: string;
  name: string;
  owner: string;
  /** Widest share type: anyone (public), loggedin (every signed-in user), or a narrower one. */
  exposure: 'anyone' | 'loggedin' | 'restricted';
  shares: string[];
}

const widest = (types: string[]): SharedItem['exposure'] =>
  types.includes('global') || types.includes('anonymous')
    ? 'anyone'
    : types.includes('loggedin') || types.includes('authenticated')
      ? 'loggedin'
      : 'restricted';

async function pages(base: (startAt: number) => ReturnType<typeof route>, cap = 20) {
  const out: any[] = [];
  for (let i = 0; i < cap; i++) {
    const r = await getJson(base(out.length));
    if (!r.ok) return r;
    out.push(...(r.data.values ?? []));
    if (r.data.isLast !== false || !(r.data.values ?? []).length) break;
  }
  return { ok: true as const, data: out };
}

export async function sharedItems(): Promise<
  Section<{ items: SharedItem[]; counts: { anyone: number; loggedin: number; total: number } }>
> {
  const filters = await pages(
    (n) => route`/rest/api/3/filter/search?expand=sharePermissions&maxResults=100&startAt=${n}`,
  );
  if (!filters.ok) return { status: filters.status, reason: filters.reason };
  const dashboards = await pages(
    (n) => route`/rest/api/3/dashboard/search?expand=sharePermissions&maxResults=100&startAt=${n}`,
  );
  if (!dashboards.ok) return { status: dashboards.status, reason: dashboards.reason };
  const make =
    (kind: SharedItem['kind']) =>
    (x: any): SharedItem => {
      const shares: string[] = (x.sharePermissions ?? []).map((s: any) => String(s.type));
      return {
        kind,
        id: String(x.id),
        name: String(x.name ?? ''),
        owner: String(x.owner?.displayName ?? ''),
        exposure: widest(shares),
        shares: [...new Set(shares)],
      };
    };
  const all = [...filters.data.map(make('filter')), ...dashboards.data.map(make('dashboard'))];
  const items = all.filter((i) => i.exposure !== 'restricted').slice(0, 500);
  return {
    status: 'ok',
    items,
    counts: {
      anyone: all.filter((i) => i.exposure === 'anyone').length,
      loggedin: all.filter((i) => i.exposure === 'loggedin').length,
      total: all.length,
    },
  };
}

// ---------- K: issue security levels ----------
export interface SecurityLevel {
  schemeId: string;
  schemeName: string;
  levelId: string;
  name: string;
  isDefault: boolean;
  /** Holder types granted the level (group, user, projectRole, reporter ...) with counts. */
  holders: Record<string, number>;
}

export async function securityLevels(): Promise<
  Section<{
    schemes: Array<{ id: string; name: string; levels: number; projects: string[] }>;
    levels: SecurityLevel[];
  }>
> {
  const schemes = await getJson(route`/rest/api/3/issuesecurityschemes`);
  if (!schemes.ok) return { status: schemes.status, reason: schemes.reason };
  const list: any[] = schemes.data.issueSecuritySchemes ?? [];
  const members = await pages(
    (n) => route`/rest/api/3/issuesecurityschemes/level/member?maxResults=100&startAt=${n}`,
  );
  if (!members.ok) return { status: members.status, reason: members.reason };
  const levelsRes = await pages(
    (n) => route`/rest/api/3/issuesecurityschemes/level?maxResults=100&startAt=${n}`,
  );
  if (!levelsRes.ok) return { status: levelsRes.status, reason: levelsRes.reason };
  const schemeName = new Map(list.map((s) => [String(s.id), String(s.name)]));
  const byLevel = new Map<string, Record<string, number>>();
  for (const m of members.data) {
    const key = String(m.issueSecurityLevelId);
    const holders = byLevel.get(key) ?? {};
    const type = String(m.holder?.type ?? 'unknown');
    holders[type] = (holders[type] ?? 0) + 1;
    byLevel.set(key, holders);
  }
  const levels: SecurityLevel[] = levelsRes.data.map((l: any) => ({
    schemeId: String(l.issueSecuritySchemeId),
    schemeName: schemeName.get(String(l.issueSecuritySchemeId)) ?? '',
    levelId: String(l.id),
    name: String(l.name ?? ''),
    isDefault: Boolean(l.isDefault),
    holders: byLevel.get(String(l.id)) ?? {},
  }));
  // Which spaces use each scheme (one call per space, capped).
  const projects = await pages(
    (n) => route`/rest/api/3/project/search?maxResults=50&startAt=${n}`,
    6,
  );
  const usage = new Map<string, string[]>();
  if (projects.ok) {
    for (const p of projects.data.slice(0, 200)) {
      const r = await getJson(route`/rest/api/3/project/${String(p.key)}/issuesecuritylevelscheme`);
      if (r.ok && r.data?.id !== undefined) {
        const id = String(r.data.id);
        usage.set(id, [...(usage.get(id) ?? []), String(p.key)]);
      }
    }
  }
  return {
    status: 'ok',
    schemes: list.map((s) => ({
      id: String(s.id),
      name: String(s.name),
      levels: levels.filter((l) => l.schemeId === String(s.id)).length,
      projects: usage.get(String(s.id)) ?? [],
    })),
    levels,
  };
}

// ---------- J: audit-log diffs ----------
export interface AuditChange {
  id: string;
  at: string;
  who: string;
  category: string;
  summary: string;
  object: string;
  changes: Array<{ field: string; from: string; to: string }>;
}

const AUDIT_CATEGORIES = /permission|group|user management|role|security|application access/i;

export async function auditChanges(
  days = 7,
): Promise<Section<{ changes: AuditChange[]; since: string }>> {
  const from = new Date(Date.now() - days * 86_400_000).toISOString();
  const r = await getJson(route`/rest/api/3/auditing/record?from=${from}&limit=1000`);
  if (!r.ok) return { status: r.status, reason: r.reason };
  const changes: AuditChange[] = (r.data.records ?? [])
    .filter((x: any) => AUDIT_CATEGORIES.test(`${x.category ?? ''} ${x.summary ?? ''}`))
    .slice(0, 300)
    .map((x: any) => ({
      id: String(x.id),
      at: String(x.created ?? ''),
      who: String(x.authorKey ?? x.authorAccountId ?? 'system'),
      category: String(x.category ?? ''),
      summary: String(x.summary ?? ''),
      object: String(x.objectItem?.name ?? ''),
      changes: (x.changedValues ?? []).slice(0, 10).map((c: any) => ({
        field: String(c.fieldName ?? ''),
        from: String(c.changedFrom ?? ''),
        to: String(c.changedTo ?? ''),
      })),
    }));
  return { status: 'ok', changes, since: from };
}
