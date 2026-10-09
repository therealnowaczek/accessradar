import api, { route } from '@forge/api';
import { retryAfterSeconds } from '../lib/jira';
import { estimatePoints } from './points';

export class RateLimitedError extends Error {
  constructor(
    public readonly retryAfter: number,
    public readonly reason: string,
  ) {
    super(`Jira rate limit (${reason}), retry after ${retryAfter}s`);
  }
}

export type Route = ReturnType<typeof route>;

export interface JiraResult<T> {
  ok: boolean;
  status: number;
  body: T | null;
  error?: string;
  identity: 'app' | 'impersonation';
}

/**
 * Jira client for the collector. Calls run as the app user (asApp); when the app user is denied
 * (401/403) and an admin opted in as fallback identity, the call is retried with offline
 * impersonation of that admin. Every call is counted in rate points; 429 raises RateLimitedError
 * with Retry-After so the queue can back off; transient 5xx are retried with backoff.
 */
export class CollectorClient {
  points = 0;
  calls = 0;
  impersonated = new Set<string>();

  constructor(
    private readonly fallbackAccountId: string | null,
    private readonly sleep = (ms: number) => new Promise((r) => setTimeout(r, ms)),
  ) {}

  async get<T>(
    r: Route,
    area: string,
    init?: { method?: string; body?: string },
  ): Promise<JiraResult<T>> {
    let res = await this.send(r, 'app', init);
    if ((res.status === 401 || res.status === 403) && this.fallbackAccountId) {
      const alt = await this.send(r, 'impersonation', init);
      if (alt.ok) {
        this.impersonated.add(area);
        return alt as JiraResult<T>;
      }
      res = alt;
    }
    return res as JiraResult<T>;
  }

  private async send(
    r: Route,
    identity: 'app' | 'impersonation',
    init?: { method?: string; body?: string },
  ): Promise<JiraResult<unknown>> {
    const client = identity === 'app' ? api.asApp() : api.asUser(this.fallbackAccountId!);
    for (let attempt = 0; ; attempt++) {
      const res = await client.requestJira(r, {
        method: init?.method ?? 'GET',
        headers: {
          Accept: 'application/json',
          ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(init?.body ? { body: init.body } : {}),
      });
      this.calls += 1;
      if (res.status === 429) {
        this.points += 1;
        throw new RateLimitedError(
          retryAfterSeconds(res.headers.get('retry-after')),
          res.headers.get('ratelimit-reason') ?? 'rate-limited',
        );
      }
      if (res.status >= 500 && attempt < 2) {
        this.points += 1;
        await this.sleep(1000 * (attempt + 1) * 2);
        continue;
      }
      const text = await res.text();
      let body: unknown;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = null;
      }
      this.points += res.ok ? estimatePoints(r.value, body) : 1;
      if (!res.ok) {
        const b = body as { errorMessages?: string[]; message?: string } | null;
        return {
          ok: false,
          status: res.status,
          body: null,
          error: (b?.errorMessages?.[0] ?? b?.message ?? `HTTP ${res.status}`).slice(0, 200),
          identity,
        };
      }
      return { ok: true, status: res.status, body, identity };
    }
  }

  /** startAt/maxResults pagination until isLast (PageBean). */
  async pages<T>(
    build: (startAt: number) => Route,
    area: string,
    maxPages = 400,
  ): Promise<{ ok: boolean; items: T[]; status: number; error?: string; complete: boolean }> {
    const items: T[] = [];
    let startAt = 0;
    for (let page = 0; page < maxPages; page++) {
      const res = await this.get<{ values?: T[]; isLast?: boolean; total?: number }>(
        build(startAt),
        area,
      );
      if (!res.ok)
        return { ok: false, items, status: res.status, error: res.error, complete: false };
      const values = Array.isArray(res.body?.values) ? res.body!.values! : [];
      items.push(...values);
      if (res.body?.isLast === true || values.length === 0)
        return { ok: true, items, status: res.status, complete: true };
      startAt += values.length;
    }
    return { ok: true, items, status: 200, complete: false };
  }

  /** Plain-array endpoints paginated by startAt/maxResults (e.g. users/search). */
  async arrayPages<T>(
    build: (startAt: number) => Route,
    area: string,
    pageSize: number,
    maxPages = 200,
  ) {
    const items: T[] = [];
    let startAt = 0;
    for (let page = 0; page < maxPages; page++) {
      const res = await this.get<T[]>(build(startAt), area);
      if (!res.ok)
        return { ok: false, items, status: res.status, error: res.error, complete: false };
      const values = Array.isArray(res.body) ? res.body : [];
      items.push(...values);
      if (values.length < pageSize) return { ok: true, items, status: res.status, complete: true };
      startAt += values.length;
    }
    return { ok: true, items, status: 200, complete: false };
  }
}

export { route };
