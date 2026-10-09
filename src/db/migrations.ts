import { migrationRunner } from '@forge/sql';

/**
 * Forge SQL schema (stub, week 1). Rules: one DDL per statement, no trailing semicolon,
 * no foreign keys, idempotent (IF NOT EXISTS). Facts use SCD2 validity intervals
 * (first_seen/last_seen = snapshot seq). Upserts via INSERT ... ON DUPLICATE KEY UPDATE.
 */
export const MIGRATIONS: ReadonlyArray<[name: string, ddl: string]> = [
  [
    'v001_snapshot',
    `CREATE TABLE IF NOT EXISTS snapshot (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      seq INT NOT NULL,
      started_at DATETIME(3) NOT NULL,
      finished_at DATETIME(3) NULL,
      status VARCHAR(16) NOT NULL,
      trigger_kind VARCHAR(16) NOT NULL,
      collector_mode VARCHAR(16) NOT NULL,
      engine_version VARCHAR(32) NOT NULL,
      completeness_json TEXT NULL,
      points_estimate INT NULL,
      content_hash CHAR(64) NULL,
      UNIQUE KEY uq_snapshot_seq (seq)
    )`,
  ],
  [
    'v002_project',
    `CREATE TABLE IF NOT EXISTS project (
      project_id VARCHAR(32) NOT NULL,
      project_key VARCHAR(64) NOT NULL,
      name VARCHAR(255) NOT NULL,
      style VARCHAR(16) NOT NULL,
      scheme_id VARCHAR(32) NULL,
      first_seen INT NOT NULL,
      last_seen INT NOT NULL,
      PRIMARY KEY (project_id, first_seen)
    )`,
  ],
  [
    'v003_perm_grant',
    `CREATE TABLE IF NOT EXISTS perm_grant (
      scheme_id VARCHAR(32) NOT NULL,
      grant_id VARCHAR(32) NOT NULL,
      permission VARCHAR(128) NOT NULL,
      holder_type VARCHAR(64) NOT NULL,
      holder_value VARCHAR(255) NOT NULL,
      first_seen INT NOT NULL,
      last_seen INT NOT NULL,
      PRIMARY KEY (scheme_id, grant_id, first_seen)
    )`,
  ],
  [
    'v004_role_actor',
    `CREATE TABLE IF NOT EXISTS role_actor (
      project_id VARCHAR(32) NOT NULL,
      role_id VARCHAR(32) NOT NULL,
      actor_type VARCHAR(8) NOT NULL,
      actor_id VARCHAR(128) NOT NULL,
      first_seen INT NOT NULL,
      last_seen INT NOT NULL,
      PRIMARY KEY (project_id, role_id, actor_type, actor_id, first_seen)
    )`,
  ],
  [
    'v005_group_member',
    `CREATE TABLE IF NOT EXISTS group_member (
      group_id VARCHAR(64) NOT NULL,
      account_id VARCHAR(128) NOT NULL,
      first_seen INT NOT NULL,
      last_seen INT NOT NULL,
      PRIMARY KEY (group_id, account_id, first_seen)
    )`,
  ],
  [
    'v006_person',
    `CREATE TABLE IF NOT EXISTS person (
      account_id VARCHAR(128) NOT NULL PRIMARY KEY,
      display_name VARCHAR(255) NULL,
      account_type VARCHAR(16) NOT NULL,
      active TINYINT NOT NULL,
      last_seen INT NOT NULL,
      anonymized_at DATETIME(3) NULL
    )`,
  ],
  [
    'v007_job_step',
    `CREATE TABLE IF NOT EXISTS job_step (
      snapshot_id VARCHAR(36) NOT NULL,
      step VARCHAR(16) NOT NULL,
      batch INT NOT NULL,
      status VARCHAR(16) NOT NULL,
      attempts INT NOT NULL DEFAULT 0,
      error_code VARCHAR(64) NULL,
      PRIMARY KEY (snapshot_id, step, batch)
    )`,
  ],
  [
    'v008_settings',
    `CREATE TABLE IF NOT EXISTS settings (
      id TINYINT NOT NULL PRIMARY KEY,
      schedule VARCHAR(16) NOT NULL,
      key_permissions TEXT NOT NULL,
      retention_days INT NOT NULL,
      collector_account_id VARCHAR(128) NULL
    )`,
  ],
];

export function buildRunner() {
  let runner = migrationRunner;
  for (const [name, ddl] of MIGRATIONS) runner = runner.enqueue(name, ddl);
  return runner;
}

/** Runs pending migrations; call only from the queue consumer (900 s budget, DDL rate limits). */
export async function runMigrations(): Promise<string[]> {
  return buildRunner().run();
}
