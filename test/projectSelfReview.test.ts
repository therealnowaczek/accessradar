import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  defs: new Map<string, (req: any) => Promise<any>>(),
  isJiraAdmin: vi.fn(),
  assertProjectAdminister: vi.fn(),
  findOpen: vi.fn(),
  start: vi.fn(),
  decide: vi.fn(),
  edition: { edition: 'standard', source: 'license', features: {} as Record<string, boolean> },
}));

vi.mock('@forge/api', () => ({
  default: { asApp: () => ({}), asUser: () => ({}) },
  route: () => '',
  getAppContext: () => ({}),
  __getRuntime: () => ({ appContext: {} }),
}));
vi.mock('@forge/resolver', () => ({
  default: class {
    define(name: string, fn: (req: any) => Promise<any>) {
      m.defs.set(`${m.defs.size}:${name}`, fn);
    }
    getDefinitions() {
      return {};
    }
  },
}));
vi.mock('@forge/events', () => ({
  InvocationError: class {},
  InvocationErrorCode: {},
  Queue: class {},
}));
vi.mock('../src/db/migrations', () => ({ ensureMigrated: vi.fn(), runMigrations: vi.fn() }));
vi.mock('../src/collector/run', () => ({ runCollectStep: vi.fn(), scheduledTick: vi.fn() }));
vi.mock('../src/spike', () => ({
  runSpikeResolver: vi.fn(),
  spikeAllowed: () => false,
  spikeEnabled: () => false,
  spikeOnInstall: vi.fn(),
  spikeOnTick: vi.fn(),
  spikeProbe: vi.fn(),
  spikeSelfTest: vi.fn(),
}));
vi.mock('../src/lib/queue', () => ({ push: vi.fn() }));
vi.mock('../src/lib/projectAuth', () => ({
  assertProjectAdminister: m.assertProjectAdminister,
  isJiraAdmin: m.isJiraAdmin,
  assignmentAccess: () => 'not-assigned',
}));
vi.mock('../src/db/campaigns', () => ({ findOpenAssignmentForProject: m.findOpen }));
vi.mock('../src/api/edition', () => ({
  decideForInvocation: async () => m.edition,
  backgroundEdition: async () => m.edition,
  rememberInactiveLicense: vi.fn(),
  setEditionOverride: vi.fn(),
}));
vi.mock('../src/api/service', () => ({
  BadRequest: class BadRequest extends Error {},
  projectStartSelfReview: m.start,
  projectDecideItems: m.decide,
  projectMyAssignment: vi.fn(),
  projectSubmitAssignment: vi.fn(),
  projectDismissNotice: vi.fn(),
}));

import { ForbiddenError } from '../src/lib/auth';
import '../src/handlers';

const call = (name: string, ctx: Record<string, unknown>, payload: unknown = {}) => {
  const entry = [...m.defs].find(([k]) => k.endsWith(`:${name}`));
  if (!entry) throw new Error('no resolver ' + name);
  return entry[1]({
    payload,
    context: { license: { active: true, capabilitySet: 'capabilityStandard' }, ...ctx },
  });
};
const project = (id: string) => ({ extension: { project: { id } } });

describe('C8 project self review on Standard', () => {
  beforeEach(() => {
    m.isJiraAdmin.mockReset().mockResolvedValue(false);
    m.assertProjectAdminister.mockReset().mockResolvedValue(undefined);
    m.findOpen.mockReset().mockResolvedValue(null);
    m.start.mockReset().mockResolvedValue({ reviewId: 'r1', items: 3 });
    m.decide.mockReset().mockResolvedValue({ ok: true });
  });

  it('starts a review of the context space for a space admin on Standard', async () => {
    const r = await call('startSelfReview', { accountId: 'acc', ...project('10001') });
    expect(r).toEqual({ ok: true, data: { reviewId: 'r1', items: 3 } });
    expect(m.assertProjectAdminister).toHaveBeenCalledWith('acc', '10001');
    expect(m.start).toHaveBeenCalledWith('10001', 'acc');
  });

  it('ignores a project id in the payload: scope is the Forge context space only', async () => {
    await call(
      'startSelfReview',
      { accountId: 'acc', ...project('10001') },
      { projectId: '99999' },
    );
    expect(m.start).toHaveBeenCalledWith('10001', 'acc');
  });

  it('refuses a caller who is not a space admin, server side, without calling the service', async () => {
    m.assertProjectAdminister.mockRejectedValue(
      new ForbiddenError('Only a space admin can review access here'),
    );
    const r = await call('startSelfReview', { accountId: 'intruder', ...project('10001') });
    expect(r.ok).toBe(false);
    expect(r.forbidden).toBe(true);
    expect(m.start).not.toHaveBeenCalled();
  });

  it('refuses when the Forge context has no space, and for decisions too', async () => {
    const none = await call('startSelfReview', { accountId: 'acc' });
    expect(none).toMatchObject({ ok: false, forbidden: true });
    m.assertProjectAdminister.mockRejectedValue(new ForbiddenError('no'));
    const d = await call(
      'decideAssignedItems',
      { accountId: 'x', ...project('10001') },
      { id: 'r' },
    );
    expect(d.forbidden).toBe(true);
    expect(m.decide).not.toHaveBeenCalled();
  });

  it('a Jira admin may start without the space-admin check', async () => {
    m.isJiraAdmin.mockResolvedValue(true);
    await call('startSelfReview', { accountId: 'root', ...project('10001') });
    expect(m.assertProjectAdminister).not.toHaveBeenCalled();
    expect(m.start).toHaveBeenCalledWith('10001', 'root');
  });
});
