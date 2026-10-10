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
  v: 1;
}

type Schedule = Pick<Settings, 'frequency' | 'hourUtc' | 'weekday'>;

let memo: { gate: TickGate; at: number } | null = null;

export function clearGateMemo(): void {
  memo = null;
}

export function readGateMemo(now = Date.now()): TickGate | null {
  if (!memo) return null;
  if (now - memo.at > MEMO_TTL_MS) {
    memo = null;
    return null;
  }
  const due = memo.gate.nextDueAt;
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
): TickGate {
  const rawNext = nextDueTimestamp(settings, lastScheduledStart, now);
  // Self-heal: never fast-path for more than 24h without recomputing.
  const nextDueAt =
    rawNext === null ? now + MAX_FAST_PATH_MS : Math.min(rawNext, now + MAX_FAST_PATH_MS);
  const staleCheckAfter = running ? running.updatedAt + 2 * 3600_000 : null;
  return { nextDueAt, staleCheckAfter, v: 1 };
}

export function shouldFastPath(gate: TickGate, now = Date.now()): boolean {
  if (gate.nextDueAt === null || now >= gate.nextDueAt) return false;
  if (gate.staleCheckAfter !== null && now >= gate.staleCheckAfter) return false;
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

/** Recompute and persist `tick:gate`. Call after settings/edition/snapshot state changes. */
export async function refreshGate(now = Date.now()): Promise<TickGate> {
  const settings = effectiveSchedule(await getSettings(), (await backgroundEdition()).features);
  const gate = computeGate(settings, await lastScheduledStart(), await runningSnapshot(), now);
  await kvSet(GATE_KEY, gate);
  writeGateMemo(gate, now);
  return gate;
}

/** Invalidate the gate so the next tick takes the slow path (avoids circular imports). */
export async function bumpGate(): Promise<void> {
  clearGateMemo();
  await kvSet(GATE_KEY, { nextDueAt: 0, staleCheckAfter: null, v: 1 });
}

/** One SQL read of the gate row (or null). */
export async function loadGate(): Promise<TickGate | null> {
  const stored = await kvGet<TickGate>(GATE_KEY);
  if (!stored || stored.v !== 1) return null;
  return stored;
}
