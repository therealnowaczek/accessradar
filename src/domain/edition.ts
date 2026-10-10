/**
 * Marketplace editions (mirrors MarginRadar src/domain/edition.ts).
 *
 * `license.capabilitySet` is `capabilityAdvanced` or `capabilityStandard`.
 * An active license with a missing capability set is Standard: Atlassian leaves
 * it null until the customer changes edition.
 * Development and staging omit `license`. Those sites are Advanced unless
 * `AR_EDITION_OVERRIDE` or the stored override says otherwise.
 */
export type Edition = 'standard' | 'advanced';

export type EditionSource = 'env' | 'stored' | 'license' | 'development';

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
  /** Coming soon: reviews delegated to project owners, with reminders. */
  delegatedReviews: boolean;
  /** Coming soon: recurring review campaigns. */
  reviewCampaigns: boolean;
  /** Coming soon: alerts on new admins, public grants, inactive users with access. */
  changeAlerts: boolean;
  /** Coming soon: audit evidence pack PDF (methodology + decision trail). */
  evidencePack: boolean;
  /** Coming soon: Rovo agent. */
  rovo: boolean;
}

/** Feature keys released (no longer “coming soon” in Settings promo). */
export const RELEASED_FEATURES = [
  'customSchedules',
  'unlimitedHistory',
  'remediationVerification',
] as const satisfies ReadonlyArray<keyof FeatureFlags>;

export type ReleasedFeature = (typeof RELEASED_FEATURES)[number];

/** Advanced flags not yet shipped; Settings promo lists these as coming soon. */
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
  if (license.capabilitySet === 'capabilityAdvanced') {
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
