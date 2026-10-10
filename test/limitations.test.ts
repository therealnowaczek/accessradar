import { describe, expect, it } from 'vitest';
import {
  LIMITATIONS_VERSION,
  LIMITATION_STATEMENTS,
  completenessOf,
  coverageCsvPrefix,
  limitationsPayload,
} from '../src/domain/limitations';

describe('limitations', () => {
  it('versions the static statement list', () => {
    expect(LIMITATIONS_VERSION).toBe(1);
    expect(LIMITATION_STATEMENTS.length).toBeGreaterThanOrEqual(5);
  });

  it('marks complete vs partial from gaps (same gap count as snapshotSummary)', () => {
    const coverage = [
      { area: 'a', target: 'all', status: 'info', reason: 'ok' },
      { area: 'b', target: 'x', status: 'unreadable', reason: 'denied, with "quotes"' },
    ];
    expect(completenessOf('complete', coverage)).toEqual({ completeness: 'partial', gapCount: 1 });
    expect(limitationsPayload('partial', coverage).label).toBe('partial (1 gap)');
    expect(completenessOf('complete', [{ ...coverage[0] }])).toEqual({
      completeness: 'complete',
      gapCount: 0,
    });
    expect(completenessOf('failed', []).completeness).toBe('failed');
  });

  it('escapes commas and quotes in coverage CSV prefix rows', () => {
    const rows = coverageCsvPrefix([
      { area: 'groups', target: 'g1', status: 'unreadable', reason: 'denied, see "policy"' },
    ]);
    expect(rows[0]).toBe('# coverage,unreadable,groups,g1,"denied, see ""policy"""');
  });

  it('payload exposes statements identical to the constant list', () => {
    const p = limitationsPayload('complete', []);
    expect(p.statements).toEqual([...LIMITATION_STATEMENTS]);
    expect(p.version).toBe(LIMITATIONS_VERSION);
  });
});
