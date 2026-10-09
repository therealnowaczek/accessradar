import api, { route } from '@forge/api';

export class ForbiddenError extends Error {}

const cache = new Map<string, number>();
const TTL_MS = 60_000;

/** Pure: does a permissions/check response grant ADMINISTER globally? */
export function hasGlobalAdminister(body: unknown): boolean {
  const list = (body as { globalPermissions?: unknown })?.globalPermissions;
  return Array.isArray(list) && list.includes('ADMINISTER');
}

/**
 * Authorize: the interactive caller must have Administer Jira. The accountId comes from the
 * resolver context (server-side), never from the payload. Checked with POST permissions/check,
 * falling back to mypermissions as the user. Positive results are cached for 60 s per account.
 */
export async function assertJiraAdmin(accountId?: string): Promise<void> {
  if (!accountId) throw new ForbiddenError('AccessRadar is available to Jira administrators only');
  const hit = cache.get(accountId);
  if (hit && Date.now() - hit < TTL_MS) return;
  let allowed: boolean;
  const res = await api.asApp().requestJira(route`/rest/api/3/permissions/check`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId, globalPermissions: ['ADMINISTER'] }),
  });
  if (res.ok) allowed = hasGlobalAdminister(await res.json());
  else {
    const mine = await api
      .asUser()
      .requestJira(route`/rest/api/3/mypermissions?permissions=ADMINISTER`, {
        headers: { Accept: 'application/json' },
      });
    if (!mine.ok) throw new Error(`Authorization check failed (${mine.status})`);
    const body = (await mine.json()) as {
      permissions?: { ADMINISTER?: { havePermission?: boolean } };
    };
    allowed = body.permissions?.ADMINISTER?.havePermission === true;
  }
  if (!allowed) throw new ForbiddenError('AccessRadar is available to Jira administrators only');
  cache.set(accountId, Date.now());
}
