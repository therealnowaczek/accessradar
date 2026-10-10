import { exec, limitClause, q } from './sql';

export type NoticeAudience = 'admin' | 'project' | 'account';
export type NoticeSeverity = 'high' | 'medium' | 'low';

export interface Notice {
  id: number;
  kind: string;
  audience: NoticeAudience | string;
  projectId: string | null;
  accountId: string | null;
  refId: string | null;
  severity: NoticeSeverity | string;
  title: string;
  body: string | null;
  createdAt: number;
  dismissedBy: string | null;
  dismissedAt: number | null;
}

export interface NoticeInput {
  kind: string;
  audience: NoticeAudience | string;
  projectId?: string | null;
  accountId?: string | null;
  refId?: string | null;
  severity: NoticeSeverity | string;
  title: string;
  body?: string | null;
  createdAt?: number;
}

const toNotice = (r: any): Notice => ({
  id: Number(r.id),
  kind: r.kind,
  audience: r.audience,
  projectId: r.project_id ?? null,
  accountId: r.account_id ?? null,
  refId: r.ref_id ?? null,
  severity: r.severity,
  title: r.title,
  body: r.body ?? null,
  createdAt: Number(r.created_at),
  dismissedBy: r.dismissed_by ?? null,
  dismissedAt: r.dismissed_at != null ? Number(r.dismissed_at) : null,
});

/** Inserts an in-app notice (reminder, overdue, or alert). Returns new id. */
export async function insertNotice(input: NoticeInput): Promise<number> {
  const createdAt = input.createdAt ?? Date.now();
  await exec(
    `INSERT INTO notice (
      kind, audience, project_id, account_id, ref_id, severity, title, body, created_at,
      dismissed_by, dismissed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
    input.kind.slice(0, 24),
    String(input.audience).slice(0, 16),
    input.projectId ?? null,
    input.accountId ?? null,
    input.refId ?? null,
    String(input.severity).slice(0, 8),
    input.title.slice(0, 200),
    input.body ?? null,
    createdAt,
  );
  const rows = await q<{ id: number }>('SELECT LAST_INSERT_ID() AS id');
  return Number(rows[0]?.id ?? 0);
}

export async function listNotices(opts: {
  audience?: string;
  projectId?: string | null;
  accountId?: string | null;
  kindPrefix?: string;
  undismissedOnly?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<{ items: Notice[]; total: number }> {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const pageSize = Math.min(200, Math.max(1, Math.floor(opts.pageSize ?? 50)));
  const offset = (page - 1) * pageSize;
  const where: string[] = [];
  const params: unknown[] = [];
  if (opts.audience) {
    where.push('audience = ?');
    params.push(opts.audience);
  }
  if (opts.projectId) {
    where.push('project_id = ?');
    params.push(opts.projectId);
  }
  if (opts.accountId) {
    where.push('account_id = ?');
    params.push(opts.accountId);
  }
  if (opts.kindPrefix) {
    where.push('kind LIKE ?');
    params.push(`${opts.kindPrefix}%`);
  }
  if (opts.undismissedOnly !== false) {
    where.push('dismissed_at IS NULL');
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const totalRows = await q<{ n: number }>(`SELECT COUNT(*) AS n FROM notice ${clause}`, ...params);
  const rows = await q(
    `SELECT * FROM notice ${clause} ORDER BY created_at DESC ${limitClause(pageSize)} OFFSET ${offset}`,
    ...params,
  );
  return { items: rows.map(toNotice), total: Number(totalRows[0]?.n ?? 0) };
}

export async function countUndismissed(opts: {
  audience: string;
  projectId?: string | null;
  accountId?: string | null;
  kindPrefix?: string;
}): Promise<number> {
  const where = ['audience = ?', 'dismissed_at IS NULL'];
  const params: unknown[] = [opts.audience];
  if (opts.projectId) {
    where.push('project_id = ?');
    params.push(opts.projectId);
  }
  if (opts.accountId) {
    where.push('account_id = ?');
    params.push(opts.accountId);
  }
  if (opts.kindPrefix) {
    where.push('kind LIKE ?');
    params.push(`${opts.kindPrefix}%`);
  }
  const rows = await q<{ n: number }>(
    `SELECT COUNT(*) AS n FROM notice WHERE ${where.join(' AND ')}`,
    ...params,
  );
  return Number(rows[0]?.n ?? 0);
}

export async function dismissNotices(
  ids: number[],
  actor: string,
  now = Date.now(),
): Promise<number> {
  const clean = [...new Set(ids.map((n) => Math.floor(Number(n))).filter((n) => n > 0))].slice(
    0,
    200,
  );
  if (!clean.length) return 0;
  const ph = clean.map(() => '?').join(', ');
  return exec(
    `UPDATE notice SET dismissed_by = ?, dismissed_at = ?
     WHERE id IN (${ph}) AND dismissed_at IS NULL`,
    actor.slice(0, 128),
    now,
    ...clean,
  );
}

/** Retention: delete notices older than cutoff (dismissed or not), in bounded batches. */
export async function purgeNotices(cutoff: number): Promise<number> {
  let total = 0;
  for (let i = 0; i < 50; i++) {
    const n = await exec(`DELETE FROM notice WHERE created_at < ? LIMIT 5000`, cutoff);
    total += n;
    if (n < 5000) break;
  }
  return total;
}
