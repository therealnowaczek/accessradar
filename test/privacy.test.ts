import { describe, expect, it, vi } from 'vitest';

vi.mock('@forge/api', () => ({
  privacy: { reportPersonalData: vi.fn() },
  default: {},
  route: vi.fn(),
}));
vi.mock('@forge/sql', () => ({ sql: {}, migrationRunner: { enqueue: vi.fn() } }));

const { dueAccounts, pseudonym, REPORT_CYCLE_MS } = await import('../src/privacy');
const { errInfo, redact } = await import('../src/lib/errors');

describe('personal-data reporting', () => {
  const now = Date.UTC(2026, 9, 9);
  const accounts = new Map([
    ['new', now],
    ['recent', now],
    ['old', now],
    ['closed', now],
  ]);
  const state = new Map([
    ['recent', { lastReported: now - REPORT_CYCLE_MS + 1000, closed: false }],
    ['old', { lastReported: now - REPORT_CYCLE_MS, closed: false }],
    ['closed', { lastReported: now - 30 * REPORT_CYCLE_MS, closed: true }],
  ]);

  it('reports each account at most once per 7-day cycle and never re-reports closed accounts', () => {
    expect(REPORT_CYCLE_MS).toBe(7 * 24 * 3600_000);
    expect(dueAccounts(accounts, state, now).map(([id]) => id)).toEqual(['new', 'old']);
  });

  it('uses a stable pseudonym that does not reveal the accountId', () => {
    expect(pseudonym('5b10ac8d82e05b22cc7d4ef5')).toBe(pseudonym('5b10ac8d82e05b22cc7d4ef5'));
    expect(pseudonym('5b10ac8d82e05b22cc7d4ef5')).toMatch(/^Closed account [0-9a-f]{8}$/);
    expect(pseudonym('5b10ac8d82e05b22cc7d4ef5')).not.toContain('5b10');
  });
});

describe('error logging', () => {
  it('redacts quoted values that may hold personal data', () => {
    expect(redact("Duplicate entry '5b10ac8d' for key 'PRIMARY'")).toBe(
      "Duplicate entry '?' for key '?'",
    );
    expect(redact('group “Anna Kowalska team” missing')).toBe('group “?” missing');
    const e = Object.assign(new Error('Unknown column "x"'), {
      code: 'SQL_ERR',
      suggestion: "check 'y'",
    });
    expect(errInfo(e)).toEqual({
      message: 'Unknown column "?"',
      code: 'SQL_ERR',
      suggestion: "check '?'",
    });
  });
});
