import { describe, expect, it } from 'vitest';
import {
  applyExceptions,
  expiryEndOfDay,
  validateDecisionInput,
  type ExceptionRow,
} from '../src/engine/exceptions';
import type { ReviewItemDraft } from '../src/engine/review';

const baseItem = (over: Partial<ReviewItemDraft> = {}): ReviewItemDraft => ({
  itemKey: 'p|1|user:u1',
  subjectType: 'user',
  subjectId: 'u1',
  projectId: '1',
  groupId: null,
  permissions: ['BROWSE_PROJECTS'],
  reasons: ['scheme'],
  pathCodes: ['scheme:s'],
  change: null,
  risk: 10,
  ...over,
});

const exc = (over: Partial<ExceptionRow> = {}): ExceptionRow => ({
  id: 'e1',
  itemKey: 'p|1|user:u1',
  subjectType: 'user',
  subjectId: 'u1',
  projectId: '1',
  groupId: null,
  permissions: ['BROWSE_PROJECTS'],
  justification: 'Business need documented',
  expiresAt: Date.now() + 30 * 86400_000,
  status: 'active',
  reviewId: 'r1',
  grantedBy: 'admin',
  grantedAt: Date.now() - 86400_000,
  ...over,
});

describe('validateDecisionInput', () => {
  const now = Date.UTC(2026, 9, 10, 12);

  it('requires ≥10 char note for revoke and exception', () => {
    expect(() => validateDecisionInput({ decision: 'revoke', note: 'short', now })).toThrow(
      /at least 10/,
    );
    expect(() =>
      validateDecisionInput({ decision: 'exception', note: 'long enough!!', expiresAt: null, now }),
    ).toThrow(/expir/);
  });

  it('rejects expiry in the past or beyond 366 days', () => {
    expect(() =>
      validateDecisionInput({
        decision: 'exception',
        note: 'long enough!!',
        expiresAt: '2026-10-10',
        tz: 'UTC',
        now,
      }),
    ).toThrow(/1 day/);
    expect(() =>
      validateDecisionInput({
        decision: 'exception',
        note: 'long enough!!',
        expiresAt: '2028-01-01',
        tz: 'UTC',
        now,
      }),
    ).toThrow(/366/);
  });

  it('accepts keep without note unless requireKeepNote', () => {
    expect(validateDecisionInput({ decision: 'keep', note: '', now }).note).toBeNull();
    expect(() =>
      validateDecisionInput({ decision: 'keep', note: 'x', requireKeepNote: true, now }),
    ).toThrow(/at least 10/);
  });

  it('stores end-of-day in signer TZ for Europe/Warsaw and Pacific/Auckland', () => {
    const warsaw = expiryEndOfDay('2026-10-20', 'Europe/Warsaw', now);
    expect(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Warsaw',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
      }).format(new Date(warsaw)),
    ).toMatch(/2026-10-20/);
    // Last ms of that local day: hour should be 23
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Warsaw',
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(warsaw));
    expect(parts.find((p) => p.type === 'hour')?.value).toBe('23');

    const auckland = expiryEndOfDay('2026-10-20', 'Pacific/Auckland', now);
    const aDay = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Pacific/Auckland',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(auckland));
    expect(aDay).toBe('2026-10-20');
  });
});

describe('applyExceptions', () => {
  it('prefills active exceptions and flags expired with risk ≥ 65', () => {
    const now = Date.UTC(2026, 9, 10);
    const items = [
      baseItem(),
      baseItem({ itemKey: 'p|2|user:u2', subjectId: 'u2', projectId: '2' }),
    ];
    const out = applyExceptions(
      items,
      [
        exc({ expiresAt: now + 10 * 86400_000 }),
        exc({
          itemKey: 'p|2|user:u2',
          status: 'expired',
          expiresAt: now - 86400_000,
          justification: 'Old exception',
        }),
      ],
      now,
    );
    expect(out[0].decision).toBe('exception');
    expect(out[0].exceptionBadge).toBe('active');
    expect(out[0].note).toMatch(/Business/);
    expect(out[1].exceptionBadge).toBe('expired');
    expect(out[1].risk).toBeGreaterThanOrEqual(65);
    expect(out[1].decision).toBeUndefined();
  });

  it('ignores superseded rows and items no longer present', () => {
    const now = Date.now();
    const out = applyExceptions(
      [baseItem()],
      [exc({ status: 'superseded' }), exc({ itemKey: 'gone', status: 'active' })],
      now,
    );
    expect(out[0].decision).toBeUndefined();
  });
});
