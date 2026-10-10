/** Pure campaign schedule helpers (next run + reminder offsets). No I/O. */

export type CampaignFrequency = 'quarterly' | 'semiannual' | 'annual' | 'once';

export interface CampaignScheduleInput {
  frequency: CampaignFrequency;
  /** Campaign start (UTC epoch ms); first run is on/after this instant. */
  startAt: number;
}

const MONTHS: Record<Exclude<CampaignFrequency, 'once'>, number> = {
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

/** Clamp day-of-month into the target month (e.g. Jan 31 → Feb 28/29). */
export function addMonthsClamped(utcMs: number, months: number): number {
  const d = new Date(utcMs);
  const day = d.getUTCDate();
  const target = new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth() + months,
      1,
      d.getUTCHours(),
      d.getUTCMinutes(),
      d.getUTCSeconds(),
      d.getUTCMilliseconds(),
    ),
  );
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.getTime();
}

/**
 * Next run at or after `now`. For `once`, returns `startAt` if still in the future, else null.
 * Recurring: walk from startAt by frequency until > lastRunAt (or >= now when never run).
 */
export function nextRunAt(
  campaign: CampaignScheduleInput,
  now: number,
  lastRunAt: number | null = null,
): number | null {
  if (campaign.frequency === 'once') {
    if (lastRunAt !== null) return null;
    return campaign.startAt >= now ? campaign.startAt : null;
  }
  const step = MONTHS[campaign.frequency];
  let t = campaign.startAt;
  // Fast-forward past completed runs / the past.
  const floor = lastRunAt !== null ? lastRunAt + 1 : now;
  // Bound iterations (100 years of monthly steps).
  for (let i = 0; i < 1200 && t < floor; i++) t = addMonthsClamped(t, step);
  if (t < floor) return null;
  return t;
}

/** Parse "7,3,1" style reminder offsets (days before due). */
export function parseReminderDays(raw: string): number[] {
  return [
    ...new Set(
      raw
        .split(/[,\s]+/)
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n >= 0 && n <= 366),
    ),
  ].sort((a, b) => b - a);
}

/** Reminder fire times (UTC ms) for offsets before dueAt, plus overdue daily markers are handled by the runner. */
export function reminderTimestamps(dueAt: number, reminderDays: number[]): number[] {
  return reminderDays.map((d) => dueAt - d * 86400_000).filter((t) => Number.isFinite(t));
}

/** Which reminder offsets are due in [now - skew, now + skew] and not yet issued. */
export function dueReminderOffsets(
  dueAt: number,
  reminderDays: number[],
  issuedOffsets: number[],
  now: number,
  skewMs = 3600_000,
): number[] {
  const issued = new Set(issuedOffsets);
  return reminderDays.filter((d) => {
    if (issued.has(d)) return false;
    const at = dueAt - d * 86400_000;
    return Math.abs(at - now) <= skewMs || (d === 0 && now >= dueAt && now - dueAt <= skewMs);
  });
}
