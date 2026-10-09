import api, { route } from '@forge/api';

/** Identity used for a Jira REST call. `user` = interactive caller (UI resolver),
 *  `impersonate` = offline impersonation of a stored accountId, `app` = app user. */
export type CallIdentity =
  | { kind: 'app' }
  | { kind: 'user' }
  | { kind: 'impersonate'; accountId: string };

export function client(identity: CallIdentity) {
  switch (identity.kind) {
    case 'app':
      return api.asApp();
    case 'user':
      return api.asUser();
    case 'impersonate':
      return api.asUser(identity.accountId);
  }
}

export { route };

/** Rate-limit headers worth logging (no PII). */
export const RATE_LIMIT_HEADERS = [
  'retry-after',
  'ratelimit-reason',
  'x-ratelimit-limit',
  'x-ratelimit-remaining',
  'beta-ratelimit-policy',
  'beta-ratelimit',
  'ratelimit-policy',
  'ratelimit',
];

export function pickRateLimitHeaders(headers: { get(name: string): string | null }): Record<string, string> {
  const out: Record<string, string> = {};
  for (const h of RATE_LIMIT_HEADERS) {
    const v = headers.get(h);
    if (v) out[h] = v;
  }
  return out;
}

/** Parses Retry-After (seconds or HTTP date) into seconds, clamped to Forge's 900 s max. */
export function retryAfterSeconds(value: string | null | undefined, now = Date.now()): number {
  if (!value) return 60;
  const n = Number(value);
  let secs = Number.isFinite(n) ? n : Math.ceil((Date.parse(value) - now) / 1000);
  if (!Number.isFinite(secs) || secs <= 0) secs = 60;
  return Math.min(900, Math.max(1, Math.ceil(secs)));
}
