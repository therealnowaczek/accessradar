import { describe, expect, it } from 'vitest';
import {
  addMonthsClamped,
  dueReminderOffsets,
  nextRunAt,
  parseReminderDays,
  reminderTimestamps,
} from '../src/domain/campaignSchedule';

describe('addMonthsClamped', () => {
  it('clamps month-end (31 Jan → 28 Feb 2026)', () => {
    const jan31 = Date.UTC(2026, 0, 31, 12);
    const feb = addMonthsClamped(jan31, 1);
    expect(new Date(feb).getUTCDate()).toBe(28);
    expect(new Date(feb).getUTCMonth()).toBe(1);
  });
});

describe('nextRunAt', () => {
  const start = Date.UTC(2026, 0, 15, 9); // 15 Jan 2026 09:00 UTC

  it('once: returns start when still upcoming, else null after run', () => {
    expect(nextRunAt({ frequency: 'once', startAt: start }, Date.UTC(2026, 0, 1))).toBe(start);
    expect(nextRunAt({ frequency: 'once', startAt: start }, Date.UTC(2026, 2, 1))).toBeNull();
    expect(
      nextRunAt({ frequency: 'once', startAt: start }, Date.UTC(2026, 0, 1), start),
    ).toBeNull();
  });

  it('quarterly: advances by 3 months from start', () => {
    const now = Date.UTC(2026, 0, 15, 10); // after start hour
    const next = nextRunAt({ frequency: 'quarterly', startAt: start }, now, null);
    // start already in the past relative to floor=now → next is Apr 15
    expect(next).toBe(Date.UTC(2026, 3, 15, 9));
  });

  it('quarterly after a run: next period after lastRunAt', () => {
    const last = Date.UTC(2026, 3, 15, 9);
    const next = nextRunAt({ frequency: 'quarterly', startAt: start }, Date.UTC(2026, 3, 16), last);
    expect(next).toBe(Date.UTC(2026, 6, 15, 9));
  });

  it('annual and semiannual step sizes', () => {
    expect(nextRunAt({ frequency: 'annual', startAt: start }, Date.UTC(2026, 0, 16), null)).toBe(
      Date.UTC(2027, 0, 15, 9),
    );
    expect(
      nextRunAt({ frequency: 'semiannual', startAt: start }, Date.UTC(2026, 0, 16), null),
    ).toBe(Date.UTC(2026, 6, 15, 9));
  });
});

describe('reminders', () => {
  it('parses and sorts reminder day offsets descending', () => {
    expect(parseReminderDays('1, 7,3,7')).toEqual([7, 3, 1]);
  });

  it('reminderTimestamps subtracts days from due', () => {
    const due = Date.UTC(2026, 5, 10);
    expect(reminderTimestamps(due, [7, 1])).toEqual([due - 7 * 86400_000, due - 1 * 86400_000]);
  });

  it('dueReminderOffsets respects ±1h skew and issued set', () => {
    const due = Date.UTC(2026, 5, 10, 12);
    const now = due - 3 * 86400_000 + 30 * 60_000; // 3d before, within hour of the 3d mark
    expect(dueReminderOffsets(due, [7, 3, 1], [], now)).toEqual([3]);
    expect(dueReminderOffsets(due, [7, 3, 1], [3], now)).toEqual([]);
  });
});
