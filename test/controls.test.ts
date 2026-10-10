import { describe, expect, it } from 'vitest';
import {
  CONTROL_MAPPINGS,
  CONTROLS_DISCLAIMER,
  CONTROLS_VERSION,
  EVIDENCE_DATA_SOURCES,
} from '../src/domain/controls';

describe('controls mapping', () => {
  it('covers SOC 2 CC6.1–6.3 and ISO A.5.15 / A.5.18 / A.8.2', () => {
    const ids = CONTROL_MAPPINGS.map((m) => m.id);
    expect(ids).toEqual(
      expect.arrayContaining(['CC6.1', 'CC6.2', 'CC6.3', 'A.5.15', 'A.5.18', 'A.8.2']),
    );
    expect(CONTROLS_VERSION).toBeGreaterThanOrEqual(1);
    expect(CONTROLS_DISCLAIMER).toMatch(/does not by itself demonstrate/);
    expect(EVIDENCE_DATA_SOURCES.length).toBeGreaterThan(3);
  });
});
