import api, { getAppContext, route } from '@forge/api';
import { jiraCall, singleFlight } from './budget';
import { errInfo } from './errors';

export class ForbiddenError extends Error {}

export const ADMIN_ONLY_MESSAGE = 'AccessRadar is available to Jira administrators only';

const cache = new Map<string, number>();
const TTL_MS = 60_000;

/** Pure: does a permissions/check response grant ADMINISTER globally? */
export function hasGlobalAdminister(body: unknown): boolean {
  const list = (body as { globalPermissions?: unknown })?.globalPermissions;
  return Array.isArray(list) && list.includes('ADMINISTER');
}

/** Pure: does a mypermissions response grant ADMINISTER to the caller? */
export function myPermissionsAdminister(body: unknown): boolean {
  const p = (body as { permissions?: { ADMINISTER?: { havePermission?: unknown } } })?.permissions;
  return p?.ADMINISTER?.havePermission === true;
}

export type AdminCheckOptions = {
  /**
   * `app` (default, admin UI): POST permissions/check as the app, then the caller as fallback.
   * `user` (Rovo actions and MCP tools): the caller first (GET mypermissions as the user).
   */
  prefer?: 'app' | 'user';
  /**
   * false = never call asApp(). MCP-invoked actions must not use asApp (Forge blocks it there),
   * so the MCP path runs as the user only.
   */
  allowApp?: boolean;
};

/**
 * Positive results are cached for 60 s per installation and account. The cache never spans
 * installations: one warm isolate can serve several sites, and admin on one site says nothing
 * about another. Without an installation id there is no cache.
 */
function cacheKey(accountId: string): string | null {
  try {
    const ari = getAppContext()?.installationAri as unknown;
    const id = ari ? String((ari as { toString(): string }).toString()) : '';
    return id ? `${id}|${accountId}` : null;
  } catch {
    return null;
  }
}

/**
 * Authorize: the interactive caller must have Administer Jira. The accountId comes from the
 * server-side invocation context, never from the payload.
 */
export async function assertJiraAdmin(
  accountId?: string,
  opts: AdminCheckOptions = {},
): Promise<void> {
  if (!accountId) throw new ForbiddenError(ADMIN_ONLY_MESSAGE);
  const key = cacheKey(accountId);
  const hit = key ? cache.get(key) : undefined;
  if (hit && Date.now() - hit < TTL_MS) return;
  const prefer = opts.prefer ?? 'app';
  const allowApp = opts.allowApp ?? true;
  // The admin page fires several resolvers at once; they share one Jira check.
  return adminFlight(`${prefer}|${allowApp}|${key ?? accountId}`, async () => {
    await checkJiraAdmin(accountId, prefer, allowApp);
    if (key) cache.set(key, Date.now());
  });
}

const adminFlight = singleFlight<string, void>();

/** true/false = Jira answered; null = this identity could not answer (error or non-2xx). */
async function asUserCheck(): Promise<boolean | null> {
  try {
    const res = await jiraCall('mypermissions', () =>
      api.asUser().requestJira(route`/rest/api/3/mypermissions?permissions=ADMINISTER`, {
        headers: { Accept: 'application/json' },
      }),
    );
    if (!res.ok) {
      console.warn('[auth] asUser mypermissions not ok', { status: res.status });
      return null;
    }
    return myPermissionsAdminister(await res.json());
  } catch (e) {
    console.warn('[auth] asUser mypermissions failed', errInfo(e));
    return null;
  }
}

async function asAppCheck(accountId: string): Promise<boolean | null> {
  try {
    const res = await jiraCall('permissions/check', () =>
      api.asApp().requestJira(route`/rest/api/3/permissions/check`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, globalPermissions: ['ADMINISTER'] }),
      }),
    );
    if (!res.ok) {
      console.warn('[auth] asApp permissions/check not ok', { status: res.status });
      return null;
    }
    return hasGlobalAdminister(await res.json());
  } catch (e) {
    console.warn('[auth] asApp permissions/check failed', errInfo(e));
    return null;
  }
}

async function checkJiraAdmin(
  accountId: string,
  prefer: 'app' | 'user',
  allowApp: boolean,
): Promise<void> {
  const order: Array<() => Promise<boolean | null>> =
    prefer === 'user' || !allowApp
      ? [asUserCheck, ...(allowApp ? [() => asAppCheck(accountId)] : [])]
      : [() => asAppCheck(accountId), asUserCheck];
  let allowed: boolean | null = null;
  for (const check of order) {
    allowed = await check();
    if (allowed !== null) break;
  }
  if (allowed === null) throw new Error('Authorization check failed');
  if (!allowed) throw new ForbiddenError(ADMIN_ONLY_MESSAGE);
}

/** Test hook: forget cached positive answers. */
export function _resetAdminCache(): void {
  cache.clear();
}
