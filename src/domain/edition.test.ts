import { describe, expect, it } from 'vitest';
import {
  comingSoonFeatures,
  effectiveSchedule,
  featureFlags,
  overridesAllowed,
  RELEASED_FEATURES,
  resolveEdition,
} from './edition';
import { isLicensed, isLicenseActive } from './license';

describe('overridesAllowed', () => {
  it('allows only Forge development and staging', () => {
    expect(overridesAllowed('DEVELOPMENT')).toBe(true);
    expect(overridesAllowed('STAGING')).toBe(true);
    expect(overridesAllowed('development')).toBe(true);
    expect(overridesAllowed('PRODUCTION')).toBe(false);
    expect(overridesAllowed(undefined)).toBe(false);
    expect(overridesAllowed('')).toBe(false);
  });
});

describe('resolveEdition', () => {
  it('treats a missing license as the development default (Advanced)', () => {
    expect(resolveEdition({ license: null })).toEqual({
      edition: 'advanced',
      source: 'development',
    });
    expect(resolveEdition({ license: undefined })).toEqual({
      edition: 'advanced',
      source: 'development',
    });
    expect(resolveEdition({})).toEqual({ edition: 'advanced', source: 'development' });
  });

  it('active true + capabilityAdvanced is Advanced', () => {
    expect(
      resolveEdition({ license: { active: true, capabilitySet: 'capabilityAdvanced' } }),
    ).toEqual({ edition: 'advanced', source: 'license' });
  });

  it('isActive true + lowercase capabilityadvanced is Advanced', () => {
    expect(
      resolveEdition({ license: { isActive: true, capabilitySet: 'capabilityadvanced' } }),
    ).toEqual({ edition: 'advanced', source: 'license' });
  });

  it('never makes an inactive license Advanced', () => {
    expect(
      resolveEdition({ license: { active: false, capabilitySet: 'capabilityAdvanced' } }),
    ).toEqual({ edition: 'standard', source: 'inactive' });
    expect(
      resolveEdition({ license: { isActive: false, capabilitySet: 'capabilityAdvanced' } }),
    ).toEqual({ edition: 'standard', source: 'inactive' });
    expect(resolveEdition({ license: { isActive: false } }).edition).toBe('standard');
    expect(resolveEdition({ license: { active: false } }).edition).toBe('standard');
  });

  it('treats a license object with neither flag as inactive (Standard)', () => {
    expect(resolveEdition({ license: { capabilitySet: 'capabilityAdvanced' } })).toEqual({
      edition: 'standard',
      source: 'inactive',
    });
    expect(resolveEdition({ license: {} }).edition).toBe('standard');
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

  it('accepts the lowercase capability values from the Forge license context', () => {
    expect(
      resolveEdition({ license: { active: true, capabilitySet: 'capabilityadvanced' } }),
    ).toEqual({ edition: 'advanced', source: 'license' });
    expect(
      resolveEdition({ license: { active: true, capabilitySet: 'capabilitystandard ' } }),
    ).toEqual({ edition: 'standard', source: 'license' });
    expect(
      resolveEdition({ license: { active: true, capabilitySet: 'capabilitySomethingElse' } })
        .edition,
    ).toBe('standard');
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
  it('keeps schedules, history, remediation, delegation, campaigns, alerts, evidence pack and Rovo on Advanced only', () => {
    expect(featureFlags('standard')).toMatchObject({
      customSchedules: false,
      unlimitedHistory: false,
      remediationVerification: false,
      delegatedReviews: false,
      reviewCampaigns: false,
      changeAlerts: false,
      evidencePack: false,
      rovo: false,
    });
    expect(Object.values(featureFlags('advanced')).every(Boolean)).toBe(true);
  });
  it('lists only unreleased Advanced features as coming soon', () => {
    expect(comingSoonFeatures(featureFlags('advanced'))).toEqual([]);
    expect(RELEASED_FEATURES).toContain('rovo');
    // Every Advanced flag has shipped, so each one is released.
    expect([...RELEASED_FEATURES].sort()).toEqual(Object.keys(featureFlags('advanced')).sort());
    expect(RELEASED_FEATURES).toContain('remediationVerification');
    expect(RELEASED_FEATURES).toContain('evidencePack');
    expect(RELEASED_FEATURES).toContain('changeAlerts');
    expect(RELEASED_FEATURES).toContain('reviewCampaigns');
    expect(RELEASED_FEATURES).toContain('delegatedReviews');
    expect(comingSoonFeatures(featureFlags('standard'))).toEqual([]);
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

  it('accepts isActive as well as active', () => {
    expect(isLicensed({ license: { isActive: true } })).toBe(true);
    expect(isLicensed({ license: { isActive: false } })).toBe(false);
    expect(isLicensed({ license: {} })).toBe(false);
    expect(isLicensed({ license: null })).toBe(true);
  });
});

describe('isLicenseActive', () => {
  it('is true only for an object with active or isActive true', () => {
    expect(isLicenseActive({ active: true })).toBe(true);
    expect(isLicenseActive({ isActive: true })).toBe(true);
    expect(isLicenseActive({ active: false, isActive: true })).toBe(true);
    expect(isLicenseActive({ active: false })).toBe(false);
    expect(isLicenseActive({})).toBe(false);
    expect(isLicenseActive(null)).toBe(false);
    expect(isLicenseActive(undefined)).toBe(false);
  });
});
