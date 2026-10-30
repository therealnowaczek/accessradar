import { beforeEach, describe, expect, it, vi } from 'vitest';

const kv = vi.hoisted(() => ({ store: new Map<string, unknown>() }));

vi.mock('@forge/api', () => ({ getAppContext: () => ({}) }));
vi.mock('../src/collector/gate', () => ({ bumpGate: async () => undefined }));
vi.mock('../src/db/audit', () => ({ audit: async () => undefined }));
vi.mock('../src/db/migrations', () => ({ ensureMigrated: async () => undefined }));
vi.mock('../src/api/service', () => ({ BadRequest: class BadRequest extends Error {} }));
vi.mock('../src/db/settings', () => ({
  kvGet: async (k: string) => kv.store.get(k) ?? null,
  kvSet: async (k: string, v: unknown) => void kv.store.set(k, v),
}));

import { decideEdition } from '../src/api/edition';

describe('signatureChain follows the server-side edition decision', () => {
  beforeEach(() => kv.store.clear());

  it('is locked for a Standard license in any letter case', async () => {
    for (const capabilitySet of ['capabilityStandard', 'capabilitystandard', null]) {
      const d = await decideEdition({ active: true, capabilitySet }, { env: null });
      expect(d.features.signatureChain).toBe(false);
    }
  });

  it('is open for an Advanced license in any letter case', async () => {
    for (const capabilitySet of [
      'capabilityAdvanced',
      'capabilityadvanced',
      'CAPABILITYADVANCED',
    ]) {
      const d = await decideEdition({ active: true, capabilitySet }, { env: null });
      expect(d.features.signatureChain).toBe(true);
    }
  });

  it('honours the edition:override KVS on development, not on production', async () => {
    kv.store.set('edition:override', 'standard');
    const dev = await decideEdition(null, { env: null, environmentType: 'DEVELOPMENT' });
    expect(dev.features.signatureChain).toBe(false);
    const prod = await decideEdition(
      { active: true, capabilitySet: 'capabilityAdvanced' },
      { env: null, environmentType: 'PRODUCTION' },
    );
    expect(prod.features.signatureChain).toBe(true);
  });
});
