import { client, pickRateLimitHeaders, route, type CallIdentity } from '../lib/jira';

/**
 * Week-1 spike: which read endpoints work for which call identity with granular read:* scopes.
 * Returns ONLY status codes, counts, error messages and rate-limit headers — no user data.
 * Enabled only when env var ACCESSRADAR_SPIKE=1 (development environment).
 */
export interface ProbeResult {
  name: string;
  status: number;
  count?: number;
  error?: string;
  rl?: Record<string, string>;
  data?: Record<string, unknown>;
}

export const spikeEnabled = () => process.env.ACCESSRADAR_SPIKE === '1';

type Resp = Awaited<ReturnType<ReturnType<typeof client>['requestJira']>>;

async function summarize(name: string, res: Resp, extract?: (j: any) => Partial<ProbeResult>): Promise<ProbeResult> {
  const out: ProbeResult = { name, status: res.status, rl: pickRateLimitHeaders(res.headers) };
  const text = await res.text();
  let json: any;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    out.error = (json?.errorMessages?.[0] ?? json?.message ?? json?.detail ?? text ?? '').toString().slice(0, 200);
  } else if (extract && json !== undefined) {
    Object.assign(out, extract(json));
  }
  return out;
}

const count = (j: any) => ({ count: Array.isArray(j) ? j.length : Array.isArray(j?.values) ? j.values.length : undefined });

export async function runProbes(identity: CallIdentity): Promise<ProbeResult[]> {
  const c = client(identity);
  const get = (r: ReturnType<typeof route>) => c.requestJira(r, { headers: { Accept: 'application/json' } });
  const results: ProbeResult[] = [];
  const add = async (name: string, p: Promise<Resp>, extract?: (j: any) => Partial<ProbeResult>) => {
    try {
      results.push(await summarize(name, await p, extract));
    } catch (e) {
      results.push({ name, status: -1, error: String((e as Error)?.message ?? e).slice(0, 200) });
    }
  };

  let projectKey: string | undefined;
  let groupId: string | undefined;
  await add('GET myself', get(route`/rest/api/3/myself`), (j) => ({ data: { accountType: j.accountType } }));
  await add(
    'GET mypermissions (global)',
    get(route`/rest/api/3/mypermissions?permissions=ADMINISTER,USER_PICKER,SYSTEM_ADMIN,BROWSE_PROJECTS,ADMINISTER_PROJECTS`),
    (j) => ({
      data: Object.fromEntries(Object.entries(j.permissions ?? {}).map(([k, v]: [string, any]) => [k, v.havePermission])),
    }),
  );
  await add('GET project/search', get(route`/rest/api/3/project/search?maxResults=50`), (j) => {
    projectKey = j.values?.[0]?.key;
    return { count: j.values?.length, data: { total: j.total, styles: [...new Set((j.values ?? []).map((p: any) => p.style))] } };
  });
  if (projectKey) {
    await add('GET project/{key}/permissionscheme', get(route`/rest/api/3/project/${projectKey}/permissionscheme`));
    await add('GET project/{key}/role', get(route`/rest/api/3/project/${projectKey}/role`), (j) => ({ count: Object.keys(j).length }));
    const rolesRes = await get(route`/rest/api/3/project/${projectKey}/role`);
    const roles = rolesRes.ok ? ((await rolesRes.json()) as Record<string, string>) : {};
    const firstRoleId = Object.values(roles)[0]?.split('/').pop();
    if (firstRoleId)
      await add('GET project/{key}/role/{id}', get(route`/rest/api/3/project/${projectKey}/role/${firstRoleId}`), (j) => ({
        count: j.actors?.length,
      }));
  }
  await add('GET permissionscheme?expand=all', get(route`/rest/api/3/permissionscheme?expand=all`), (j) => ({
    count: j.permissionSchemes?.length,
  }));
  await add('GET permissions (catalog)', get(route`/rest/api/3/permissions`), (j) => ({ count: Object.keys(j.permissions ?? {}).length }));
  await add('GET role (all)', get(route`/rest/api/3/role`), count);
  await add('GET group/bulk', get(route`/rest/api/3/group/bulk?maxResults=50`), (j) => {
    groupId = j.values?.find((g: any) => /jira-users|jira-software-users/.test(g.name))?.groupId ?? j.values?.[0]?.groupId;
    return { count: j.values?.length, data: { total: j.total } };
  });
  await add('GET group/bulk?accessType=admin', get(route`/rest/api/3/group/bulk?accessType=admin`), count);
  await add('GET group/bulk?accessType=site-admin', get(route`/rest/api/3/group/bulk?accessType=site-admin`), count);
  if (groupId)
    await add('GET group/member', get(route`/rest/api/3/group/member?groupId=${groupId}&includeInactiveUsers=true&maxResults=50`), (j) => ({
      count: j.values?.length,
      data: { total: j.total },
    }));
  await add('GET applicationrole', get(route`/rest/api/3/applicationrole`), count);
  await add(
    'POST permissions/check (self, global)',
    c.requestJira(route`/rest/api/3/permissions/check`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ globalPermissions: ['ADMINISTER', 'USER_PICKER', 'SYSTEM_ADMIN'] }),
    }),
    (j) => ({ data: { globalPermissions: j.globalPermissions } }),
  );
  await add('GET users/search', get(route`/rest/api/3/users/search?maxResults=50`), count);
  // Negative control: issue search must FAIL with read-only granular scopes (no read:jira-work).
  await add('GET search/jql (negative control)', get(route`/rest/api/3/search/jql?jql=order%20by%20created&maxResults=1`));
  return results;
}

export function formatProbeLog(label: string, results: ProbeResult[]): string {
  return `[spike:${label}] ` + JSON.stringify(results);
}
