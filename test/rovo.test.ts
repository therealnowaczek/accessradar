import { describe, expect, it } from 'vitest';
import { _test } from '../src/rovo/actions';
import type { AccessState } from '../src/engine/state';

describe('rovo helpers', () => {
  it('truncates to 50 rows with a note', () => {
    const rows = Array.from({ length: 60 }, (_, i) => ({ i }));
    const t = _test.truncate(rows);
    expect(t.rows).toHaveLength(_test.MAX_ROWS);
    expect(t.note).toMatch(/first 50 of 60/);
  });

  it('resolves project by key (case-insensitive)', () => {
    const state = {
      projects: new Map([
        ['10001', { key: 'PAY', name: 'Payments', style: 'company', schemeId: null }],
      ]),
    } as unknown as AccessState;
    expect(_test.findProjectId(state, 'pay')).toBe('10001');
    expect(_test.findProjectId(state, 'NOPE')).toBeNull();
  });

  it('resolves person by accountId or display name', () => {
    const state = {
      persons: new Map([
        ['acc-1', { displayName: 'Dana Kowal', active: true, accountType: 'atlassian' }],
      ]),
      memberOf: new Map(),
    } as unknown as AccessState;
    expect(_test.findAccountId(state, 'acc-1')).toBe('acc-1');
    expect(_test.findAccountId(state, 'Dana Kowal')).toBe('acc-1');
    expect(_test.findAccountId(state, 'Unknown')).toBeNull();
  });
});
