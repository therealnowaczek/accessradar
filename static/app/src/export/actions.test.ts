/**
 * Space access export (Spaces → space → Export → CSV). E2E 2.2 (phase 1): no file arrived because
 * the browser fetched the whole-site matrix with every permission and filtered it locally.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ call: vi.fn(), downloadCsv: vi.fn(), downloadMarkdown: vi.fn() }));

vi.mock('../api', () => ({ call: m.call }));
vi.mock('./download', () => ({
  downloadCsv: m.downloadCsv,
  downloadMarkdown: m.downloadMarkdown,
  downloadPdf: vi.fn(),
}));

import { exportMatrix } from './actions';
import { parseCsv } from './csv';

const snapshot = {
  seq: 34,
  status: 'complete',
  trigger: 'manual',
  collectorMode: 'app',
  engineVersion: '1',
  startedAt: Date.UTC(2026, 10, 11, 18),
  finishedAt: Date.UTC(2026, 10, 11, 18, 5),
  updatedAt: Date.UTC(2026, 10, 11, 18, 5),
  contentHash: 'c'.repeat(64),
};
const row = (key: string, name: string) => ({
  project_key: key,
  project_name: key,
  project_style: 'team',
  subject_type: 'user',
  subject_id: `id-${name}`,
  display_name: name,
  account_type: 'atlassian',
  active: 'yes',
  permission: 'BROWSE_PROJECTS',
  path: 'role Administrators',
  path_codes: 'role',
  completeness_flag: 'complete',
});

function server(rows: Array<Record<string, string>>) {
  m.call.mockImplementation(async (key: string, payload: Record<string, unknown>) => {
    if (key === 'accessMatrix') {
      const k = payload.projectKey as string | undefined;
      return { snapshot, data: k ? rows.filter((r) => r.project_key === k) : rows };
    }
    if (key === 'exploreProjects') {
      return {
        snapshot,
        data: [...new Set(rows.map((r) => r.project_key))].map((k) => ({ key: k })),
      };
    }
    if (key === 'getSnapshot') return { ...snapshot, coverage: [], limitations: undefined };
    if (key === 'getOverview') return { risks: [] };
    if (key === 'logExport') return { logged: true };
    throw new Error(`unexpected ${key}`);
  });
}

describe('exportMatrix', () => {
  beforeEach(() => {
    m.call.mockReset();
    m.downloadCsv.mockReset();
    m.downloadMarkdown.mockReset();
  });

  it('space CSV asks the server for that space only and downloads one file', async () => {
    server([row('ARTEST', 'Ann'), row('PAY', 'Bob'), row('ARTEST', 'Cid')]);
    const n = await exportMatrix('csv', 34, { siteUrl: 'https://x.atlassian.net' }, 'ARTEST');
    expect(n).toBe(2);
    const matrixCall = m.call.mock.calls.find(([k]) => k === 'accessMatrix')!;
    expect(matrixCall[1]).toMatchObject({ seq: 34, allPermissions: true, projectKey: 'ARTEST' });
    expect(m.downloadCsv).toHaveBeenCalledTimes(1);
    const [name, csv] = m.downloadCsv.mock.calls[0] as [string, string];
    expect(name).toMatch(/_ARTEST\.csv$/);
    const table = parseCsv(csv).filter((r) => !r[0]?.startsWith('#'));
    const col = table.findIndex((r) => r.includes('project_key'));
    const keyAt = table[col].indexOf('project_key');
    const keys = table
      .slice(col + 1)
      .map((r) => r[keyAt])
      .filter(Boolean);
    expect(keys).toEqual(['ARTEST', 'ARTEST']);
    expect(m.call).toHaveBeenCalledWith(
      'logExport',
      expect.objectContaining({ kind: 'matrix-csv' }),
    );
  });

  it('site CSV fetches one space per call (response size limit) and joins the rows', async () => {
    server([row('ARTEST', 'Ann'), row('PAY', 'Bob')]);
    expect(await exportMatrix('csv', null, {})).toBe(2);
    const keys = m.call.mock.calls
      .filter(([k]) => k === 'accessMatrix')
      .map(([, pl]) => (pl as { projectKey: string }).projectKey);
    expect(keys.sort()).toEqual(['ARTEST', 'PAY']);
    expect(m.downloadCsv).toHaveBeenCalledTimes(1);
  });

  it('fails visibly (no silent no-op) when there is no snapshot', async () => {
    m.call.mockResolvedValue({ snapshot: null, data: null });
    await expect(exportMatrix('csv', null, {}, 'ARTEST')).rejects.toThrow('No snapshot to export');
    expect(m.downloadCsv).not.toHaveBeenCalled();
  });
});
