import { beforeEach, describe, expect, it, vi } from 'vitest';

const kv = vi.hoisted(() => ({
  store: new Map<string, unknown>(),
  env: 'PRODUCTION' as string | undefined,
  /** Runtime app-context license (what Forge exposes to scheduled triggers / consumers). */
  license: undefined as Record<string, unknown> | undefined,
  bumps: 0,
  failSet: false,
}));

vi.mock('@forge/api', () => ({
  getAppContext: () => ({ environmentType: kv.env, license: kv.license }),
}));
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
  kvSet: async (k: string, v: unknown) => {
    if (kv.failSet) throw new Error('kv down');
    kv.store.set(k, v);
  },
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
    kv.license = undefined;
    kv.failSet = false;
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

  describe('background jobs: runtime license (getAppContext) before stored', () => {
    it('production with no license anywhere is Standard (source unknown), never Advanced', async () => {
      const bg = await backgroundEdition();
      expect(bg).toMatchObject({
        edition: 'standard',
        source: 'unknown',
        override: null,
        canOverride: false,
      });
      for (const f of ADVANCED_ONLY) expect(bg.features[f]).toBe(false);
      expect(kv.store.has('edition:license')).toBe(false);
    });

    it('a missing environment type is treated like production', async () => {
      kv.env = undefined;
      expect(await backgroundEdition()).toMatchObject({ edition: 'standard', source: 'unknown' });
    });

    it('runtime active Advanced license is Advanced and gets stored', async () => {
      kv.license = { isActive: true, capabilitySet: 'capabilityAdvanced' };
      const bg = await backgroundEdition();
      expect(bg).toMatchObject({ edition: 'advanced', source: 'license' });
      for (const f of ADVANCED_ONLY) expect(bg.features[f]).toBe(true);
      expect(kv.store.get('edition:license')).toEqual({
        active: true,
        isActive: true,
        capabilitySet: 'capabilityAdvanced',
      });
      expect(kv.bumps).toBe(1);
      // Same license again: no re-store, no gate bump.
      await backgroundEdition();
      expect(kv.bumps).toBe(1);
    });

    it('runtime license wins over a stale stored one', async () => {
      kv.store.set('edition:license', { active: true, capabilitySet: 'capabilityAdvanced' });
      kv.license = { active: true, capabilitySet: 'capabilityStandard' };
      expect(await backgroundEdition()).toMatchObject({ edition: 'standard', source: 'license' });
      expect(kv.store.get('edition:license')).toMatchObject({
        capabilitySet: 'capabilityStandard',
      });
    });

    it('runtime inactive license is Standard (source inactive)', async () => {
      kv.store.set('edition:license', { active: true, capabilitySet: 'capabilityAdvanced' });
      kv.license = { active: false, capabilitySet: 'capabilityAdvanced' };
      const bg = await backgroundEdition();
      expect(bg).toMatchObject({ edition: 'standard', source: 'inactive' });
      for (const f of ADVANCED_ONLY) expect(bg.features[f]).toBe(false);
      expect(kv.store.get('edition:license')).toMatchObject({ active: false });
    });

    it('stored license still applies when the runtime context has none', async () => {
      kv.store.set('edition:license', { active: true, capabilitySet: 'capabilityAdvanced' });
      expect(await backgroundEdition()).toMatchObject({ edition: 'advanced', source: 'license' });
    });

    it('development / staging with nothing keeps the development default (Advanced)', async () => {
      for (const env of ['DEVELOPMENT', 'STAGING']) {
        kv.env = env;
        expect(await backgroundEdition()).toMatchObject({
          edition: 'advanced',
          source: 'development',
          canOverride: true,
        });
      }
    });

    it('storing the runtime license is best effort', async () => {
      kv.license = { active: true, capabilitySet: 'capabilityAdvanced' };
      kv.failSet = true;
      expect(await backgroundEdition()).toMatchObject({ edition: 'advanced', source: 'license' });
      kv.failSet = false;
    });
  });
});
