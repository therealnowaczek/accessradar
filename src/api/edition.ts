import { bumpGate } from '../collector/gate';
import { audit } from '../db/audit';
import { BadRequest } from './service';
import { kvGet, kvSet } from '../db/settings';
import {
  featureFlags,
  normalizeEdition,
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
  /** The saved in-app override, if any (the env override wins over it). */
  override: Edition | null;
}

const OVERRIDE_KEY = 'edition:override';
/** Last license seen on a UI invocation; background triggers use it to apply edition limits. */
const LICENSE_KEY = 'edition:license';

const pickLicense = (l: EditionLicense | null | undefined): EditionLicense | null =>
  l ? { active: l.active, capabilitySet: l.capabilitySet ?? null } : null;

/** Precedence: AR_EDITION_OVERRIDE env > saved in-app override > license capabilitySet. */
export async function decideEdition(
  license: EditionLicense | null | undefined,
  env: string | undefined = process.env.AR_EDITION_OVERRIDE,
): Promise<EditionDecision> {
  const stored = normalizeEdition(await kvGet<string>(OVERRIDE_KEY));
  const resolved = resolveEdition({ license, env, stored });
  return { ...resolved, features: featureFlags(resolved.edition), override: stored };
}

/** UI invocation: remember the license so scheduled jobs see the same edition. */
export async function decideForInvocation(license: EditionLicense | null | undefined) {
  const next = pickLicense(license);
  const prev = await kvGet<EditionLicense | null>(LICENSE_KEY);
  if (JSON.stringify(prev) !== JSON.stringify(next)) {
    await kvSet(LICENSE_KEY, next);
    await bumpGate().catch(() => undefined);
  }
  return decideEdition(license);
}

/** Background jobs (no invocation license): use the last license seen. */
export async function backgroundEdition(): Promise<EditionDecision> {
  return decideEdition(await kvGet<EditionLicense | null>(LICENSE_KEY));
}

export async function setEditionOverride(
  actorId: string,
  value: unknown,
  license: EditionLicense | null | undefined,
): Promise<EditionDecision> {
  const next =
    value === null || value === '' || value === undefined ? null : normalizeEdition(String(value));
  if (next === null && value !== null && value !== '' && value !== undefined) {
    throw new BadRequest('Edition must be standard, advanced, or empty.');
  }
  const before = normalizeEdition(await kvGet<string>(OVERRIDE_KEY));
  await kvSet(OVERRIDE_KEY, next);
  await bumpGate().catch(() => undefined);
  await audit(actorId, 'edition.override', 'edition', { before, after: next });
  return decideEdition(license);
}
