import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  appContext: {} as { license?: unknown; environmentType?: string },
  decide: vi.fn(),
  run: vi.fn(),
  admin: vi.fn(),
}));

vi.mock('@forge/api', () => ({
  getAppContext: () => m.appContext,
  __getRuntime: () => ({ appContext: { moduleKey: 'ar-review-status' } }),
}));
vi.mock('../src/api/edition', () => ({
  decideForInvocation: m.decide,
  rememberInactiveLicense: async () => undefined,
}));
vi.mock('../src/db/migrations', () => ({ ensureMigrated: async () => undefined }));
vi.mock('../src/lib/auth', () => ({
  ForbiddenError: class ForbiddenError extends Error {},
  assertJiraAdmin: m.admin,
}));
vi.mock('../src/rovo/actions', () => ({ runRovoAction: m.run }));

import { ROVO_REQUIRES_ADVANCED, rovoHandler } from '../src/rovo/handler';

const decision = (rovo: boolean) => ({
  edition: rovo ? 'advanced' : 'standard',
  features: { rovo },
});
const ctx = { principal: { accountId: 'acc-admin' } };

describe('rovo handler edition gate', () => {
  beforeEach(() => {
    m.appContext = {};
    m.decide.mockReset();
    m.run.mockReset();
    m.admin.mockReset().mockResolvedValue(undefined);
    m.run.mockResolvedValue({
      action: 'ar-review-status',
      rows: [],
      snapshotSeq: null,
      snapshotAt: null,
      openIn: '',
    });
  });

  it('refuses Standard sites with a clear message and runs no action', async () => {
    m.decide.mockResolvedValue(decision(false));
    const license = { active: true, capabilitySet: 'capabilitystandard' };
    const out = await rovoHandler({}, { ...ctx, license });
    expect(out).toEqual({ error: ROVO_REQUIRES_ADVANCED });
    expect(ROVO_REQUIRES_ADVANCED).toMatch(/Advanced edition/);
    expect(m.run).not.toHaveBeenCalled();
    expect(m.decide).toHaveBeenCalledWith(license, undefined);
  });

  it('runs the action on Advanced sites', async () => {
    m.decide.mockResolvedValue(decision(true));
    const out = await rovoHandler(
      { campaign: 'Q4' },
      {
        ...ctx,
        license: { active: true, capabilitySet: 'capabilityadvanced' },
      },
    );
    expect(out).toMatchObject({ action: 'ar-review-status' });
    expect(m.run).toHaveBeenCalledWith('ar-review-status', { campaign: 'Q4' }, 'acc-admin');
  });

  it('falls back to the runtime app context for license and environment type', async () => {
    m.decide.mockResolvedValue(decision(false));
    const license = { active: true, capabilitySet: 'capabilitystandard' };
    m.appContext = { license, environmentType: 'DEVELOPMENT' };
    const out = await rovoHandler({}, ctx);
    expect(out).toEqual({ error: ROVO_REQUIRES_ADVANCED });
    expect(m.decide).toHaveBeenCalledWith(license, 'DEVELOPMENT');
  });

  it('checks the license and admin rights before the edition', async () => {
    const out = await rovoHandler({}, { ...ctx, license: { active: false } });
    expect(out).toEqual({ error: expect.stringMatching(/active license/) });
    expect(m.decide).not.toHaveBeenCalled();
    expect(m.run).not.toHaveBeenCalled();
  });
});
