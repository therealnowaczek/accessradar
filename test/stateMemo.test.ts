import { describe, expect, it } from 'vitest';
import { stateOf } from '../src/api/service';

describe('stateOf', () => {
  it('builds the access model once per loaded fact array', () => {
    const facts: any[] = [];
    const a = stateOf(facts);
    expect(stateOf(facts)).toBe(a);
    expect(stateOf([])).not.toBe(a);
  });
});
