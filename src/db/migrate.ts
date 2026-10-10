import sql, { migrationRunner } from '@forge/sql';
import { errInfo } from '../lib/errors';

/**
 * Detect DDL that already ran on a peer (or a prior half-finished apply).
 * Covers concurrent CREATE TABLE, ALTER ADD COLUMN, and CREATE INDEX:
 * - table already exists (1050 / ER_TABLE_EXISTS_ERROR)
 * - duplicate column (1060 / ER_DUP_FIELDNAME)
 * - duplicate index / key name (1061 / ER_DUP_KEYNAME)
 * Forge wraps the driver error in MigrationExecutionError.cause.
 */
export function isAlreadyAppliedSchemaError(e: unknown): boolean {
  const parts = [e];
  let cur: unknown = e;
  for (let i = 0; i < 4 && cur && typeof cur === 'object'; i++) {
    const c = (cur as { cause?: unknown }).cause;
    if (c) parts.push(c);
    cur = c;
  }
  const text = parts.map((x) => String((x as { message?: string })?.message ?? x)).join(' ');
  return (
    /duplicate column/i.test(text) ||
    /duplicate key name/i.test(text) ||
    /duplicate index/i.test(text) ||
    /table ['"`]?[\w.-]+['"`]? already exists/i.test(text) ||
    /already exists/i.test(text) ||
    /\b1060\b/.test(text) || // ER_DUP_FIELDNAME
    /\b1061\b/.test(text) || // ER_DUP_KEYNAME
    /\b1050\b/.test(text) || // ER_TABLE_EXISTS_ERROR
    /ER_DUP_FIELDNAME/i.test(text) ||
    /ER_DUP_KEYNAME/i.test(text) ||
    /ER_TABLE_EXISTS_ERROR/i.test(text)
  );
}

export function migrationNameFromError(e: unknown): string | null {
  const err = e as { migrationName?: string; message?: string };
  if (typeof err?.migrationName === 'string' && err.migrationName) return err.migrationName;
  const m = String(err?.message ?? '').match(/Failed to execute migration with name (.+)$/);
  return m?.[1]?.trim() || null;
}

function isMigrationExecutionError(e: unknown): boolean {
  const err = e as { name?: string; message?: string };
  return (
    err?.name === 'MigrationExecutionError' ||
    /^Failed to execute migration with name /.test(String(err?.message ?? ''))
  );
}

function isMigrationCheckPointError(e: unknown): boolean {
  const err = e as { name?: string; message?: string };
  return (
    err?.name === 'MigrationCheckPointError' ||
    /^Failed to checkpoint after running migration with name /.test(String(err?.message ?? ''))
  );
}

/** Record a migration name as applied (idempotent if a peer already inserted the row). */
export async function ensureMigrationCheckpoint(name: string): Promise<void> {
  try {
    await sql.prepare('INSERT INTO __migrations (name) VALUES (?)').bindParams(name).execute();
  } catch (e) {
    if (!/duplicate/i.test(String((e as { message?: string })?.message ?? e))) throw e;
  }
}

type Runner = {
  enqueue: (name: string, statement: string) => Runner;
  run: () => Promise<string[]>;
};

/**
 * Run pending migrations; if a concurrent first call already applied a DDL
 * (e.g. ALTER ADD COLUMN), record the checkpoint and continue instead of failing resolvers.
 */
export async function runMigrationsWithRetry(
  runner: Runner,
  maxAttempts = 8,
  checkpoint: (name: string) => Promise<void> = ensureMigrationCheckpoint,
): Promise<string[]> {
  const applied: string[] = [];
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const batch = await runner.run();
      applied.push(...batch);
      return applied;
    } catch (e) {
      const name = migrationNameFromError(e);
      if (isMigrationExecutionError(e) && name && isAlreadyAppliedSchemaError(e)) {
        console.warn('[migrate] already applied (concurrent)', { name, ...errInfo(e) });
        await checkpoint(name);
        applied.push(name);
        continue;
      }
      if (isMigrationCheckPointError(e) && name) {
        // DDL ran; checkpoint insert raced with a peer — ensure row exists and continue.
        console.warn('[migrate] checkpoint race', { name, ...errInfo(e) });
        await checkpoint(name);
        applied.push(name);
        continue;
      }
      throw e;
    }
  }
  throw new Error(`Migrations failed after ${maxAttempts} concurrent retries`);
}

/** Default runner used in production (Forge SQL singleton). */
export function forgeMigrationRunner(): Runner {
  return migrationRunner as unknown as Runner;
}
