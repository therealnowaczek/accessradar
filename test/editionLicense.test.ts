import { beforeEach, describe, expect, it, vi } from 'vitest';

const kv = vi.hoisted(() => ({
  store: new Map<string, unknown>(),
  env: 'PRODUCTION' as string | undefined,
  bumps: 0,
}));

vi.mock('@forge/api', () => ({ getAppContext: () => ({ environmentType: kv.env }) }));
vi.mock('../src/collector/gate', () => ({
  bumpGate: async () => {
    kv.bumps += 1;
  },
}));
vi.mock('../src/db/audit', () => ({ audit: async () => undefined }));
vi.mock('../src/db/migrations', () => ({ ensureMigrated: async () => undefined }));
vi.mock('../src/api/service', () => ({ BadRequest: class BadRequest extends Error {} }));
vi.mock('../src/db/settings', () => ({
  kvGet: async (k: string) => kv.store.get(k) ?? null,
  kvSet: async (k: string, v: unknown) => void kv.store.set(k, v),
}));

import {
  backgroundEdition,
  decideEdition,
  decideForInvocation,
  rememberInactiveLicense,
} from '../src/api/edition';

const ADVANCED_ONLY = [
  'customSchedules',
  'unlimitedHistory',
  'remediationVerification',
  'delegatedReviews',
  'reviewCampaigns',
  'changeAlerts',
  'evidencePack',
  'rovo',
  'signatureChain',
] as const;

describe('license state across invocations and background jobs', () => {
  beforeEach(() => {
    kv.store.clear();
    kv.env = 'PRODUCTION';
    kv.bumps = 0;
  });

  it('isActive true + capabilityadvanced is Advanced on production', async () => {
    const d = await decideEdition(
      { isActive: true, capabilitySet: 'capabilityadvanced' },
      { env: null, environmentType: 'PRODUCTION' },
    );
    expect(d.edition).toBe('advanced');
  });

  it('an inactive license is Standard on production, even with capabilityAdvanced', async () => {
    for (const license of [
      { active: false, capabilitySet: 'capabilityAdvanced' },
      { isActive: false, capabilitySet: 'capabilityAdvanced' },
      { capabilitySet: 'capabilityAdvanced' },
    ]) {
      const d = await decideEdition(license, { env: null, environmentType: 'PRODUCTION' });
      expect(d).toMatchObject({ edition: 'standard', source: 'inactive' });
      for (const f of ADVANCED_ONLY) expect(d.features[f]).toBe(false);
    }
  });

  it('stores a normalized active flag so background jobs agree with the UI', async () => {
    await decideForInvocation(
      { isActive: true, capabilitySet: 'capabilityadvanced' },
      'PRODUCTION',
    );
    expect(kv.store.get('edition:license')).toEqual({
      active: true,
      isActive: true,
      capabilitySet: 'capabilityadvanced',
    });
    expect((await backgroundEdition()).edition).toBe('advanced');
  });

  it('background jobs drop to Standard once an inactive license is stored', async () => {
    await decideForInvocation({ active: true, capabilitySet: 'capabilityAdvanced' }, 'PRODUCTION');
    expect((await backgroundEdition()).edition).toBe('advanced');

    // Resolvers refuse unlicensed calls but still record the inactive license.
    await rememberInactiveLicense({ active: false, capabilitySet: 'capabilityAdvanced' });
    expect(kv.store.get('edition:license')).toMatchObject({ active: false });
    const bg = await backgroundEdition();
    expect(bg).toMatchObject({ edition: 'standard', source: 'inactive' });
    for (const f of ADVANCED_ONLY) expect(bg.features[f]).toBe(false);
    expect(kv.bumps).toBe(2);
  });

  it('a legacy stored inactive license (old shape) is Standard for background jobs', async () => {
    kv.store.set('edition:license', { active: false, capabilitySet: 'capabilityAdvanced' });
    expect((await backgroundEdition()).edition).toBe('standard');
  });

  it('no stored license keeps the development default', async () => {
    kv.env = 'DEVELOPMENT';
    expect(await backgroundEdition()).toMatchObject({ edition: 'advanced', source: 'development' });
  });

  it('rememberInactiveLicense ignores missing and active licenses', async () => {
    await rememberInactiveLicense(null);
    await rememberInactiveLicense({ active: true, capabilitySet: 'capabilityAdvanced' });
    expect(kv.store.has('edition:license')).toBe(false);
  });
});
