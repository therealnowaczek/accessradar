/**
 * Paid-app license gate (mirrors MarginRadar src/domain/license.ts).
 *
 * `license` is present for Marketplace-listed apps in production.
 * It is undefined in development, staging, and for apps that are not listed,
 * and those invocations are allowed so the app can be built before listing.
 */
export interface LicenseContext {
  license?: { active?: boolean; capabilitySet?: string | null } | null;
  accountId?: string | null;
}

export function isLicensed(context: LicenseContext | undefined): boolean {
  if (!context?.license) {
    return true;
  }
  return context.license.active === true;
}

export const UNLICENSED_MESSAGE = 'AccessRadar does not have an active license on this site.';
