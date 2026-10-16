export type SnapshotFrequency = 'off' | 'daily' | 'weekly' | 'biweekly';

/** Is a scheduled snapshot due now? Pure, tested. */
export function isDue(
  s: { frequency: SnapshotFrequency; hourUtc: number; weekday: number },
  lastScheduledStart: number | null,
  now = Date.now(),
): boolean {
  if (s.frequency === 'off') return false;
  const d = new Date(now);
  if (d.getUTCHours() !== s.hourUtc) return false;
  const isoWeekday = ((d.getUTCDay() + 6) % 7) + 1;
  if ((s.frequency === 'weekly' || s.frequency === 'biweekly') && isoWeekday !== s.weekday)
    return false;
  // Already ran in this window (the hourly tick may fire more than once).
  const days = s.frequency === 'daily' ? 1 : s.frequency === 'biweekly' ? 14 : 7;
  const minGap = days * 86400_000 - 2 * 3600_000;
  return lastScheduledStart === null || now - lastScheduledStart >= minGap;
}
