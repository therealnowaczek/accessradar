/**
 * Paid-app license gate (mirrors MarginRadar src/domain/license.ts).
 *
 * `license` is present for Marketplace-listed apps in production.
 * It is undefined in development, staging, and for apps that are not listed,
 * and those invocations are allowed so the app can be built before listing.
 */
/** Licence state as Forge passes it: `active` (documented) or `isActive` (also seen). */
export interface LicenseState {
  active?: boolean | null;
  isActive?: boolean | null;
}

export interface LicenseContext {
  license?: (LicenseState & { capabilitySet?: string | null }) | null;
  accountId?: string | null;
}

/**
 * Single source of truth for "is this licence object active". True only when the object
 * exists and `active === true || isActive === true`. A missing licence is NOT active here;
 * callers decide what a missing licence means (dev/staging/unlisted).
 */
export function isLicenseActive(license: LicenseState | null | undefined): boolean {
  return !!license && (license.active === true || license.isActive === true);
}

export function isLicensed(context: LicenseContext | undefined): boolean {
  if (!context?.license) {
    return true;
  }
  return isLicenseActive(context.license);
}

export const UNLICENSED_MESSAGE = 'AccessRadar does not have an active license on this site.';
