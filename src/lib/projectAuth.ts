import api, { route } from '@forge/api';
import { ForbiddenError, hasGlobalAdminister } from './auth';

const cache = new Map<string, number>();
const TTL_MS = 60_000;

/** Pure: does a permissions/check response grant ADMINISTER_PROJECTS on projectId? */
export function hasProjectAdminister(body: unknown, projectId: string): boolean {
  const list = (body as { projectPermissions?: unknown })?.projectPermissions;
  if (!Array.isArray(list)) return false;
  const want = String(projectId);
  return list.some((p) => {
    const row = p as { permission?: string; projects?: Array<number | string> };
    if (row.permission !== 'ADMINISTER_PROJECTS') return false;
    return Array.isArray(row.projects) && row.projects.some((id) => String(id) === want);
  });
}

/**
 * Caller must have ADMINISTER_PROJECTS on the project (from server context, never payload).
 * Uses POST /rest/api/3/permissions/check asApp — scope read:permission:jira already present.
 */
export async function assertProjectAdminister(
  accountId: string | undefined,
  projectId: string,
): Promise<void> {
  if (!accountId) throw new ForbiddenError('Only a project admin can review access here');
  const key = `${accountId}:${projectId}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit < TTL_MS) return;

  const projectNum = Number(projectId);
  const projects = Number.isFinite(projectNum) ? [projectNum] : [projectId];
  const res = await api.asApp().requestJira(route`/rest/api/3/permissions/check`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId,
      projectPermissions: [{ permissions: ['ADMINISTER_PROJECTS'], projects }],
    }),
  });
  if (!res.ok) throw new Error(`Project authorization check failed (${res.status})`);
  const allowed = hasProjectAdminister(await res.json(), projectId);
  if (!allowed) throw new ForbiddenError('Only a project admin can review access here');
  cache.set(key, Date.now());
}

/** Soft site-admin check (no throw). Used so Jira admins can support project reviews. */
export async function isJiraAdmin(accountId: string | undefined): Promise<boolean> {
  if (!accountId) return false;
  const res = await api.asApp().requestJira(route`/rest/api/3/permissions/check`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ accountId, globalPermissions: ['ADMINISTER'] }),
  });
  if (!res.ok) return false;
  return hasGlobalAdminister(await res.json());
}

export type AssignmentAccess = 'assignee' | 'site-admin' | 'not-assigned';

/** After project-admin gate: can the caller work the open assignment? */
export function assignmentAccess(opts: {
  accountId: string;
  assignee: string | null | undefined;
  isSiteAdmin: boolean;
}): AssignmentAccess {
  if (opts.assignee && opts.assignee === opts.accountId) return 'assignee';
  if (opts.isSiteAdmin) return 'site-admin';
  return 'not-assigned';
}

/** Clear auth cache (tests). */
export function clearProjectAuthCache() {
  cache.clear();
}
