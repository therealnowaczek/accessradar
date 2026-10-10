import type { ReviewItemDraft } from './review';

export interface ExceptionRow {
  id: string;
  itemKey: string;
  subjectType: string;
  subjectId: string;
  projectId: string | null;
  groupId: string | null;
  permissions: string[];
  justification: string;
  expiresAt: number;
  status: 'active' | 'expired' | 'superseded' | 'revoked';
  reviewId: string;
  grantedBy: string;
  grantedAt: number;
}

export type ReviewItemWithException = ReviewItemDraft & {
  decision?: 'exception' | null;
  note?: string | null;
  expiresAt?: number | null;
  exceptionBadge?: 'active' | 'expired';
  decidedBy?: string | null;
};

const MIN_NOTE = 10;
const MIN_DAYS = 1;
const MAX_DAYS = 366;

/** End of calendar day (23:59:59.999) in `tz` for a YYYY-MM-DD (or epoch ms) date, as UTC epoch ms. */
export function expiryEndOfDay(expiresAt: number | string, tz: string): number {
  let y: number;
  let m: number;
  let d: number;
  if (typeof expiresAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(expiresAt)) {
    [y, m, d] = expiresAt.split('-').map(Number);
  } else {
    const n = Number(expiresAt);
    if (!Number.isFinite(n)) throw new Error('Invalid expiry date');
    // Interpret the calendar date of this instant in the signer TZ.
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(n));
    y = Number(parts.find((p) => p.type === 'year')?.value);
    m = Number(parts.find((p) => p.type === 'month')?.value);
    d = Number(parts.find((p) => p.type === 'day')?.value);
  }
  // Binary search UTC ms whose TZ calendar day is y-m-d and pick end of that day.
  const startGuess = Date.UTC(y, m - 1, d, 12, 0, 0);
  let lo = startGuess - 36 * 3600_000;
  let hi = startGuess + 36 * 3600_000;
  const dayKey = (ms: number) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(ms));
  const want = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  // Find any ms on that local day, then walk to last ms still on that day.
  let mid = startGuess;
  for (let i = 0; i < 40; i++) {
    mid = Math.floor((lo + hi) / 2);
    const key = dayKey(mid);
    if (key < want) lo = mid + 1;
    else if (key > want) hi = mid - 1;
    else break;
  }
  if (dayKey(mid) !== want) {
    // Fallback: UTC end of day (tests cover common zones explicitly).
    return Date.UTC(y, m - 1, d, 23, 59, 59, 999);
  }
  // Binary-search the last ms still on that local calendar day.
  let loEnd = mid;
  let hiEnd = mid + 36 * 3600_000;
  while (loEnd < hiEnd) {
    const probe = Math.floor((loEnd + hiEnd + 1) / 2);
    if (dayKey(probe) === want) loEnd = probe;
    else hiEnd = probe - 1;
  }
  return loEnd;
}

export function validateDecisionInput(input: {
  decision: 'keep' | 'revoke' | 'exception' | null;
  note?: string | null;
  expiresAt?: number | string | null;
  requireKeepNote?: boolean;
  tz?: string;
  now?: number;
}): { note: string | null; expiresAt: number | null } {
  const now = input.now ?? Date.now();
  const note = (input.note ?? '').trim();
  if (input.decision === 'revoke' || input.decision === 'exception') {
    if (note.length < MIN_NOTE) {
      throw new Error('Add a justification (at least 10 characters)');
    }
  }
  if (input.decision === 'keep' && input.requireKeepNote && note.length < MIN_NOTE) {
    throw new Error('Add a justification (at least 10 characters)');
  }
  if (input.decision !== 'exception') {
    return { note: note || null, expiresAt: null };
  }
  if (input.expiresAt === undefined || input.expiresAt === null || input.expiresAt === '') {
    throw new Error('Exception expiry date is required');
  }
  const end = expiryEndOfDay(input.expiresAt, input.tz || 'UTC');
  const min = now + MIN_DAYS * 86400_000;
  const max = now + MAX_DAYS * 86400_000;
  if (end <= now || end < min) throw new Error('Exception expiry must be at least 1 day in the future');
  if (end > max) throw new Error('Exception expiry cannot be more than 366 days away');
  return { note, expiresAt: end };
}

/** Prefill active exceptions; flag expired ones with risk ≥ 65. */
export function applyExceptions(
  items: ReviewItemDraft[],
  exceptions: ExceptionRow[],
  now = Date.now(),
): ReviewItemWithException[] {
  const byKey = new Map<string, ExceptionRow>();
  for (const e of exceptions) {
    if (e.status !== 'active' && e.status !== 'expired') continue;
    const prev = byKey.get(e.itemKey);
    if (!prev || e.grantedAt > prev.grantedAt) byKey.set(e.itemKey, e);
  }
  return items.map((item) => {
    const exc = byKey.get(item.itemKey);
    if (!exc) return { ...item };
    if (exc.expiresAt > now && exc.status === 'active') {
      return {
        ...item,
        decision: 'exception',
        note: exc.justification,
        expiresAt: exc.expiresAt,
        exceptionBadge: 'active',
        decidedBy: exc.grantedBy,
      };
    }
    const reasons = item.reasons.includes('Exception expired')
      ? item.reasons
      : ['Exception expired', ...item.reasons];
    return {
      ...item,
      risk: Math.max(item.risk, 65),
      exceptionBadge: 'expired',
      reasons,
    };
  });
}
