import { getAppContext } from '@forge/api';
import { bumpGate } from '../collector/gate';
import { audit } from '../db/audit';
import { BadRequest } from './service';
import { kvGet, kvSet } from '../db/settings';
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

const pickLicense = (l: EditionLicense | null | undefined): EditionLicense | null =>
  l ? { active: l.active, capabilitySet: l.capabilitySet ?? null } : null;

/**
 * Precedence when overrides are allowed: AR_EDITION_OVERRIDE env > saved in-app override >
 * license capabilitySet > development default (Advanced).
 * On production, only the license (or development default if no license object) applies.
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
  const next = pickLicense(license);
  const prev = await kvGet<EditionLicense | null>(LICENSE_KEY);
  if (JSON.stringify(prev) !== JSON.stringify(next)) {
    await kvSet(LICENSE_KEY, next);
    await bumpGate().catch(() => undefined);
  }
  return decideEdition(license, { environmentType });
}

/** Background jobs (no invocation license): use the last license seen + Forge env type. */
export async function backgroundEdition(): Promise<EditionDecision> {
  let environmentType: string | undefined;
  try {
    environmentType = getAppContext()?.environmentType;
  } catch {
    environmentType = undefined;
  }
  return decideEdition(await kvGet<EditionLicense | null>(LICENSE_KEY), { environmentType });
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
