/**
 * Marketplace editions (Radar family pattern — same as MarginRadar / ConfigRadar).
 *
 * `license.capabilitySet` is `capabilityAdvanced` or `capabilityStandard` (Atlassian docs and
 * the runtime also use the lowercase `capabilityadvanced`, so the match ignores case).
 * An active license with a missing capability set is Standard: Atlassian leaves
 * it null until the customer changes edition.
 * Development and staging omit `license`. Those sites are Advanced unless
 * `AR_EDITION_OVERRIDE` or the stored in-app override says otherwise.
 *
 * Overrides (env + stored) are honourable only when `overridesAllowed` — never on
 * Marketplace production, so a Standard license cannot unlock Advanced in Settings.
 */
export type Edition = 'standard' | 'advanced';

export type EditionSource = 'env' | 'stored' | 'license' | 'development';

/** Forge DEVELOPMENT / STAGING only. Missing or PRODUCTION → no overrides. */
export function overridesAllowed(environmentType?: string | null): boolean {
  const env = (environmentType ?? '').toUpperCase();
  return env === 'DEVELOPMENT' || env === 'STAGING';
}

export interface EditionLicense {
  active?: boolean;
  capabilitySet?: string | null;
}

export interface FeatureFlags {
  /** Daily and custom snapshot schedules (Standard: manual + weekly). */
  customSchedules: boolean;
  /** History beyond STANDARD_RETENTION_DAYS. */
  unlimitedHistory: boolean;
  /** Advanced: verify that Revoke decisions disappear in a later snapshot. */
  remediationVerification: boolean;
  /** Advanced: reviews delegated to project owners (project settings page + in-app reminders). */
  delegatedReviews: boolean;
  /** Advanced: recurring review campaigns. */
  reviewCampaigns: boolean;
  /** Advanced: alerts on new admins, public grants, inactive users with access. */
  changeAlerts: boolean;
  /** Advanced: audit evidence pack PDF (methodology + decision trail). */
  evidencePack: boolean;
  /** Advanced: read-only Rovo agent (rovo:agent + GET actions, Runs on Atlassian). */
  rovo: boolean;
  /**
   * Advanced: signed reviews (SHA-256 evidence hash), the site-wide hash chain and Verify
   * (quick, deep snapshot and chain). Family rule (2026-10-26): signing, hash chain and Verify
   * are always Advanced. Reviews signed earlier stay readable on Standard.
   */
  signatureChain: boolean;
}

/** Feature keys released (no longer “coming soon” in Settings promo). */
export const RELEASED_FEATURES = [
  'customSchedules',
  'unlimitedHistory',
  'remediationVerification',
  'evidencePack',
  'changeAlerts',
  'reviewCampaigns',
  'delegatedReviews',
  'rovo',
  'signatureChain',
] as const satisfies ReadonlyArray<keyof FeatureFlags>;

export type ReleasedFeature = (typeof RELEASED_FEATURES)[number];

/** Advanced flags not yet shipped; Settings promo lists these as coming soon (none today). */
export function comingSoonFeatures(flags: FeatureFlags): Array<keyof FeatureFlags> {
  const released = new Set<string>(RELEASED_FEATURES);
  return (Object.keys(flags) as Array<keyof FeatureFlags>).filter(
    (k) => !released.has(k) && flags[k],
  );
}

export const REQUIRES_ADVANCED = 'This requires the Advanced edition of AccessRadar.';

/** Standard keeps 90 days of history; Advanced is unlimited (up to the settings maximum). */
export const STANDARD_RETENTION_DAYS = 90;

export function normalizeEdition(value: string | null | undefined): Edition | null {
  const text = value?.trim().toLowerCase();
  if (text === 'standard' || text === 'advanced') {
    return text;
  }
  return null;
}

/** `capabilityAdvanced` in any letter case. Anything else (Standard, null, unknown) is not Advanced. */
export function isAdvancedCapability(capabilitySet: string | null | undefined): boolean {
  return (capabilitySet ?? '').trim().toLowerCase() === 'capabilityadvanced';
}

export function resolveEdition(input: {
  license?: EditionLicense | null;
  env?: string | null;
  stored?: string | null;
}): { edition: Edition; source: EditionSource } {
  const fromEnv = normalizeEdition(input.env);
  if (fromEnv) {
    return { edition: fromEnv, source: 'env' };
  }
  const stored = normalizeEdition(input.stored);
  if (stored) {
    return { edition: stored, source: 'stored' };
  }
  const license = input.license;
  if (!license || license.active !== true) {
    return { edition: 'advanced', source: 'development' };
  }
  if (isAdvancedCapability(license.capabilitySet)) {
    return { edition: 'advanced', source: 'license' };
  }
  return { edition: 'standard', source: 'license' };
}

export function featureFlags(edition: Edition): FeatureFlags {
  const advanced = edition === 'advanced';
  return {
    customSchedules: advanced,
    unlimitedHistory: advanced,
    remediationVerification: advanced,
    delegatedReviews: advanced,
    reviewCampaigns: advanced,
    changeAlerts: advanced,
    evidencePack: advanced,
    rovo: advanced,
    signatureChain: advanced,
  };
}

/** Settings as the edition allows them: Standard runs daily schedules weekly and caps retention. */
export function effectiveSchedule<
  T extends { frequency: 'off' | 'daily' | 'weekly'; retentionDays: number },
>(settings: T, flags: FeatureFlags): T {
  return {
    ...settings,
    frequency:
      !flags.customSchedules && settings.frequency === 'daily' ? 'weekly' : settings.frequency,
    retentionDays: flags.unlimitedHistory
      ? settings.retentionDays
      : Math.min(settings.retentionDays, STANDARD_RETENTION_DAYS),
  };
}
