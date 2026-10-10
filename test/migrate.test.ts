import { describe, expect, it, vi } from 'vitest';
import {
  isAlreadyAppliedSchemaError,
  migrationNameFromError,
  runMigrationsWithRetry,
} from '../src/db/migrate';

describe('isAlreadyAppliedSchemaError', () => {
  it('detects duplicate column / key from concurrent ALTER', () => {
    expect(isAlreadyAppliedSchemaError(new Error("Duplicate column name 'campaign_run_id'"))).toBe(
      true,
    );
    expect(
      isAlreadyAppliedSchemaError({
        message: 'Failed to execute migration with name v033_review_campaign',
        cause: { message: "Duplicate column name 'campaign_run_id'" },
      }),
    ).toBe(true);
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
  it('checkpoints and continues when a peer already applied the DDL', async () => {
    const checkpoints: string[] = [];
    const run = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('Failed to execute migration with name v033_review_campaign'), {
          name: 'MigrationExecutionError',
          migrationName: 'v033_review_campaign',
          cause: new Error("Duplicate column name 'campaign_run_id'"),
        }),
      )
      .mockResolvedValueOnce(['v034_review_campaign_ix', 'v035_review_assignment']);

    const applied = await runMigrationsWithRetry(
      { enqueue: () => ({}) as never, run },
      4,
      async (name) => {
        checkpoints.push(name);
      },
    );
    expect(run).toHaveBeenCalledTimes(2);
    expect(applied).toEqual([
      'v033_review_campaign',
      'v034_review_campaign_ix',
      'v035_review_assignment',
    ]);
    expect(checkpoints).toEqual(['v033_review_campaign']);
  });

  it('rethrows non-benign migration failures without retrying', async () => {
    const run = vi.fn().mockRejectedValue(
      Object.assign(new Error('Failed to execute migration with name v033_review_campaign'), {
        name: 'MigrationExecutionError',
        migrationName: 'v033_review_campaign',
        cause: new Error('syntax error'),
      }),
    );
    await expect(
      runMigrationsWithRetry({ enqueue: () => ({}) as never, run }, 3, async () => undefined),
    ).rejects.toThrow(/v033_review_campaign/);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
