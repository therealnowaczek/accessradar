import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  asUser: vi.fn(),
  asApp: vi.fn(),
  installationAri: 'ari:cloud:ecosystem::installation/site-a' as string | undefined,
}));

vi.mock('@forge/api', () => ({
  default: {
    asUser: () => ({ requestJira: m.asUser }),
    asApp: () => ({ requestJira: m.asApp }),
  },
  route: (s: TemplateStringsArray) => s.join(''),
  getAppContext: () => ({ installationAri: m.installationAri }),
}));

import {
  _resetAdminCache,
  ADMIN_ONLY_MESSAGE,
  assertJiraAdmin,
  ForbiddenError,
  myPermissionsAdminister,
} from '../src/lib/auth';

const json = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});
const mine = (admin: boolean) =>
  json(200, { permissions: { ADMINISTER: { havePermission: admin } } });
const check = (admin: boolean) => json(200, { globalPermissions: admin ? ['ADMINISTER'] : [] });

describe('assertJiraAdmin', () => {
  beforeEach(() => {
    _resetAdminCache();
    m.asUser.mockReset();
    m.asApp.mockReset();
    m.installationAri = 'ari:cloud:ecosystem::installation/site-a';
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('asUser path: user-first checks mypermissions as the caller and never calls asApp', async () => {
    m.asUser.mockResolvedValue(mine(true));
    await expect(assertJiraAdmin('acc-1', { prefer: 'user' })).resolves.toBeUndefined();
    expect(m.asUser).toHaveBeenCalledTimes(1);
    expect(m.asApp).not.toHaveBeenCalled();
  });

  it('MCP path (allowApp false): asApp is never called, even when asUser fails', async () => {
    m.asUser.mockRejectedValue(new Error('NeedsAuthenticationError'));
    await expect(assertJiraAdmin('acc-1', { prefer: 'user', allowApp: false })).rejects.toThrow(
      'Authorization check failed',
    );
    expect(m.asApp).not.toHaveBeenCalled();
  });

  it('asApp throwing (admin UI default) falls back to the caller', async () => {
    m.asApp.mockRejectedValue(new Error('asApp is not allowed for this invocation'));
    m.asUser.mockResolvedValue(mine(true));
    await expect(assertJiraAdmin('acc-1')).resolves.toBeUndefined();
    expect(m.asApp).toHaveBeenCalledTimes(1);
    expect(m.asUser).toHaveBeenCalledTimes(1);
  });

  it('asApp non-2xx falls back to the caller; user-first falls back to asApp when allowed', async () => {
    m.asApp.mockResolvedValueOnce(json(403, {}));
    m.asUser.mockResolvedValueOnce(mine(true));
    await assertJiraAdmin('acc-1');
    _resetAdminCache();
    m.asUser.mockResolvedValueOnce(json(401, {}));
    m.asApp.mockResolvedValueOnce(check(true));
    await expect(assertJiraAdmin('acc-2', { prefer: 'user' })).resolves.toBeUndefined();
  });

  it('denies non-admins with the admin-only message', async () => {
    m.asUser.mockResolvedValue(mine(false));
    const err = await assertJiraAdmin('acc-1', { prefer: 'user', allowApp: false }).catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenError);
    expect(err.message).toBe(ADMIN_ONLY_MESSAGE);
    m.asApp.mockResolvedValue(check(false));
    await expect(assertJiraAdmin('acc-3')).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('denies a missing accountId without any Jira call', async () => {
    await expect(assertJiraAdmin('', { prefer: 'user' })).rejects.toBeInstanceOf(ForbiddenError);
    expect(m.asUser).not.toHaveBeenCalled();
    expect(m.asApp).not.toHaveBeenCalled();
  });

  it('caches a positive answer per installation, never across installations', async () => {
    m.asUser.mockResolvedValue(mine(true));
    await assertJiraAdmin('acc-1', { prefer: 'user', allowApp: false });
    await assertJiraAdmin('acc-1', { prefer: 'user', allowApp: false });
    expect(m.asUser).toHaveBeenCalledTimes(1);
    m.installationAri = 'ari:cloud:ecosystem::installation/site-b';
    m.asUser.mockResolvedValue(mine(false));
    await expect(
      assertJiraAdmin('acc-1', { prefer: 'user', allowApp: false }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    m.installationAri = undefined;
    m.asUser.mockResolvedValue(mine(true));
    await assertJiraAdmin('acc-1', { prefer: 'user', allowApp: false });
    await assertJiraAdmin('acc-1', { prefer: 'user', allowApp: false });
    expect(m.asUser).toHaveBeenCalledTimes(4);
  });

  it('parses mypermissions strictly', () => {
    expect(myPermissionsAdminister({ permissions: { ADMINISTER: { havePermission: true } } })).toBe(
      true,
    );
    expect(
      myPermissionsAdminister({ permissions: { ADMINISTER: { havePermission: 'yes' } } }),
    ).toBe(false);
    expect(myPermissionsAdminister(null)).toBe(false);
  });
});
