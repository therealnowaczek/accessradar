/** Is a scheduled snapshot due now? Pure, tested. */
export function isDue(
  s: { frequency: 'off' | 'daily' | 'weekly'; hourUtc: number; weekday: number },
  lastScheduledStart: number | null,
  now = Date.now(),
): boolean {
  if (s.frequency === 'off') return false;
  const d = new Date(now);
  if (d.getUTCHours() !== s.hourUtc) return false;
  const isoWeekday = ((d.getUTCDay() + 6) % 7) + 1;
  if (s.frequency === 'weekly' && isoWeekday !== s.weekday) return false;
  // Already ran in this window (the hourly tick may fire more than once).
  const minGap = (s.frequency === 'daily' ? 1 : 7) * 86400_000 - 2 * 3600_000;
  return lastScheduledStart === null || now - lastScheduledStart >= minGap;
}
