import { beforeEach, describe, expect, it, vi } from 'vitest';

const execute = vi.fn();
vi.mock('@forge/sql', () => {
  const sql = { prepare: () => ({ bindParams: () => ({ execute }) }) };
  return { default: sql, sql, migrationRunner: { enqueue: vi.fn() } };
});

import { exec, q } from '../src/db/sql';
import { ensureMigrationCheckpoint, runMigrationsWithRetry } from '../src/db/migrate';
import {
  noteSqlRequest,
  resetSqlRequestCount,
  sqlRequestCount,
  sqlRequestMillis,
} from '../src/db/sqlCount';

describe('SQL request counter', () => {
  beforeEach(() => {
    resetSqlRequestCount();
    execute.mockReset();
  });

  it('counts every q and exec call', async () => {
    execute.mockResolvedValueOnce({ rows: [{ a: 1 }] });
    execute.mockResolvedValueOnce({ rows: { affectedRows: 3 } });
    expect(await q('SELECT 1')).toEqual([{ a: 1 }]);
    expect(await exec('DELETE FROM t WHERE id = ?', 1)).toBe(3);
    expect(sqlRequestCount()).toBe(2);
  });

  it('counts failed requests too, since Forge bills them', async () => {
    execute.mockRejectedValueOnce(new Error('boom'));
    await expect(q('SELECT 1')).rejects.toThrow('boom');
    expect(sqlRequestCount()).toBe(1);
  });

  it('resets count and summed time', () => {
    noteSqlRequest(4, 25);
    expect(sqlRequestCount()).toBe(4);
    expect(sqlRequestMillis()).toBe(25);
    resetSqlRequestCount();
    expect(sqlRequestCount()).toBe(0);
    expect(sqlRequestMillis()).toBe(0);
  });

  it('counts the migration checkpoint insert', async () => {
    execute.mockResolvedValueOnce({ rows: {} });
    await ensureMigrationCheckpoint('v001');
    expect(sqlRequestCount()).toBe(1);
  });

  it('counts migration runner statements: baseline plus DDL and checkpoint per migration', async () => {
    const runner = { enqueue: vi.fn(), run: vi.fn().mockResolvedValue(['v038', 'v039']) };
    runner.enqueue.mockReturnValue(runner);
    await runMigrationsWithRetry(runner);
    expect(sqlRequestCount()).toBe(6);
    resetSqlRequestCount();
    runner.run.mockResolvedValue([]);
    await runMigrationsWithRetry(runner);
    expect(sqlRequestCount()).toBe(2);
  });
});
