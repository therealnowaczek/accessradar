import { describe, expect, it, vi } from 'vitest';
import {
  isAlreadyAppliedSchemaError,
  migrationNameFromError,
  runMigrationsWithRetry,
} from '../src/db/migrate';

function execErr(name: string, cause: string) {
  return Object.assign(new Error(`Failed to execute migration with name ${name}`), {
    name: 'MigrationExecutionError',
    migrationName: name,
    cause: new Error(cause),
  });
}

describe('isAlreadyAppliedSchemaError', () => {
  it('treats duplicate column, table already exists, and duplicate index as applied', () => {
    expect(isAlreadyAppliedSchemaError(new Error("Duplicate column name 'campaign_run_id'"))).toBe(
      true,
    );
    expect(isAlreadyAppliedSchemaError(new Error("Table 'review_assignment' already exists"))).toBe(
      true,
    );
    expect(isAlreadyAppliedSchemaError(new Error("Duplicate key name 'ix_review_run'"))).toBe(true);
    expect(isAlreadyAppliedSchemaError(new Error("Duplicate index 'uq_review_chain'"))).toBe(true);
    expect(isAlreadyAppliedSchemaError({ message: 'ER_TABLE_EXISTS_ERROR', code: '1050' })).toBe(
      true,
    );
    expect(isAlreadyAppliedSchemaError(new Error('connection reset'))).toBe(false);
  });
});

describe('migrationNameFromError', () => {
  it('reads the Forge MigrationExecutionError message', () => {
    expect(
      migrationNameFromError(
        new Error('Failed to execute migration with name v033_review_campaign'),
      ),
    ).toBe('v033_review_campaign');
    expect(migrationNameFromError({ migrationName: 'v038_review_prev' })).toBe('v038_review_prev');
  });
});

describe('runMigrationsWithRetry', () => {
  it('checkpoints ALTER ADD COLUMN race (v033-style duplicate column)', async () => {
    const checkpoints: string[] = [];
    const run = vi
      .fn()
      .mockRejectedValueOnce(
        execErr('v033_review_campaign', "Duplicate column name 'campaign_run_id'"),
      )
      .mockResolvedValueOnce(['v034_review_campaign_ix']);

    const applied = await runMigrationsWithRetry(
      { enqueue: () => ({}) as never, run },
      4,
      async (name) => {
        checkpoints.push(name);
      },
    );
    expect(applied).toEqual(['v033_review_campaign', 'v034_review_campaign_ix']);
    expect(checkpoints).toEqual(['v033_review_campaign']);
  });

  it('checkpoints CREATE TABLE race (table already exists)', async () => {
    // v035 is CREATE TABLE review_assignment — concurrent first calls hit 1050.
    const checkpoints: string[] = [];
    const run = vi
      .fn()
      .mockRejectedValueOnce(
        execErr('v035_review_assignment', "Table 'review_assignment' already exists"),
      )
      .mockResolvedValueOnce(['v036_notice']);

    const applied = await runMigrationsWithRetry(
      { enqueue: () => ({}) as never, run },
      4,
      async (name) => {
        checkpoints.push(name);
      },
    );
    expect(run).toHaveBeenCalledTimes(2);
    expect(applied).toEqual(['v035_review_assignment', 'v036_notice']);
    expect(checkpoints).toEqual(['v035_review_assignment']);
  });

  it('checkpoints CREATE INDEX race (duplicate key / index name)', async () => {
    const checkpoints: string[] = [];
    const run = vi
      .fn()
      .mockRejectedValueOnce(
        execErr('v034_review_campaign_ix', "Duplicate key name 'ix_review_run'"),
      )
      .mockResolvedValueOnce(['v035_review_assignment']);

    const applied = await runMigrationsWithRetry(
      { enqueue: () => ({}) as never, run },
      4,
      async (name) => {
        checkpoints.push(name);
      },
    );
    expect(applied).toEqual(['v034_review_campaign_ix', 'v035_review_assignment']);
    expect(checkpoints).toEqual(['v034_review_campaign_ix']);
  });

  it('rethrows non-benign migration failures without retrying', async () => {
    const run = vi.fn().mockRejectedValue(execErr('v033_review_campaign', 'syntax error'));
    await expect(
      runMigrationsWithRetry({ enqueue: () => ({}) as never, run }, 3, async () => undefined),
    ).rejects.toThrow(/v033_review_campaign/);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
