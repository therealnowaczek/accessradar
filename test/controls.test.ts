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
    expect(CONTROLS_VERSION).toBeGreaterThanOrEqual(2);
    expect(CONTROLS_DISCLAIMER).toMatch(/does not by itself demonstrate/);
    expect(EVIDENCE_DATA_SOURCES.length).toBeGreaterThan(3);
  });

  it('adds NIS2 Art. 21 at control level', () => {
    const nis2 = CONTROL_MAPPINGS.filter((m) => m.framework === 'NIS2').map((m) => m.id);
    expect(nis2).toEqual(['Art. 21(2)(i)', 'Art. 21(2)(f)']);
  });

  it('never claims compliance and uses no em dash', () => {
    const all = [CONTROLS_DISCLAIMER, ...CONTROL_MAPPINGS.flatMap((m) => [m.title, m.accessRadar])];
    for (const text of all) {
      expect(text).not.toMatch(/\bmakes? you compliant\b|\bis compliant\b|\bcertified\b/i);
      expect(text).not.toContain('\u2014');
    }
    expect(CONTROLS_DISCLAIMER).toMatch(/not a statement of compliance/);
  });
});
