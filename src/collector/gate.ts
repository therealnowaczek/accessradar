import { backgroundEdition } from '../api/edition';
import { getSettings, kvGet, kvSet, type Settings } from '../db/settings';
import { latestCommitted } from '../db/snapshots';
import { q } from '../db/sql';
import { effectiveSchedule, type Edition } from '../domain/edition';
import { isDue, type SnapshotFrequency } from './schedule';

/** Standard sites at or under this many active human accounts use the internal biweekly schedule. */
export const FREE_TIER_USER_CAP = 10;

/** Shown in Settings. Not a selectable frequency. */
export const FREE_TIER_SCHEDULE_COPY = 'Free plan: every two weeks; manual snapshots any time';

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

type Schedule = {
  frequency: SnapshotFrequency;
  hourUtc: number;
  weekday: number;
};

/** `stats_json.activeHumans` from the latest snapshot, or null when that snapshot predates the field. */
export function activeHumansFromStats(
  stats: Record<string, number> | null | undefined,
): number | null {
  const n = stats?.activeHumans;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/** Standard and ≤10 active humans. Unknown counts stay on the normal Standard schedule. */
export function isFreeTier(edition: Edition, activeHumans: number | null): boolean {
  return edition === 'standard' && activeHumans !== null && activeHumans <= FREE_TIER_USER_CAP;
}

/**
 * Internal schedule. Free tier becomes biweekly and is not stored or user-selectable.
 * `off` stays off so manual-only sites are unchanged.
 */
export function applyFreeTierFrequency<
  T extends { frequency: 'off' | 'daily' | 'weekly'; hourUtc: number; weekday: number },
>(
  settings: T,
  edition: Edition,
  activeHumans: number | null,
): T & { frequency: SnapshotFrequency } {
  if (settings.frequency !== 'off' && isFreeTier(edition, activeHumans)) {
    return { ...settings, frequency: 'biweekly' };
  }
  return settings;
}

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
  const spanDays = s.frequency === 'biweekly' ? 16 : 8;
  const hourStart = Date.UTC(
    new Date(now).getUTCFullYear(),
    new Date(now).getUTCMonth(),
    new Date(now).getUTCDate(),
    new Date(now).getUTCHours(),
  );
  // Probe enough hourly windows to reach the next weekly or biweekly slot.
  for (let i = 0; i < spanDays * 24; i++) {
    const hour = hourStart + i * 3600_000;
    // Current hour: use `now` so we do not skip a due window we are already inside.
    const probe = i === 0 ? now : hour + 60_000;
    if (isDue(s, lastScheduledStart, probe)) return hour;
  }
  return now + (s.frequency === 'biweekly' ? 14 : 7) * 86400_000;
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

/** Edition-adjusted settings, then the free-tier biweekly override from the latest snapshot. */
export async function scheduledSettings(): Promise<Schedule & Pick<Settings, 'retentionDays'>> {
  const edition = await backgroundEdition();
  const settings = effectiveSchedule(await getSettings(), edition.features);
  const snap = await latestCommitted();
  return applyFreeTierFrequency(settings, edition.edition, activeHumansFromStats(snap?.stats));
}

export async function refreshGate(
  now = Date.now(),
  extras: { nextCampaignAt?: number | null; nextReminderAt?: number | null } = {},
): Promise<TickGate> {
  const settings = await scheduledSettings();
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
