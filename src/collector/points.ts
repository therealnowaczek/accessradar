/**
 * Own rate-point accounting (Jira REST point-based limits, enforced since 2026-03-02).
 * Cost = 1 base point + objects returned; "identity & access" objects (users, groups, project
 * roles, permissions) cost 2 points, core objects (projects, schemes) 1 point.
 * The response headers do not expose the remaining global quota, so we count ourselves.
 */
const IDENTITY_PATHS = [
  '/group/member',
  '/group/bulk',
  '/users/search',
  '/user',
  '/role',
  '/permission',
  '/applicationrole',
  '/permissions/check',
];

export function isIdentityPath(path: string): boolean {
  const p = path.split('?')[0];
  return IDENTITY_PATHS.some((seg) => p.includes(seg));
}

export function countObjects(body: unknown): number {
  if (Array.isArray(body)) return body.length;
  if (body && typeof body === 'object') {
    const b = body as Record<string, unknown>;
    for (const key of [
      'values',
      'permissions',
      'permissionSchemes',
      'actors',
      'users',
      'members',
    ]) {
      const v = b[key];
      if (Array.isArray(v)) return v.length;
    }
    return 1;
  }
  return 0;
}

export function estimatePoints(path: string, body: unknown): number {
  return 1 + countObjects(body) * (isIdentityPath(path) ? 2 : 1);
}

/** Start of the current UTC hour, epoch ms (Jira quota windows reset on the UTC hour). */
export function hourBucket(now = Date.now()): number {
  return Math.floor(now / 3600_000) * 3600_000;
}

export function secondsToNextHour(now = Date.now()): number {
  return Math.ceil((hourBucket(now) + 3600_000 - now) / 1000);
}
