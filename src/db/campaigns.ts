import { randomUUID } from 'node:crypto';
import { nextRunAt, parseReminderDays, type CampaignFrequency } from '../domain/campaignSchedule';
import { DEFAULT_KEY_PERMISSIONS } from '../engine/resolve';
import { exec, limitClause, q } from './sql';

export type CampaignStatus = 'active' | 'paused' | 'paused_edition' | 'deleted';
export type DelegateRule = 'projectLead' | 'map' | 'admin';
export type CampaignScope =
  { type: 'site' } | { type: 'projects'; ids: string[] } | { type: 'category'; ids: string[] };

export interface CampaignRow {
  id: string;
  name: string;
  scope: CampaignScope;
  frequency: CampaignFrequency;
  startAt: number;
  windowDays: number;
  delegateRule: DelegateRule;
  delegateMap: Record<string, string> | null;
  reminderDays: number[];
  keyPermissions: string[];
  status: CampaignStatus;
  nextRunAt: number | null;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface CampaignRunRow {
  id: string;
  campaignId: string;
  seq: number | null;
  status: string;
  startedAt: number;
  dueAt: number;
  finishedAt: number | null;
  reviewCount: number;
  error: string | null;
}

export interface AssignmentRow {
  reviewId: string;
  projectId: string;
  assignee: string | null;
  status: string;
  dueAt: number;
  submittedAt: number | null;
  submittedBy: string | null;
  lastReminderAt: number | null;
  reminderCount: number;
}

const FREQ = new Set<CampaignFrequency>(['quarterly', 'semiannual', 'annual', 'once']);
const DELEGATE = new Set<DelegateRule>(['projectLead', 'map', 'admin']);

function parseScope(raw: string): CampaignScope {
  try {
    const o = JSON.parse(raw) as CampaignScope;
    if (o?.type === 'site') return { type: 'site' };
    if (o?.type === 'projects' && Array.isArray(o.ids))
      return { type: 'projects', ids: o.ids.map(String).slice(0, 1000) };
    if (o?.type === 'category' && Array.isArray(o.ids))
      return { type: 'category', ids: o.ids.map(String).slice(0, 200) };
  } catch {
    /* fall through */
  }
  return { type: 'site' };
}

const toCampaign = (r: any): CampaignRow => ({
  id: r.id,
  name: r.name,
  scope: parseScope(r.scope_json),
  frequency: FREQ.has(r.frequency) ? r.frequency : 'quarterly',
  startAt: Number(r.start_at),
  windowDays: Number(r.window_days),
  delegateRule: DELEGATE.has(r.delegate_rule) ? r.delegate_rule : 'projectLead',
  delegateMap: r.delegate_map ? (JSON.parse(r.delegate_map) as Record<string, string>) : null,
  reminderDays: parseReminderDays(r.reminder_days || '7,3,1'),
  keyPermissions: r.key_perms
    ? (JSON.parse(r.key_perms) as string[])
    : [...DEFAULT_KEY_PERMISSIONS],
  status: r.status,
  nextRunAt: r.next_run_at != null ? Number(r.next_run_at) : null,
  createdBy: r.created_by,
  createdAt: Number(r.created_at),
  updatedAt: Number(r.updated_at),
});

const toRun = (r: any): CampaignRunRow => ({
  id: r.id,
  campaignId: r.campaign_id,
  seq: r.seq != null ? Number(r.seq) : null,
  status: r.status,
  startedAt: Number(r.started_at),
  dueAt: Number(r.due_at),
  finishedAt: r.finished_at != null ? Number(r.finished_at) : null,
  reviewCount: Number(r.review_count ?? 0),
  error: r.error ?? null,
});

const toAssignment = (r: any): AssignmentRow => ({
  reviewId: r.review_id,
  projectId: r.project_id,
  assignee: r.assignee ?? null,
  status: r.status,
  dueAt: Number(r.due_at),
  submittedAt: r.submitted_at != null ? Number(r.submitted_at) : null,
  submittedBy: r.submitted_by ?? null,
  lastReminderAt: r.last_reminder_at != null ? Number(r.last_reminder_at) : null,
  reminderCount: Number(r.reminder_count ?? 0),
});

export interface CampaignInput {
  name: string;
  scope: CampaignScope;
  frequency: CampaignFrequency;
  startAt: number;
  windowDays?: number;
  delegateRule?: DelegateRule;
  delegateMap?: Record<string, string> | null;
  reminderDays?: number[] | string;
  keyPermissions?: string[];
  status?: CampaignStatus;
}

export function sanitizeCampaignInput(input: CampaignInput): CampaignInput {
  const name = String(input.name ?? '')
    .trim()
    .slice(0, 200);
  if (!name) throw new Error('Campaign name is required');
  if (!FREQ.has(input.frequency)) throw new Error('Invalid frequency');
  const startAt = Number(input.startAt);
  if (!Number.isFinite(startAt)) throw new Error('Invalid start date');
  const windowDays = Math.min(90, Math.max(1, Math.floor(input.windowDays ?? 14)));
  const delegateRule = DELEGATE.has(input.delegateRule as DelegateRule)
    ? (input.delegateRule as DelegateRule)
    : 'projectLead';
  const reminderDays = Array.isArray(input.reminderDays)
    ? input.reminderDays
    : parseReminderDays(String(input.reminderDays ?? '7,3,1'));
  const keyPermissions = (
    Array.isArray(input.keyPermissions) && input.keyPermissions.length
      ? input.keyPermissions
      : DEFAULT_KEY_PERMISSIONS
  )
    .filter((p) => typeof p === 'string')
    .slice(0, 20);
  return {
    name,
    scope: input.scope?.type ? input.scope : { type: 'site' },
    frequency: input.frequency,
    startAt,
    windowDays,
    delegateRule,
    delegateMap: delegateRule === 'map' ? (input.delegateMap ?? {}) : null,
    reminderDays: parseReminderDays(reminderDays.join(',')),
    keyPermissions,
    status: input.status ?? 'active',
  };
}

export async function listCampaigns(): Promise<CampaignRow[]> {
  const rows = await q(
    `SELECT * FROM campaign WHERE status != 'deleted' ORDER BY updated_at DESC ${limitClause(200)}`,
  );
  return rows.map(toCampaign);
}

export async function getCampaign(id: string): Promise<CampaignRow | null> {
  const rows = await q('SELECT * FROM campaign WHERE id = ?', id);
  return rows[0] ? toCampaign(rows[0]) : null;
}

export async function insertCampaign(input: CampaignInput, createdBy: string, now = Date.now()) {
  const s = sanitizeCampaignInput(input);
  const id = randomUUID();
  const next = nextRunAt({ frequency: s.frequency, startAt: s.startAt }, now, null);
  await exec(
    `INSERT INTO campaign (
      id, name, scope_json, frequency, start_at, window_days, delegate_rule, delegate_map,
      reminder_days, key_perms, status, next_run_at, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    s.name,
    JSON.stringify(s.scope),
    s.frequency,
    s.startAt,
    s.windowDays,
    s.delegateRule,
    s.delegateMap ? JSON.stringify(s.delegateMap) : null,
    parseReminderDays(
      Array.isArray(s.reminderDays) ? s.reminderDays.join(',') : String(s.reminderDays ?? '7,3,1'),
    ).join(','),
    JSON.stringify(s.keyPermissions),
    s.status ?? 'active',
    next,
    createdBy.slice(0, 128),
    now,
    now,
  );
  return id;
}

export async function updateCampaign(
  id: string,
  input: Partial<CampaignInput> & { status?: CampaignStatus },
  now = Date.now(),
): Promise<void> {
  const cur = await getCampaign(id);
  if (!cur || cur.status === 'deleted') throw new Error('Campaign not found');
  const merged = sanitizeCampaignInput({
    name: input.name ?? cur.name,
    scope: input.scope ?? cur.scope,
    frequency: input.frequency ?? cur.frequency,
    startAt: input.startAt ?? cur.startAt,
    windowDays: input.windowDays ?? cur.windowDays,
    delegateRule: input.delegateRule ?? cur.delegateRule,
    delegateMap: input.delegateMap !== undefined ? input.delegateMap : cur.delegateMap,
    reminderDays: input.reminderDays ?? cur.reminderDays,
    keyPermissions: input.keyPermissions ?? cur.keyPermissions,
    status: input.status ?? cur.status,
  });
  const next =
    merged.status === 'active'
      ? nextRunAt({ frequency: merged.frequency, startAt: merged.startAt }, now, null)
      : null;
  await exec(
    `UPDATE campaign SET name=?, scope_json=?, frequency=?, start_at=?, window_days=?,
     delegate_rule=?, delegate_map=?, reminder_days=?, key_perms=?, status=?, next_run_at=?, updated_at=?
     WHERE id=?`,
    merged.name,
    JSON.stringify(merged.scope),
    merged.frequency,
    merged.startAt,
    merged.windowDays,
    merged.delegateRule,
    merged.delegateMap ? JSON.stringify(merged.delegateMap) : null,
    parseReminderDays(
      Array.isArray(merged.reminderDays)
        ? merged.reminderDays.join(',')
        : String(merged.reminderDays ?? '7,3,1'),
    ).join(','),
    JSON.stringify(merged.keyPermissions),
    merged.status,
    next,
    now,
    id,
  );
}

export async function pauseCampaign(
  id: string,
  status: CampaignStatus = 'paused',
  now = Date.now(),
) {
  await exec(
    `UPDATE campaign SET status = ?, next_run_at = NULL, updated_at = ? WHERE id = ? AND status != 'deleted'`,
    status,
    now,
    id,
  );
}

export async function deleteCampaign(id: string, now = Date.now()) {
  await exec(
    `UPDATE campaign SET status = 'deleted', next_run_at = NULL, updated_at = ? WHERE id = ?`,
    now,
    id,
  );
}

/** Soonest next_run_at among active campaigns (for tick gate). */
export async function soonestCampaignRunAt(): Promise<number | null> {
  const rows = await q<{ n: number | null }>(
    `SELECT MIN(next_run_at) AS n FROM campaign WHERE status = 'active' AND next_run_at IS NOT NULL`,
  );
  const n = rows[0]?.n;
  return n != null ? Number(n) : null;
}

export async function insertCampaignRun(row: {
  campaignId: string;
  seq?: number | null;
  status: string;
  startedAt: number;
  dueAt: number;
}): Promise<string> {
  const id = randomUUID();
  await exec(
    `INSERT INTO campaign_run (
      id, campaign_id, seq, status, started_at, due_at, finished_at, review_count, error
    ) VALUES (?, ?, ?, ?, ?, ?, NULL, 0, NULL)`,
    id,
    row.campaignId,
    row.seq ?? null,
    row.status,
    row.startedAt,
    row.dueAt,
  );
  return id;
}

export async function getCampaignRun(id: string): Promise<CampaignRunRow | null> {
  const rows = await q('SELECT * FROM campaign_run WHERE id = ?', id);
  return rows[0] ? toRun(rows[0]) : null;
}

export async function patchCampaignRun(
  id: string,
  patch: Partial<{
    seq: number | null;
    status: string;
    finishedAt: number | null;
    reviewCount: number;
    error: string | null;
  }>,
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (patch.seq !== undefined) {
    sets.push('seq = ?');
    params.push(patch.seq);
  }
  if (patch.status !== undefined) {
    sets.push('status = ?');
    params.push(patch.status);
  }
  if (patch.finishedAt !== undefined) {
    sets.push('finished_at = ?');
    params.push(patch.finishedAt);
  }
  if (patch.reviewCount !== undefined) {
    sets.push('review_count = ?');
    params.push(patch.reviewCount);
  }
  if (patch.error !== undefined) {
    sets.push('error = ?');
    params.push(patch.error ? patch.error.slice(0, 500) : null);
  }
  if (!sets.length) return;
  params.push(id);
  await exec(`UPDATE campaign_run SET ${sets.join(', ')} WHERE id = ?`, ...params);
}

export async function insertAssignment(row: AssignmentRow): Promise<void> {
  await exec(
    `INSERT INTO review_assignment (
      review_id, project_id, assignee, status, due_at, submitted_at, submitted_by,
      last_reminder_at, reminder_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    row.reviewId,
    row.projectId,
    row.assignee,
    row.status,
    row.dueAt,
    row.submittedAt,
    row.submittedBy,
    row.lastReminderAt,
    row.reminderCount,
  );
}

export async function getAssignment(reviewId: string): Promise<AssignmentRow | null> {
  const rows = await q('SELECT * FROM review_assignment WHERE review_id = ?', reviewId);
  return rows[0] ? toAssignment(rows[0]) : null;
}

export async function listAssignmentsForRun(runId: string): Promise<AssignmentRow[]> {
  const rows = await q(
    `SELECT a.* FROM review_assignment a
     INNER JOIN review r ON r.id = a.review_id
     WHERE r.campaign_run_id = ?
     ORDER BY a.project_id`,
    runId,
  );
  return rows.map(toAssignment);
}
