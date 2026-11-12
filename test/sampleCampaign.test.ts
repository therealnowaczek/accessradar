import { describe, expect, it } from 'vitest';
import {
  decideSample,
  finishSample,
  newSample,
  parseSampleDecision,
  SAMPLE_ITEMS,
  sampleView,
} from '../src/domain/sampleCampaign';

describe('sample campaign', () => {
  it('starts empty with every item undecided', () => {
    const v = sampleView(newSample(1));
    expect(v.total).toBe(SAMPLE_ITEMS.length);
    expect(v.decided).toBe(0);
    expect(v.finishedAt).toBeNull();
  });

  it('records, changes and clears decisions without mutating the input', () => {
    const s0 = newSample(1);
    const s1 = decideSample(s0, 's1', 'revoke');
    expect(s0.decisions).toEqual({});
    expect(sampleView(s1).counts.revoke).toBe(1);
    const s2 = decideSample(s1, 's1', 'keep');
    expect(sampleView(s2).counts).toEqual({ keep: 1, revoke: 0, exception: 0 });
    expect(sampleView(decideSample(s2, 's1', null)).decided).toBe(0);
  });

  it('rejects unknown items and unknown decisions', () => {
    expect(() => decideSample(newSample(1), 'nope', 'keep')).toThrow();
    expect(parseSampleDecision('delete')).toBeNull();
    expect(parseSampleDecision('exception')).toBe('exception');
  });

  it('only finishes when every item is decided, then becomes read only', () => {
    let s = newSample(1);
    expect(() => finishSample(s, 5)).toThrow();
    for (const i of SAMPLE_ITEMS) s = decideSample(s, i.id, 'keep');
    s = finishSample(s, 5);
    expect(sampleView(s).finishedAt).toBe(5);
    expect(() => decideSample(s, 's1', 'revoke')).toThrow();
  });

  it('uses only invented names and no em dashes', () => {
    const text = JSON.stringify(SAMPLE_ITEMS);
    expect(text).not.toContain('—');
    for (const i of SAMPLE_ITEMS) expect(i.person).toMatch(/Sample|Anyone/);
  });
});
