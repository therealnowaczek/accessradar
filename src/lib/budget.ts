import { errInfo } from './errors';

/**
 * Time budgets and bounded concurrency for Forge functions.
 *
 * UI resolvers are stopped by the platform after 25 s (a "Timeout" invocation error with no app
 * log). Resolvers race their work against a smaller budget so a slow call returns a handled
 * "still working" answer instead. The work itself keeps running in the warm container, and the
 * single-flight caches (facts, state, migrations) let the next call pick the result up.
 */

/** Platform limit is 25 s; leave room for auth, logging and the response itself. */
export const RESOLVER_BUDGET_MS = 20_000;
/** Single Jira REST call made from a resolver. */
export const JIRA_CALL_BUDGET_MS = 8_000;

export class BudgetExceededError extends Error {
  constructor(
    readonly phase: string,
    readonly budgetMs: number,
  ) {
    super(`${phase} did not finish within ${budgetMs} ms`);
    this.name = 'BudgetExceededError';
  }
}

/**
 * Resolves with `work` or rejects with BudgetExceededError after `ms`. The losing promise is not
 * cancelled (JavaScript cannot); its later rejection is swallowed so it never becomes unhandled.
 */
export function withDeadline<T>(work: Promise<T>, ms: number, phase: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new BudgetExceededError(phase, ms)), ms);
  });
  work.catch(() => undefined);
  return Promise.race([work, deadline]).finally(() => clearTimeout(timer));
}

/** Like Promise.all over `items`, but at most `limit` calls of `fn` run at once. Keeps order. */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Shares one in-flight promise per key, so concurrent callers in the same container (or a retry
 * after a budget answer) wait for the same work instead of starting it again. Failed work is
 * forgotten so the next caller retries.
 */
export function singleFlight<K, V>(): (key: K, work: () => Promise<V>) => Promise<V> {
  const inflight = new Map<K, Promise<V>>();
  return (key, work) => {
    const hit = inflight.get(key);
    if (hit) return hit;
    const p = work().finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
  };
}

/**
 * A single Jira REST call from a resolver, bounded by JIRA_CALL_BUDGET_MS. A slow Jira answer
 * becomes a normal, logged error naming the call instead of eating the whole resolver budget.
 */
export async function jiraCall<T>(label: string, call: () => Promise<T>): Promise<T> {
  try {
    return await withDeadline(call(), JIRA_CALL_BUDGET_MS, label);
  } catch (e) {
    if (e instanceof BudgetExceededError)
      throw new Error(`Jira did not respond within ${JIRA_CALL_BUDGET_MS / 1000} s (${label})`, {
        cause: e,
      });
    throw e;
  }
}

export const SLOW_MESSAGE =
  'AccessRadar is still loading this view (large site). Please try again in a moment.';
export const SETUP_MESSAGE =
  'AccessRadar is finishing its database setup. Please try again in a minute.';

/** Phase reached by a resolver call; reported when the time budget runs out. */
export type Phase = { at: 'auth' | 'setup' | 'edition' | 'handler' };

/**
 * Runs one resolver body under RESOLVER_BUDGET_MS. Past the budget it answers with a handled,
 * retryable message instead of letting the platform kill the call at 25 s (no log, generic UI
 * error). The work keeps running in the container; a retry joins the same in-flight reads.
 */
export async function withResolverBudget<T>(
  label: string,
  phase: Phase,
  work: Promise<T>,
  budgetMs = RESOLVER_BUDGET_MS,
): Promise<{ ok: true; data: T } | { ok: false; error: string; retryable: true }> {
  const started = Date.now();
  try {
    return { ok: true, data: await withDeadline(work, budgetMs, label) };
  } catch (e) {
    if (!(e instanceof BudgetExceededError)) throw e;
    console.warn(`${label} over budget`, { ms: Date.now() - started, phase: phase.at });
    work.then(
      () => console.log(`${label} finished late`, { ms: Date.now() - started }),
      (err) => console.warn(`${label} failed late`, { phase: phase.at, ...errInfo(err) }),
    );
    return {
      ok: false,
      error: phase.at === 'setup' ? SETUP_MESSAGE : SLOW_MESSAGE,
      retryable: true,
    };
  }
}
