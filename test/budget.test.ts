import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BudgetExceededError,
  jiraCall,
  JIRA_CALL_BUDGET_MS,
  mapLimit,
  SETUP_MESSAGE,
  singleFlight,
  SLOW_MESSAGE,
  withDeadline,
  withResolverBudget,
  type Phase,
} from '../src/lib/budget';

const never = () => new Promise<never>(() => undefined);

describe('withDeadline', () => {
  afterEach(() => vi.useRealTimers());

  it('returns the work result when it finishes in time', async () => {
    await expect(withDeadline(Promise.resolve(7), 50, 'x')).resolves.toBe(7);
  });

  it('rejects with BudgetExceededError when the work is too slow', async () => {
    vi.useFakeTimers();
    const p = withDeadline(never(), 1000, 'slow thing');
    vi.advanceTimersByTime(1000);
    await expect(p).rejects.toBeInstanceOf(BudgetExceededError);
    await expect(p).rejects.toMatchObject({ phase: 'slow thing', budgetMs: 1000 });
  });

  it('passes work errors through unchanged', async () => {
    await expect(withDeadline(Promise.reject(new Error('boom')), 50, 'x')).rejects.toThrow('boom');
  });
});

describe('mapLimit', () => {
  it('keeps input order and never runs more than the limit at once', async () => {
    let running = 0;
    let peak = 0;
    const out = await mapLimit([5, 1, 4, 2, 3, 0], 2, async (n) => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, n));
      running -= 1;
      return n * 10;
    });
    expect(out).toEqual([50, 10, 40, 20, 30, 0]);
    expect(peak).toBe(2);
  });

  it('handles an empty list', async () => {
    await expect(mapLimit([], 4, async () => 1)).resolves.toEqual([]);
  });
});

describe('singleFlight', () => {
  it('shares one in-flight promise per key', async () => {
    const flight = singleFlight<string, number>();
    const work = vi.fn(async () => 42);
    const [a, b] = await Promise.all([flight('k', work), flight('k', work)]);
    expect([a, b]).toEqual([42, 42]);
    expect(work).toHaveBeenCalledTimes(1);
  });

  it('forgets failed work so the next caller retries', async () => {
    const flight = singleFlight<string, number>();
    await expect(flight('k', async () => Promise.reject(new Error('x')))).rejects.toThrow('x');
    await expect(flight('k', async () => 1)).resolves.toBe(1);
  });
});

describe('jiraCall', () => {
  afterEach(() => vi.useRealTimers());

  it('turns a hanging Jira call into a named error', async () => {
    vi.useFakeTimers();
    const p = jiraCall('permissions/check', never);
    vi.advanceTimersByTime(JIRA_CALL_BUDGET_MS);
    await expect(p).rejects.toThrow(/Jira did not respond within 8 s \(permissions\/check\)/);
  });
});

describe('withResolverBudget', () => {
  afterEach(() => vi.useRealTimers());

  it('wraps a fast result as ok', async () => {
    const phase: Phase = { at: 'handler' };
    await expect(
      withResolverBudget('[ui] x', phase, Promise.resolve({ a: 1 }), 50),
    ).resolves.toEqual({ ok: true, data: { a: 1 } });
  });

  it('answers with a retryable message instead of a platform timeout', async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const phase: Phase = { at: 'handler' };
    const p = withResolverBudget('[ui] getOverview', phase, never(), 20_000);
    vi.advanceTimersByTime(20_000);
    await expect(p).resolves.toEqual({ ok: false, error: SLOW_MESSAGE, retryable: true });
    expect(warn).toHaveBeenCalledWith(
      '[ui] getOverview over budget',
      expect.objectContaining({ phase: 'handler' }),
    );
    warn.mockRestore();
  });

  it('says setup is still running when migrations are the slow part', async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const phase: Phase = { at: 'setup' };
    const p = withResolverBudget('[ui] getStatus', phase, never(), 1000);
    vi.advanceTimersByTime(1000);
    await expect(p).resolves.toEqual({ ok: false, error: SETUP_MESSAGE, retryable: true });
    warn.mockRestore();
  });

  it('rethrows real errors so the resolver error handling stays the same', async () => {
    const phase: Phase = { at: 'handler' };
    await expect(
      withResolverBudget('[ui] x', phase, Promise.reject(new Error('bad')), 50),
    ).rejects.toThrow('bad');
  });
});
