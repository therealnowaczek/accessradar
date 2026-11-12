import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ requestJira: vi.fn() }));
vi.mock('./jira', () => ({
  client: () => ({ requestJira: m.requestJira }),
  route: (s: TemplateStringsArray, ...v: unknown[]) =>
    s.reduce((a, p, i) => a + p + (i < v.length ? String(v[i]) : ''), ''),
}));

import { auditChanges, securityLevels, sharedItems } from './exposure';

const reply = (status: number, body: unknown) => ({
  ok: status < 400,
  status,
  json: async () => body,
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
});

describe('exposure (read-only, consent-aware)', () => {
  beforeEach(() => m.requestJira.mockReset());

  it('reports missing consent instead of throwing (401 scope does not match)', async () => {
    m.requestJira.mockResolvedValue(reply(401, 'Unauthorized; scope does not match'));
    expect(await sharedItems()).toMatchObject({ status: 'needs-consent' });
    expect(await securityLevels()).toMatchObject({ status: 'needs-consent' });
    expect(await auditChanges()).toMatchObject({ status: 'needs-consent' });
  });

  it('passes a plan limit through as unavailable with Jira message', async () => {
    m.requestJira.mockResolvedValue(
      reply(403, { message: "Audit logs aren't available for this site." }),
    );
    expect(await auditChanges()).toEqual({
      status: 'unavailable',
      reason: "Audit logs aren't available for this site.",
    });
  });

  it('lists only anyone / signed-in shares, widest first classification', async () => {
    m.requestJira
      .mockResolvedValueOnce(
        reply(200, {
          isLast: true,
          values: [
            {
              id: 1,
              name: 'A',
              owner: { displayName: 'Ann' },
              sharePermissions: [{ type: 'global' }],
            },
            {
              id: 2,
              name: 'B',
              owner: { displayName: 'Bob' },
              sharePermissions: [{ type: 'project' }],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        reply(200, {
          isLast: true,
          values: [
            {
              id: 3,
              name: 'D',
              owner: { displayName: 'Cy' },
              sharePermissions: [{ type: 'loggedin' }],
            },
          ],
        }),
      );
    const r = await sharedItems();
    expect(r).toMatchObject({ status: 'ok', counts: { anyone: 1, loggedin: 1, total: 3 } });
    if (r.status === 'ok') expect(r.items.map((i) => i.name)).toEqual(['A', 'D']);
  });

  it('only issues GET requests', async () => {
    m.requestJira.mockResolvedValue(
      reply(200, { isLast: true, values: [], records: [], issueSecuritySchemes: [] }),
    );
    await sharedItems();
    await securityLevels();
    await auditChanges();
    for (const call of m.requestJira.mock.calls)
      expect((call[1] as { method?: string }).method).toBeUndefined();
  });
});
