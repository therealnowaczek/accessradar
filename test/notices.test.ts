import { beforeEach, describe, expect, it, vi } from 'vitest';

const { qMock, execMock } = vi.hoisted(() => ({
  qMock: vi.fn(),
  execMock: vi.fn(),
}));

vi.mock('../src/db/sql', () => ({
  q: (...args: unknown[]) => qMock(...args),
  exec: (...args: unknown[]) => execMock(...args),
  limitClause: (n: number) => `LIMIT ${n}`,
}));

import {
  countUndismissed,
  dismissNotices,
  insertNotice,
  listNotices,
  purgeNotices,
} from '../src/db/notices';

describe('notices db', () => {
  beforeEach(() => {
    qMock.mockReset();
    execMock.mockReset();
  });

  it('insertNotice writes a row and returns LAST_INSERT_ID', async () => {
    execMock.mockResolvedValueOnce(1);
    qMock.mockResolvedValueOnce([{ id: 42 }]);
    const id = await insertNotice({
      kind: 'alert:new-admin',
      audience: 'admin',
      severity: 'high',
      title: 'New Jira admin',
      body: 'Someone gained admin',
      refId: 'seq:12',
    });
    expect(id).toBe(42);
    expect(execMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO notice'),
      'alert:new-admin',
      'admin',
      null,
      null,
      'seq:12',
      'high',
      'New Jira admin',
      'Someone gained admin',
      expect.any(Number),
    );
  });

  it('countUndismissed scopes by audience and optional kind prefix', async () => {
    qMock.mockResolvedValueOnce([{ n: 3 }]);
    await expect(countUndismissed({ audience: 'admin', kindPrefix: 'alert:' })).resolves.toBe(3);
    expect(qMock.mock.calls[0][0]).toContain('kind LIKE ?');
    expect(qMock.mock.calls[0]).toContain('alert:%');
  });

  it('listNotices defaults to undismissed and pages', async () => {
    qMock.mockResolvedValueOnce([{ n: 1 }]).mockResolvedValueOnce([
      {
        id: 7,
        kind: 'reminder',
        audience: 'project',
        project_id: '10001',
        account_id: null,
        ref_id: 'r1',
        severity: 'medium',
        title: 'Review due',
        body: null,
        created_at: 1,
        dismissed_by: null,
        dismissed_at: null,
      },
    ]);
    const out = await listNotices({ audience: 'project', projectId: '10001', page: 1 });
    expect(out.total).toBe(1);
    expect(out.items[0]).toMatchObject({
      id: 7,
      kind: 'reminder',
      projectId: '10001',
      dismissedAt: null,
    });
    expect(qMock.mock.calls[1][0]).toContain('dismissed_at IS NULL');
  });

  it('dismissNotices updates only undismissed ids', async () => {
    execMock.mockResolvedValueOnce(2);
    await expect(dismissNotices([1, 1, 2, -3], 'admin-1', 99)).resolves.toBe(2);
    expect(execMock).toHaveBeenCalledWith(
      expect.stringContaining('dismissed_at IS NULL'),
      'admin-1',
      99,
      1,
      2,
    );
  });

  it('purgeNotices deletes in batches until short page', async () => {
    execMock.mockResolvedValueOnce(5000).mockResolvedValueOnce(12);
    await expect(purgeNotices(1000)).resolves.toBe(5012);
    expect(execMock).toHaveBeenCalledTimes(2);
  });
});
