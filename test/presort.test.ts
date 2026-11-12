import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReviewItemRow } from '../src/db/reviews';
import {
  PRESORT_MAX_ITEMS,
  parsePresort,
  presortCandidates,
  presortMessages,
  riskClass,
  viaOf,
} from '../src/domain/presort';

const item = (idx: number, over: Partial<ReviewItemRow> = {}): ReviewItemRow => ({
  idx,
  itemKey: `p|10001|user:acct-${idx}`,
  subjectType: 'user',
  subjectId: `712020:secret-account-${idx}`,
  projectId: '10001',
  groupId: null,
  permissions: ['ADMINISTER_PROJECTS', 'DELETE_ISSUES'],
  reasons: [`group “contractors” → role “Developers” → scheme “Payments scheme”`],
  pathCodes: ['group:g1>role:10002>scheme:5#1'],
  change: null,
  risk: 10,
  decision: null,
  note: 'call Alice Example at alice@example.com',
  expiresAt: null,
  decidedBy: null,
  decidedAt: null,
  ackFp: null,
  ...over,
});

describe('presort minimisation', () => {
  it('sends only pseudonym, type, via, risk class and flags; never names, ids, keys, permissions or notes', () => {
    const { records } = presortCandidates([item(3), item(4, { risk: 70, change: 'new' })]);
    const wire = JSON.stringify(presortMessages(records));
    for (const secret of [
      'secret-account',
      'acct-',
      'alice',
      'Alice',
      'example.com',
      '10001',
      'ADMINISTER_PROJECTS',
      'DELETE_ISSUES',
      'Payments scheme',
      'scheme',
    ])
      expect(wire).not.toContain(secret);
    expect(records[0]).toEqual({
      id: 'r4',
      type: 'user',
      via: ['group “contractors”', 'role “Developers”'],
      riskClass: 'deactivated-account',
      deactivated: true,
      isNew: true,
    });
    expect(Object.keys(records[1]).sort()).toEqual(
      ['deactivated', 'id', 'isNew', 'riskClass', 'type', 'via'].sort(),
    );
  });

  it('has no activity vocabulary in the prompt beyond forbidding it', () => {
    const wire = JSON.stringify(presortMessages(presortCandidates([item(1)]).records));
    expect(wire).not.toMatch(/last.?(login|active|seen)|days since/i);
    expect(wire).not.toContain('—');
  });

  it('skips decided and removed items, orders by risk, and caps the batch', () => {
    const many = Array.from({ length: PRESORT_MAX_ITEMS + 30 }, (_, i) =>
      item(i, { risk: i % 100 }),
    );
    many.push(item(900, { decision: 'keep' }), item(901, { change: 'removed' }));
    const { records, total } = presortCandidates(many);
    expect(records).toHaveLength(PRESORT_MAX_ITEMS);
    expect(total).toBe(PRESORT_MAX_ITEMS + 30);
    expect(records.some((r) => r.id === 'r900' || r.id === 'r901')).toBe(false);
    expect(records[0].riskClass).toBe('group-or-unresolved');
  });

  it('buckets the existing risk score', () => {
    expect(riskClass(100)).toBe('anonymous');
    expect(riskClass(80)).toBe('group-or-unresolved');
    expect(riskClass(70)).toBe('deactivated-account');
    expect(riskClass(50)).toBe('space-admin');
    expect(riskClass(10)).toBe('standard');
  });

  it('keeps only how access is granted and strips control characters', () => {
    expect(viaOf(['named user', 'space lead → scheme “x”', 'role “A\nB”'])).toEqual([
      'named user',
      'space lead',
      'role “A B”',
    ]);
  });
});

describe('presort reply validation', () => {
  const allowed = new Set(['r1', 'r2']);
  it('accepts a clean reply and ignores unknown ids, bad priorities and duplicates', () => {
    const m = parsePresort(
      'Here you go:\n[{"id":"r1","priority":"high","reason":"Deactivated account with access"},{"id":"r9","priority":"high","reason":"x"},{"id":"r2","priority":"urgent","reason":"x"},{"id":"r1","priority":"low","reason":"dup"}]',
      allowed,
    );
    expect([...m.keys()]).toEqual([1]);
    expect(m.get(1)).toEqual({ priority: 'high', reason: 'Deactivated account with access' });
  });

  it('clips long reasons, strips dashes and control characters', () => {
    const m = parsePresort(
      JSON.stringify([{ id: 'r2', priority: 'low', reason: `a — b\u0007${'x'.repeat(300)}` }]),
      allowed,
    );
    const r = m.get(2)!.reason;
    expect(r.length).toBeLessThanOrEqual(140);
    expect(r).not.toMatch(/[–—]/);
    expect(r.includes(String.fromCharCode(7))).toBe(false);
  });

  it('rejects replies without usable suggestions', () => {
    expect(() => parsePresort('no json', allowed)).toThrow();
    expect(() => parsePresort('[{"id":"zzz","priority":"high","reason":"x"}]', allowed)).toThrow();
    expect(() => parsePresort('{"id":"r1"}', allowed)).toThrow();
  });
});

const m = vi.hoisted(() => ({ getItems: vi.fn(), loadReview: vi.fn() }));
vi.mock('@forge/api', () => ({ default: {}, route: () => '', getAppContext: () => ({}) }));
vi.mock('@forge/llm', () => ({ chat: vi.fn(), list: vi.fn() }));
vi.mock('../src/db/sql', () => ({
  q: vi.fn(async () => []),
  exec: vi.fn(),
  limitClause: () => '',
}));
vi.mock('../src/db/reviews', async (orig) => ({
  ...(await orig<typeof import('../src/db/reviews')>()),
  getItems: m.getItems,
  getReview: m.loadReview,
}));
vi.mock('../src/db/audit', async (orig) => ({
  ...(await orig<typeof import('../src/db/audit')>()),
  audit: vi.fn(),
}));

import { BadRequest, reviewPresort } from '../src/api/service';
import { featureFlags } from '../src/domain/edition';

const advanced = {
  edition: 'advanced',
  source: 'license',
  features: featureFlags('advanced'),
  override: null,
  canOverride: false,
} as never;
const standard = {
  ...(advanced as object),
  edition: 'standard',
  features: featureFlags('standard'),
} as never;
const ID = '11111111-1111-1111-1111-111111111111';

describe('reviewPresort service', () => {
  beforeEach(() => {
    m.loadReview.mockReset().mockResolvedValue({ id: ID, status: 'draft' });
    m.getItems.mockReset().mockResolvedValue([item(1), item(2, { risk: 70 })]);
  });

  it('is Advanced only and never calls the model on Standard', async () => {
    const ask = vi.fn();
    await expect(reviewPresort({ id: ID }, 'acc', standard, ask)).rejects.toBeInstanceOf(
      BadRequest,
    );
    expect(ask).not.toHaveBeenCalled();
  });

  it('returns validated advice and sends only minimised records', async () => {
    const ask = vi.fn(async () => ({
      model: 'm',
      text: '[{"id":"r2","priority":"high","reason":"Deactivated account"},{"id":"r1","priority":"low","reason":"Via a group"}]',
    }));
    const r = await reviewPresort({ id: ID }, 'acc', advanced, ask);
    expect(r.suggestions).toEqual({
      2: { priority: 'high', reason: 'Deactivated account' },
      1: { priority: 'low', reason: 'Via a group' },
    });
    expect(JSON.stringify(ask.mock.calls[0])).not.toContain('secret-account');
  });

  it('turns model failures and bad replies into a clear error, and refuses signed or fully decided reviews', async () => {
    await expect(
      reviewPresort({ id: ID }, 'acc', advanced, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow(/not available/);
    await expect(
      reviewPresort({ id: ID }, 'acc', advanced, async () => ({ model: 'm', text: 'nope' })),
    ).rejects.toThrow(/expected format/);
    m.loadReview.mockResolvedValue({ id: ID, status: 'signed' });
    await expect(reviewPresort({ id: ID }, 'acc', advanced, vi.fn())).rejects.toThrow(/signed/);
    m.loadReview.mockResolvedValue({ id: ID, status: 'draft' });
    m.getItems.mockResolvedValue([item(1, { decision: 'keep' })]);
    await expect(reviewPresort({ id: ID }, 'acc', advanced, vi.fn())).rejects.toThrow(/decision/);
  });
});
