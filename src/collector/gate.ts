import { backgroundEdition } from '../api/edition';
import { getSettings, kvGet, kvSet, type Settings } from '../db/settings';
import { q } from '../db/sql';
import { effectiveSchedule } from '../domain/edition';
import { isDue } from './schedule';

export const GATE_KEY = 'tick:gate';

/** Force a slow path at least once per day so a stale gate cannot miss forever. */
export const MAX_FAST_PATH_MS = 24 * 3600_000;

const MEMO_TTL_MS = 10 * 60_000;
/** Memo only when the next due is more than an hour away (cross-function invalidation is imperfect). */
const MEMO_MIN_DUE_MS = 3600_000;

export interface TickGate {
  nextDueAt: number | null;
  staleCheckAfter: number | null;
  /** Soonest campaign run (R2); null until campaign runner persists schedules. */
  nextCampaignAt: number | null;
  /** Soonest reminder fan-out (R2); null until reminders are scheduled. */
  nextReminderAt: number | null;
  v: 2;
}

type Schedule = Pick<Settings, 'frequency' | 'hourUtc' | 'weekday'>;

let memo: { gate: TickGate; at: number } | null = null;

export function clearGateMemo(): void {
  memo = null;
}

/** Earliest of snapshot / campaign / reminder dues (ignores nulls). */
export function soonestDue(gate: TickGate): number | null {
  const times = [gate.nextDueAt, gate.nextCampaignAt, gate.nextReminderAt].filter(
    (t): t is number => t !== null,
  );
  if (!times.length) return null;
  return Math.min(...times);
}

export function readGateMemo(now = Date.now()): TickGate | null {
  if (!memo) return null;
  if (now - memo.at > MEMO_TTL_MS) {
    memo = null;
    return null;
  }
  const due = soonestDue(memo.gate);
  if (due === null || due - now <= MEMO_MIN_DUE_MS) return null;
  return memo.gate;
}

export function writeGateMemo(gate: TickGate, now = Date.now()): void {
  memo = { gate, at: now };
}

/** Next UTC ms when a scheduled snapshot becomes due, or null when frequency is off. */
export function nextDueTimestamp(
  s: Schedule,
  lastScheduledStart: number | null,
  now = Date.now(),
): number | null {
  if (s.frequency === 'off') return null;
  const hourStart = Date.UTC(
    new Date(now).getUTCFullYear(),
    new Date(now).getUTCMonth(),
    new Date(now).getUTCDate(),
    new Date(now).getUTCHours(),
  );
  // Probe up to 8 days of hourly windows (weekly + hourUtc).
  for (let i = 0; i < 8 * 24; i++) {
    const hour = hourStart + i * 3600_000;
    // Current hour: use `now` so we do not skip a due window we are already inside.
    const probe = i === 0 ? now : hour + 60_000;
    if (isDue(s, lastScheduledStart, probe)) return hour;
  }
  return now + 7 * 86400_000;
}

export function computeGate(
  settings: Schedule,
  lastScheduledStart: number | null,
  running: { updatedAt: number } | null,
  now = Date.now(),
  extras: { nextCampaignAt?: number | null; nextReminderAt?: number | null } = {},
): TickGate {
  const rawNext = nextDueTimestamp(settings, lastScheduledStart, now);
  // Self-heal: never fast-path for more than 24h without recomputing.
  const nextDueAt =
    rawNext === null ? now + MAX_FAST_PATH_MS : Math.min(rawNext, now + MAX_FAST_PATH_MS);
  const staleCheckAfter = running ? running.updatedAt + 2 * 3600_000 : null;
  return {
    nextDueAt,
    staleCheckAfter,
    nextCampaignAt: extras.nextCampaignAt ?? null,
    nextReminderAt: extras.nextReminderAt ?? null,
    v: 2,
  };
}

export function shouldFastPath(gate: TickGate, now = Date.now()): boolean {
  if (gate.nextDueAt === null || now >= gate.nextDueAt) return false;
  if (gate.staleCheckAfter !== null && now >= gate.staleCheckAfter) return false;
  if (gate.nextCampaignAt !== null && now >= gate.nextCampaignAt) return false;
  if (gate.nextReminderAt !== null && now >= gate.nextReminderAt) return false;
  return true;
}

export function isMissingKvTable(err: unknown): boolean {
  const msg = String((err as Error)?.message ?? err).toLowerCase();
  return (
    msg.includes("doesn't exist") ||
    msg.includes('does not exist') ||
    msg.includes('no such table') ||
    msg.includes('unknown table') ||
    msg.includes('1146')
  );
}

async function lastScheduledStart(): Promise<number | null> {
  const rows = await q<{ started_at: number }>(
    "SELECT MAX(started_at) AS started_at FROM snap WHERE trigger_kind = 'scheduled'",
  );
  return rows[0]?.started_at ? Number(rows[0].started_at) : null;
}

async function runningSnapshot(): Promise<{ updatedAt: number } | null> {
  const rows = await q<{ updated_at: number }>(
    "SELECT updated_at FROM snap WHERE status IN ('queued', 'running') ORDER BY seq DESC LIMIT 1",
  );
  return rows[0] ? { updatedAt: Number(rows[0].updated_at) } : null;
}

/**
 * Optional R2 schedule hooks. Campaign/reminder tables may not exist yet — callers
 * pass null until R2-04 wires real mins.
 */
export async function refreshGate(
  now = Date.now(),
  extras: { nextCampaignAt?: number | null; nextReminderAt?: number | null } = {},
): Promise<TickGate> {
  const settings = effectiveSchedule(await getSettings(), (await backgroundEdition()).features);
  let nextCampaignAt = extras.nextCampaignAt;
  let nextReminderAt = extras.nextReminderAt;
  if (nextCampaignAt === undefined || nextReminderAt === undefined) {
    try {
      const { soonestCampaignRunAt, soonestReminderAt } = await import('./campaignRun');
      if (nextCampaignAt === undefined)
        nextCampaignAt = await soonestCampaignRunAt().catch(() => null);
      if (nextReminderAt === undefined)
        nextReminderAt = await soonestReminderAt(now).catch(() => null);
    } catch {
      nextCampaignAt = nextCampaignAt ?? null;
      nextReminderAt = nextReminderAt ?? null;
    }
  }
  const gate = computeGate(settings, await lastScheduledStart(), await runningSnapshot(), now, {
    nextCampaignAt: nextCampaignAt ?? null,
    nextReminderAt: nextReminderAt ?? null,
  });
  await kvSet(GATE_KEY, gate);
  writeGateMemo(gate, now);
  return gate;
}

/** Invalidate the gate so the next tick takes the slow path (avoids circular imports). */
export async function bumpGate(): Promise<void> {
  clearGateMemo();
  await kvSet(GATE_KEY, {
    nextDueAt: 0,
    staleCheckAfter: null,
    nextCampaignAt: null,
    nextReminderAt: null,
    v: 2,
  });
}

/** One SQL read of the gate row (or null). Accepts legacy v1 rows by filling R2 fields. */
export async function loadGate(): Promise<TickGate | null> {
  const stored = await kvGet<{
    nextDueAt?: number | null;
    staleCheckAfter?: number | null;
    nextCampaignAt?: number | null;
    nextReminderAt?: number | null;
    v?: number;
  }>(GATE_KEY);
  if (!stored || (stored.v !== 1 && stored.v !== 2)) return null;
  return {
    nextDueAt: stored.nextDueAt ?? null,
    staleCheckAfter: stored.staleCheckAfter ?? null,
    nextCampaignAt: stored.nextCampaignAt ?? null,
    nextReminderAt: stored.nextReminderAt ?? null,
    v: 2,
  };
}
