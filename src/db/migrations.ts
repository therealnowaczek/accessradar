import { migrationRunner } from '@forge/sql';

/**
 * Forge SQL schema. Rules: one DDL per statement, no trailing semicolon,
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
  // ---- v1.0 schema (week 2+). Generic SCD2 fact table replaces the per-kind week-1 stubs,
  // which never held data. Timestamps are epoch milliseconds (BIGINT), always UTC.
  ['v009_drop_snapshot_stub', 'DROP TABLE IF EXISTS snapshot'],
  ['v010_drop_project_stub', 'DROP TABLE IF EXISTS project'],
  ['v011_drop_perm_grant_stub', 'DROP TABLE IF EXISTS perm_grant'],
  ['v012_drop_role_actor_stub', 'DROP TABLE IF EXISTS role_actor'],
  ['v013_drop_group_member_stub', 'DROP TABLE IF EXISTS group_member'],
  ['v014_drop_person_stub', 'DROP TABLE IF EXISTS person'],
  ['v015_drop_settings_stub', 'DROP TABLE IF EXISTS settings'],
  [
    'v016_snap',
    `CREATE TABLE IF NOT EXISTS snap (
      seq INT NOT NULL PRIMARY KEY,
      status VARCHAR(16) NOT NULL,
      trigger_kind VARCHAR(16) NOT NULL,
      collector_mode VARCHAR(16) NOT NULL,
      engine_version VARCHAR(16) NOT NULL,
      started_at BIGINT NOT NULL,
      updated_at BIGINT NOT NULL,
      finished_at BIGINT NULL,
      progress_json TEXT NULL,
      coverage_json MEDIUMTEXT NULL,
      stats_json TEXT NULL,
      points INT NOT NULL DEFAULT 0,
      calls INT NOT NULL DEFAULT 0,
      content_hash CHAR(64) NULL,
      error VARCHAR(500) NULL
    )`,
  ],
  [
    'v017_fact',
    `CREATE TABLE IF NOT EXISTS fact (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      kind VARCHAR(24) NOT NULL,
      fkey VARCHAR(400) NOT NULL,
      vhash CHAR(16) NOT NULL,
      attrs TEXT NOT NULL,
      first_seen INT NOT NULL,
      last_seen INT NOT NULL,
      UNIQUE KEY uq_fact_version (kind, fkey, first_seen),
      KEY ix_fact_last (last_seen),
      KEY ix_fact_first (first_seen)
    )`,
  ],
  [
    'v018_stage',
    `CREATE TABLE IF NOT EXISTS stage (
      seq INT NOT NULL,
      kind VARCHAR(24) NOT NULL,
      fkey VARCHAR(400) NOT NULL,
      attrs TEXT NOT NULL,
      PRIMARY KEY (seq, kind, fkey)
    )`,
  ],
  [
    'v019_review',
    `CREATE TABLE IF NOT EXISTS review (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      scope_json TEXT NOT NULL,
      key_perms TEXT NOT NULL,
      base_seq INT NOT NULL,
      compare_seq INT NULL,
      status VARCHAR(16) NOT NULL,
      created_by VARCHAR(128) NOT NULL,
      created_at BIGINT NOT NULL,
      due_at BIGINT NULL,
      item_count INT NOT NULL DEFAULT 0,
      signed_by VARCHAR(128) NULL,
      signed_at BIGINT NULL,
      signer_tz VARCHAR(64) NULL,
      attestation TEXT NULL,
      evidence_hash CHAR(64) NULL,
      engine_version VARCHAR(16) NOT NULL
    )`,
  ],
  [
    'v020_review_item',
    `CREATE TABLE IF NOT EXISTS review_item (
      review_id VARCHAR(36) NOT NULL,
      idx INT NOT NULL,
      item_key VARCHAR(512) NOT NULL,
      subject_type VARCHAR(16) NOT NULL,
      subject_id VARCHAR(256) NOT NULL,
      project_id VARCHAR(32) NULL,
      group_id VARCHAR(128) NULL,
      permissions TEXT NOT NULL,
      reasons TEXT NOT NULL,
      path_codes TEXT NOT NULL,
      change_kind VARCHAR(16) NULL,
      risk INT NOT NULL,
      decision VARCHAR(16) NULL,
      note TEXT NULL,
      decided_by VARCHAR(128) NULL,
      decided_at BIGINT NULL,
      PRIMARY KEY (review_id, idx)
    )`,
  ],
  [
    'v021_audit_event',
    `CREATE TABLE IF NOT EXISTS audit_event (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      at BIGINT NOT NULL,
      actor VARCHAR(128) NOT NULL,
      action VARCHAR(48) NOT NULL,
      target VARCHAR(128) NULL,
      detail TEXT NULL,
      KEY ix_audit_at (at)
    )`,
  ],
  [
    'v022_kv',
    `CREATE TABLE IF NOT EXISTS kv (
      k VARCHAR(64) NOT NULL PRIMARY KEY,
      v MEDIUMTEXT NOT NULL,
      updated_at BIGINT NOT NULL
    )`,
  ],
  [
    'v023_rate_usage',
    `CREATE TABLE IF NOT EXISTS rate_usage (
      hour_utc BIGINT NOT NULL PRIMARY KEY,
      points INT NOT NULL,
      calls INT NOT NULL
    )`,
  ],
  [
    // Per-account personal-data reporting state: report each account at most once per cycle
    // (7 days) and never again once Atlassian says it is closed.
    'v024_privacy_account',
    `CREATE TABLE IF NOT EXISTS privacy_account (
      account_id VARCHAR(128) NOT NULL PRIMARY KEY,
      last_reported BIGINT NOT NULL,
      closed_at BIGINT NULL
    )`,
  ],
  [
    'v025_review_item_exception',
    `ALTER TABLE review_item ADD COLUMN expires_at BIGINT NULL`,
  ],
  [
    'v026_access_exception',
    `CREATE TABLE IF NOT EXISTS access_exception (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      item_key VARCHAR(512) NOT NULL,
      subject_type VARCHAR(16) NOT NULL,
      subject_id VARCHAR(256) NOT NULL,
      project_id VARCHAR(32) NULL,
      group_id VARCHAR(128) NULL,
      permissions TEXT NOT NULL,
      justification TEXT NOT NULL,
      expires_at BIGINT NOT NULL,
      status VARCHAR(16) NOT NULL,
      review_id VARCHAR(36) NOT NULL,
      granted_by VARCHAR(128) NOT NULL,
      granted_at BIGINT NOT NULL,
      closed_at BIGINT NULL,
      closed_reason VARCHAR(32) NULL,
      KEY ix_exc_item (item_key(191), status),
      KEY ix_exc_exp (status, expires_at)
    )`,
  ],
];

let runner: typeof migrationRunner | null = null;

/** The runner is a module singleton; enqueue each migration exactly once. */
export function buildRunner() {
  if (runner) return runner;
  let r = migrationRunner;
  for (const [name, ddl] of MIGRATIONS) r = r.enqueue(name, ddl);
  runner = r;
  return r;
}

/** Runs pending migrations; call only from the queue consumer (900 s budget, DDL rate limits). */
export async function runMigrations(): Promise<string[]> {
  return buildRunner().run();
}

let migrated: Promise<void> | null = null;

/** Applies pending migrations once per warm container (deploys do not fire lifecycle events). */
export function ensureMigrated(): Promise<void> {
  if (!migrated)
    migrated = runMigrations().then(
      (applied) => {
        if (applied.length) console.log('[migrate] applied', applied.length);
      },
      (e) => {
        migrated = null;
        throw e;
      },
    );
  return migrated;
}
