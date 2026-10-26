/**
 * Weekly access digest (Standard and Advanced). One in-app summary of the access changes over the
 * last 7 days, built from the diff between the newest committed snapshot and the snapshot that was
 * current at the start of the week. It uses the same change rules as the Advanced change alerts
 * (all rules on, not configurable); real-time alerts and alert rules stay Advanced.
 * Delivery is in-app only: no email, no egress.
 */
import { ALERT_RULES, DEFAULT_ALERT_RULES, evaluateAlerts, type AlertRule } from './alerts';
import { resolveAll, type EffectiveAccess } from './resolve';
import type { AccessState } from './state';

export const DIGEST_WINDOW_MS = 7 * 24 * 3600_000;
/** Items kept in the stored digest; counts always cover every change. */
export const DIGEST_ITEM_CAP = 50;
export const DIGEST_KV_KEY = 'digest:weekly';

export interface DigestSnapshotRef {
  seq: number;
  startedAt: number;
}

export interface DigestItem {
  rule: AlertRule;
  severity: 'high' | 'medium';
  title: string;
  body: string;
}

export type DigestStatus = 'ready' | 'no-snapshot' | 'no-baseline';

export interface WeeklyDigest {
  version: 1;
  status: DigestStatus;
  generatedAt: number;
  periodStart: number;
  periodEnd: number;
  /** Snapshot compared from (current at the start of the week, or the oldest one available). */
  base: DigestSnapshotRef | null;
  /** Newest committed snapshot. */
  head: DigestSnapshotRef | null;
  /** True when no snapshot existed at the start of the week, so the digest covers less than 7 days. */
  partialWeek: boolean;
  total: number;
  counts: Record<AlertRule, number>;
  items: DigestItem[];
  /** Changes counted but not listed in `items` (cap). */
  omitted: number;
}

export function emptyCounts(): Record<AlertRule, number> {
  return Object.fromEntries(ALERT_RULES.map((r) => [r, 0])) as Record<AlertRule, number>;
}

/**
 * Chooses the snapshots to compare. `committed` must contain only committed snapshots (complete
 * or partial), any order. The base is the newest snapshot taken at or before the start of the
 * window; when none exists yet, the oldest older snapshot is used and the digest is a partial week.
 */
export function pickDigestSnapshots(
  committed: DigestSnapshotRef[],
  now: number,
): { head: DigestSnapshotRef | null; base: DigestSnapshotRef | null; partialWeek: boolean } {
  const sorted = [...committed].sort((a, b) => b.seq - a.seq);
  const head = sorted[0] ?? null;
  if (!head) return { head: null, base: null, partialWeek: false };
  const older = sorted.slice(1);
  if (!older.length) return { head, base: null, partialWeek: false };
  const start = now - DIGEST_WINDOW_MS;
  const atStart = older.find((s) => s.startedAt <= start);
  if (atStart) return { head, base: atStart, partialWeek: false };
  return { head, base: older[older.length - 1], partialWeek: true };
}

export function emptyDigest(
  status: DigestStatus,
  now: number,
  head: DigestSnapshotRef | null = null,
): WeeklyDigest {
  return {
    version: 1,
    status,
    generatedAt: now,
    periodStart: now - DIGEST_WINDOW_MS,
    periodEnd: now,
    base: null,
    head,
    partialWeek: false,
    total: 0,
    counts: emptyCounts(),
    items: [],
    omitted: 0,
  };
}

/** Builds a ready digest from the base and head states. Pure. */
export function buildWeeklyDigest(
  prev: AccessState,
  next: AccessState,
  refs: { base: DigestSnapshotRef; head: DigestSnapshotRef; partialWeek: boolean },
  now: number,
  cap = DIGEST_ITEM_CAP,
  entries?: { prev?: EffectiveAccess[]; next?: EffectiveAccess[] },
): WeeklyDigest {
  const changes = evaluateAlerts(
    prev,
    next,
    { ...DEFAULT_ALERT_RULES },
    entries?.next ?? resolveAll(next),
    entries?.prev ?? resolveAll(prev),
  );
  const counts = emptyCounts();
  for (const c of changes) counts[c.rule] += 1;
  const order = (s: 'high' | 'medium') => (s === 'high' ? 0 : 1);
  const sorted = changes
    .map((c, i) => ({ c, i }))
    .sort((a, b) => order(a.c.severity) - order(b.c.severity) || a.i - b.i)
    .map(({ c }) => ({ rule: c.rule, severity: c.severity, title: c.title, body: c.body }));
  return {
    version: 1,
    status: 'ready',
    generatedAt: now,
    periodStart: refs.partialWeek ? refs.base.startedAt : now - DIGEST_WINDOW_MS,
    periodEnd: now,
    base: refs.base,
    head: refs.head,
    partialWeek: refs.partialWeek,
    total: changes.length,
    counts,
    items: sorted.slice(0, cap),
    omitted: Math.max(0, sorted.length - cap),
  };
}
