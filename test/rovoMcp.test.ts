import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  appContext: {} as { license?: unknown; environmentType?: string },
  admin: vi.fn(),
  decide: vi.fn(),
  audit: vi.fn(),
}));

vi.mock('@forge/api', () => ({
  getAppContext: () => m.appContext,
  __getRuntime: () => ({ appContext: {} }),
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
vi.mock('../src/db/audit', () => ({ audit: m.audit }));
vi.mock('../src/db/settings', () => ({
  getSettings: async () => ({ keyPermissions: ['ADMINISTER_PROJECTS', 'BROWSE_PROJECTS'] }),
}));
vi.mock('../src/db/snapshots', () => {
  const snap = (seq: number) => ({ seq, status: 'complete', startedAt: seq, finishedAt: seq });
  return {
    latestCommitted: async () => snap(2),
    previousCommitted: async () => snap(1),
    listSnapshots: async () => [snap(2), snap(1)],
  };
});
vi.mock('../src/db/reviews', () => ({
  listReviews: async () =>
    Array.from({ length: 60 }, (_, i) => ({
      name: `Review ${i}`,
      status: 'open',
      dueAt: null,
      itemCount: 3,
      decided: 1,
      chainSeq: null,
      campaignRunId: null,
    })),
}));
vi.mock('../src/db/campaigns', () => ({
  listCampaigns: async () => [],
  campaignIdByRun: async () => new Map(),
}));
vi.mock('../src/api/service', () => {
  class BadRequest extends Error {}
  const subject = { id: 'acc-dana', name: 'Dana Kowal', type: 'user' };
  const perms = {
    ADMINISTER_PROJECTS: [{ text: 'Role Administrators' }, { text: 'group jira-admins' }],
  };
  return {
    BadRequest,
    stateFor: async () => ({
      projects: new Map([['10001', { key: 'PAY', name: 'Payments' }]]),
      persons: new Map([['acc-dana', { displayName: 'Dana Kowal' }]]),
      memberOf: new Map(),
    }),
    projectDetail: async () => ({ data: { project: { key: 'PAY' }, rows: [{ subject, perms }] } }),
    personInfo: async () => ({
      data: { person: { name: 'Dana Kowal' }, projects: [{ project: { key: 'PAY' }, perms }] },
    }),
    changes: async () => ({
      a: { seq: 1 },
      b: { seq: 2 },
      granted: [{ subject, project: { key: 'PAY' }, permission: 'ADMINISTER_PROJECTS' }],
      revoked: [],
    }),
  };
});

import { ROVO_NO_LICENSE_STANDARD, ROVO_REQUIRES_ADVANCED, rovoHandler } from '../src/rovo/handler';
import { detectSurface } from '../src/rovo/invocation';

const ADVANCED = { active: true, capabilitySet: 'capabilityadvanced' };
const STANDARD = { active: true, capabilitySet: 'capabilitystandard' };
const decision = (rovo: boolean) => ({
  edition: rovo ? 'advanced' : 'standard',
  features: { rovo },
});

/** Payload shape of an MCP tool call: inputs at the top level plus Forge's `context`. */
const mcpPayload = (moduleKey: string, inputs: Record<string, unknown> = {}) => ({
  ...inputs,
  context: { cloudId: 'cloud-1', moduleKey, source: 'mcp' },
});
const ctx = (license: typeof ADVANCED | null = ADVANCED) => ({
  principal: { accountId: 'acc-admin' },
  license,
  environmentType: 'PRODUCTION',
});

const TOOLS: Array<[string, Record<string, unknown>, (r: any) => void]> = [
  [
    'ar-who-can-access',
    { projectKey: 'pay', permission: 'ADMINISTER_PROJECTS' },
    (r) => expect(r.rows[0]).toMatchObject({ subject: 'Dana Kowal', project: 'PAY' }),
  ],
  [
    'ar-why',
    { projectKey: 'PAY', name: 'Dana Kowal' },
    (r) => expect(r.rows[0].why).toMatch(/Role Administrators/),
  ],
  [
    'ar-person-access',
    { accountId: 'acc-dana' },
    (r) => expect(r.rows[0]).toMatchObject({ project: 'PAY', person: 'Dana Kowal' }),
  ],
  [
    'ar-changes-since',
    { sinceSeq: '1' },
    (r) => expect(r.rows[0]).toMatchObject({ change: 'granted', project: 'PAY' }),
  ],
  [
    'ar-review-status',
    {},
    (r) => {
      expect(r.rows).toHaveLength(50);
      expect(r.note).toMatch(/first 50 of 60/);
    },
  ],
];

describe('rovo:mcp tools (MCP-context invocation)', () => {
  beforeEach(() => {
    m.appContext = {};
    m.admin.mockReset().mockResolvedValue(undefined);
    m.decide.mockReset().mockResolvedValue(decision(true));
    m.audit.mockReset().mockResolvedValue(undefined);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it.each(TOOLS)('%s runs over MCP as the user only (no asApp)', async (key, inputs, verify) => {
    const out = (await rovoHandler(mcpPayload(key, inputs), ctx())) as any;
    expect(out.error).toBeUndefined();
    expect(out.action).toBe(key);
    expect(out.rows.length).toBeLessThanOrEqual(50);
    verify(out);
    expect(m.admin).toHaveBeenCalledWith('acc-admin', { prefer: 'user', allowApp: false });
    expect(m.audit).toHaveBeenCalledWith('acc-admin', 'rovo.action', null, expect.anything());
  });

  it('agent (non-MCP) calls are also user-first, with asApp only as a fallback', async () => {
    const out = (await rovoHandler(
      { context: { moduleKey: 'ar-review-status', jira: {} } },
      ctx(),
    )) as any;
    expect(out.action).toBe('ar-review-status');
    expect(m.admin).toHaveBeenCalledWith('acc-admin', { prefer: 'user', allowApp: true });
  });

  it('Standard over MCP: clear "requires Advanced" answer and no data', async () => {
    m.decide.mockResolvedValue(decision(false));
    const out = await rovoHandler(
      mcpPayload('ar-who-can-access', { projectKey: 'PAY' }),
      ctx(STANDARD),
    );
    expect(out).toEqual({ error: ROVO_REQUIRES_ADVANCED });
    expect(m.audit).not.toHaveBeenCalled();
  });

  it('licence from the runtime app context when the MCP payload carries none', async () => {
    m.appContext = { license: ADVANCED, environmentType: 'PRODUCTION' };
    const out = (await rovoHandler(mcpPayload('ar-review-status'), {
      principal: { accountId: 'acc-admin' },
    })) as any;
    expect(out.action).toBe('ar-review-status');
    expect(m.decide).toHaveBeenCalledWith(ADVANCED, 'PRODUCTION');
  });

  it('no licence anywhere on production: Standard, before any Jira call or SQL', async () => {
    const out = await rovoHandler(mcpPayload('ar-review-status'), ctx(null));
    expect(out).toEqual({ error: ROVO_NO_LICENSE_STANDARD });
    expect(ROVO_NO_LICENSE_STANDARD).toMatch(/requires the Advanced edition/);
    expect(m.admin).not.toHaveBeenCalled();
    expect(m.decide).not.toHaveBeenCalled();
  });

  it('no licence on development keeps the development default', async () => {
    const out = (await rovoHandler(mcpPayload('ar-review-status'), {
      principal: { accountId: 'acc-admin' },
      environmentType: 'DEVELOPMENT',
    })) as any;
    expect(out.action).toBe('ar-review-status');
    expect(m.decide).toHaveBeenCalledWith(null, 'DEVELOPMENT');
  });

  it('non-admin over MCP is denied with the admin-only message', async () => {
    const { ForbiddenError } = await import('../src/lib/auth');
    m.admin.mockRejectedValue(
      new ForbiddenError('AccessRadar is available to Jira administrators only'),
    );
    const out = await rovoHandler(mcpPayload('ar-who-can-access', { projectKey: 'PAY' }), ctx());
    expect(out).toEqual({ error: 'AccessRadar is available to Jira administrators only' });
    expect(m.decide).not.toHaveBeenCalled();
  });

  it('missing principal is passed as empty (denied by the admin check)', async () => {
    await rovoHandler(mcpPayload('ar-review-status'), {
      license: ADVANCED,
      environmentType: 'PRODUCTION',
    });
    expect(m.admin).toHaveBeenCalledWith('', { prefer: 'user', allowApp: false });
  });
});

describe('invocation surface detection', () => {
  it('spots MCP hints and defaults to rovo', () => {
    expect(detectSurface({ context: { invocationType: 'MCP_TOOL' } }, {})).toBe('mcp');
    expect(detectSurface({}, { source: { client: 'external-mcp' } })).toBe('mcp');
    expect(detectSurface({ context: { mcp: { clientName: 'Claude' } } }, {})).toBe('mcp');
    expect(detectSurface({ context: { moduleKey: 'ar-why', jira: {} } }, {})).toBe('rovo');
    expect(detectSurface(undefined, undefined)).toBe('rovo');
  });
});

describe('manifest rovo:mcp module', () => {
  const manifest = parse(readFileSync('manifest.yml', 'utf8'));
  const mcp = manifest.modules['rovo:mcp'];

  it('one module, name within 30 characters, exactly the five read-only actions', () => {
    expect(mcp).toHaveLength(1);
    expect(mcp[0].name.length).toBeLessThanOrEqual(30);
    expect(mcp[0].tools).toEqual([
      'ar-who-can-access',
      'ar-why',
      'ar-person-access',
      'ar-changes-since',
      'ar-review-status',
    ]);
    const actions = new Map(manifest.modules.action.map((a: any) => [a.key, a]));
    for (const key of mcp[0].tools) {
      const a = actions.get(key) as any;
      expect(a, key).toBeTruthy();
      expect(a.actionVerb).toBe('GET');
      expect(a.function).toBe('ar-rovo');
      expect(key.length).toBeLessThan(64);
    }
  });

  it('keeps Runs on Atlassian: no egress, no remotes, no Connect', () => {
    expect(manifest.permissions.external).toBeUndefined();
    expect(manifest.remotes).toBeUndefined();
    expect(manifest.connectModules).toBeUndefined();
    expect(manifest.app.connect).toBeUndefined();
  });
});
