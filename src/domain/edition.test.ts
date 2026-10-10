import { describe, expect, it } from 'vitest';
import { effectiveSchedule, featureFlags, resolveEdition } from './edition';
import { isLicensed } from './license';

describe('resolveEdition', () => {
  it('treats a missing license as Advanced', () => {
    expect(resolveEdition({ license: null }).edition).toBe('advanced');
    expect(resolveEdition({ license: { active: false } }).source).toBe('development');
  });

  it('maps capabilitySet on an active license', () => {
    expect(
      resolveEdition({ license: { active: true, capabilitySet: 'capabilityStandard' } }).edition,
    ).toBe('standard');
    expect(
      resolveEdition({ license: { active: true, capabilitySet: 'capabilityAdvanced' } }).edition,
    ).toBe('advanced');
    expect(resolveEdition({ license: { active: true, capabilitySet: null } }).edition).toBe(
      'standard',
    );
  });

  it('lets env beat a stored override and the license', () => {
    expect(
      resolveEdition({
        license: { active: true, capabilitySet: 'capabilityAdvanced' },
        stored: 'advanced',
        env: 'standard',
      }),
    ).toEqual({ edition: 'standard', source: 'env' });
  });

  it('lets the stored override beat the license', () => {
    expect(
      resolveEdition({
        license: { active: true, capabilitySet: 'capabilityStandard' },
        stored: 'advanced',
      }).source,
    ).toBe('stored');
  });
});

describe('featureFlags', () => {
  it('keeps schedules, history, delegation, campaigns, alerts, evidence pack and Rovo on Advanced only', () => {
    expect(featureFlags('standard')).toMatchObject({
      customSchedules: false,
      unlimitedHistory: false,
      delegatedReviews: false,
      reviewCampaigns: false,
      changeAlerts: false,
      evidencePack: false,
      rovo: false,
    });
    expect(Object.values(featureFlags('advanced')).every(Boolean)).toBe(true);
  });
});

describe('effectiveSchedule', () => {
  const s = { frequency: 'daily' as const, retentionDays: 395 };
  it('runs daily as weekly and caps history at 90 days on Standard', () => {
    expect(effectiveSchedule(s, featureFlags('standard'))).toEqual({
      frequency: 'weekly',
      retentionDays: 90,
    });
  });
  it('leaves Advanced settings untouched', () => {
    expect(effectiveSchedule(s, featureFlags('advanced'))).toEqual(s);
  });
});

describe('isLicensed', () => {
  it('allows missing licenses and rejects inactive ones', () => {
    expect(isLicensed({})).toBe(true);
    expect(isLicensed({ license: { active: false } })).toBe(false);
    expect(isLicensed({ license: { active: true } })).toBe(true);
  });
});
