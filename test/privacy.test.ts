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

  it('redacts unquoted e-mails and Atlassian accountIds', () => {
    expect(redact('user 557058:f58131cb-b67d-43c7-b30d-6b58d40bd077 not found')).toBe(
      'user <id> not found',
    );
    expect(redact('no access for 712020:2c1f5e3a-0d4b-4e8f-9a6c-7b1d2e3f4a5b.')).toBe(
      'no access for <id>.',
    );
    expect(redact('account 5b10ac8d82e05b22cc7d4ef5 is inactive')).toBe('account <id> is inactive');
    expect(redact('Account 5B10AC8D82E05B22CC7D4EF5 closed')).toBe('Account <id> closed');
    expect(redact('mail anna.kowalska+jira@example.co.uk bounced')).toBe('mail <email> bounced');
    expect(redact('a@b.io,5b10ac8d82e05b22cc7d4ef5')).toBe('<email>,<id>');
  });

  it('keeps UUIDs, hashes and other identifiers that are logged on purpose', () => {
    const uuid = '3f2b8c1e-9a4d-4e7f-b2c6-1d0e9f8a7b6c';
    const sha256 = 'a'.repeat(8) + '0123456789abcdef'.repeat(3) + 'b'.repeat(8);
    for (const text of [
      `verify job ${uuid} failed`,
      `hash ${sha256} mismatch`,
      'hash 0123456789ab mismatch',
      'Jira did not respond within 8 s (permissions/check)',
      'HTTP 403',
      'snapshot 42 step FINALIZE batch 3',
    ])
      expect(redact(text)).toBe(text);
  });

  it('redacts only the message, not structured context fields', () => {
    const jobId = '3f2b8c1e-9a4d-4e7f-b2c6-1d0e9f8a7b6c';
    const e = new Error('lookup for 557058:f58131cb-b67d-43c7-b30d-6b58d40bd077 / x@y.com failed');
    const logged = { step: 'VERIFY_SNAPSHOT', jobId, ...errInfo(e) };
    expect(logged).toEqual({
      step: 'VERIFY_SNAPSHOT',
      jobId,
      message: 'lookup for <id> / <email> failed',
    });
    expect(JSON.stringify(logged)).not.toMatch(/557058|x@y\.com/);
  });
});
