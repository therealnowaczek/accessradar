import { getAppContext } from '@forge/api';
import { bumpGate } from '../collector/gate';
import { audit } from '../db/audit';
import { BadRequest } from './service';
import { kvGet, kvSet } from '../db/settings';
import { ensureMigrated } from '../db/migrations';
import { isLicenseActive } from '../domain/license';
import {
  featureFlags,
  normalizeEdition,
  overridesAllowed,
  resolveEdition,
  type Edition,
  type EditionLicense,
  type EditionSource,
  type FeatureFlags,
} from '../domain/edition';

export interface EditionDecision {
  edition: Edition;
  source: EditionSource;
  features: FeatureFlags;
  /** The saved in-app override when overrides are allowed; otherwise null. */
  override: Edition | null;
  /** True on Forge development/staging — Settings may show the override control. */
  canOverride: boolean;
}

const OVERRIDE_KEY = 'edition:override';
/** Last license seen on a UI invocation; background triggers use it to apply edition limits. */
const LICENSE_KEY = 'edition:license';

/**
 * Stored shape: a normalized `active` (true when either Forge flag is true) plus the raw
 * `isActive`, so background jobs read the same state as the UI invocation.
 */
const pickLicense = (l: EditionLicense | null | undefined): EditionLicense | null =>
  l
    ? {
        active: isLicenseActive(l),
        isActive: l.isActive ?? null,
        capabilitySet: l.capabilitySet ?? null,
      }
    : null;

/** Persist the invocation license if it changed; bumps the trigger gate on change. */
async function storeLicense(license: EditionLicense | null | undefined): Promise<void> {
  const next = pickLicense(license);
  const prev = await kvGet<EditionLicense | null>(LICENSE_KEY);
  if (JSON.stringify(prev) !== JSON.stringify(next)) {
    await kvSet(LICENSE_KEY, next);
    await bumpGate().catch(() => undefined);
  }
}

/**
 * Unlicensed invocation (license object present but inactive): resolvers refuse the call, but
 * the stored license must still change so scheduled jobs drop to Standard. Best effort.
 */
export async function rememberInactiveLicense(
  license: EditionLicense | null | undefined,
): Promise<void> {
  if (!license || isLicenseActive(license)) return;
  try {
    await ensureMigrated();
    await storeLicense(license);
  } catch {
    // Never let bookkeeping change the unlicensed response.
  }
}

/**
 * Precedence when overrides are allowed: AR_EDITION_OVERRIDE env > saved in-app override >
 * license capabilitySet > development default (Advanced).
 * On production, only the license (or development default if no license object) applies.
 * A license object that is not active resolves to Standard (source `inactive`).
 */
export async function decideEdition(
  license: EditionLicense | null | undefined,
  opts: { env?: string | null; environmentType?: string | null } = {},
): Promise<EditionDecision> {
  const canOverride = overridesAllowed(opts.environmentType);
  const env = opts.env !== undefined ? opts.env : process.env.AR_EDITION_OVERRIDE;
  const stored = normalizeEdition(await kvGet<string>(OVERRIDE_KEY));
  const resolved = resolveEdition({
    license,
    env: canOverride ? env : null,
    stored: canOverride ? stored : null,
  });
  return {
    ...resolved,
    features: featureFlags(resolved.edition),
    override: canOverride ? stored : null,
    canOverride,
  };
}

/** UI invocation: remember the license so scheduled jobs see the same edition. */
export async function decideForInvocation(
  license: EditionLicense | null | undefined,
  environmentType?: string | null,
) {
  await storeLicense(license);
  return decideEdition(license, { environmentType });
}

/**
 * Background jobs (scheduled triggers, consumers, events). Forge does not put the license in
 * these payloads, but the runtime app context (`getAppContext().license`) carries it, so:
 * 1. runtime license (also stored, best effort, so later jobs and the UI agree);
 * 2. else the last license stored by a UI invocation;
 * 3. else, where overrides are not allowed (production / unknown env), Standard with source
 *    `unknown` — never Advanced just because no license has been seen yet (fresh install);
 * 4. else (development / staging) the development default (Advanced, or the overrides).
 */
export async function backgroundEdition(): Promise<EditionDecision> {
  let environmentType: string | undefined;
  let runtimeLicense: EditionLicense | null = null;
  try {
    const ctx = getAppContext();
    environmentType = ctx?.environmentType;
    runtimeLicense = ctx?.license ?? null;
  } catch {
    environmentType = undefined;
  }
  if (runtimeLicense) {
    try {
      await storeLicense(runtimeLicense);
    } catch {
      // Bookkeeping only; the runtime license still decides this job.
    }
    return decideEdition(runtimeLicense, { environmentType });
  }
  const stored = await kvGet<EditionLicense | null>(LICENSE_KEY);
  if (!stored && !overridesAllowed(environmentType)) {
    return {
      edition: 'standard',
      source: 'unknown',
      features: featureFlags('standard'),
      override: null,
      canOverride: false,
    };
  }
  return decideEdition(stored, { environmentType });
}

export async function setEditionOverride(
  actorId: string,
  value: unknown,
  license: EditionLicense | null | undefined,
  environmentType?: string | null,
): Promise<EditionDecision> {
  if (!overridesAllowed(environmentType)) {
    throw new BadRequest('Edition override is only available in development and staging.');
  }
  const next =
    value === null || value === '' || value === undefined ? null : normalizeEdition(String(value));
  if (next === null && value !== null && value !== '' && value !== undefined) {
    throw new BadRequest('Edition must be standard, advanced, or empty.');
  }
  const before = normalizeEdition(await kvGet<string>(OVERRIDE_KEY));
  await kvSet(OVERRIDE_KEY, next);
  await bumpGate().catch(() => undefined);
  await audit(actorId, 'edition.override', 'edition', { before, after: next });
  return decideEdition(license, { environmentType });
}
